# Architecture

How a question travels from a student's browser to an answer.

```
 Student's browser (any machine on the network)
        │
        │  http://129.79.199.105:5173/
        ▼
 ┌─────────────────────────────┐
 │ Vite dev server  :5173      │  Frontend/ (React app)
 │  • serves the UI            │
 │  • proxies /v1/* ────────┐  │  (vite.config.js — so the backend
 └──────────────────────────┼──┘   can stay bound to 127.0.0.1)
                            ▼
 ┌─────────────────────────────┐
 │ Quart backend  :5000        │  RAG/__init__.py
 │  POST /v1/chat/completions  │  OpenAI-compatible; non-streaming by
 │  → run_rag(query)           │  default, SSE with "stream": true
 └──────────────┬──────────────┘
                ▼
 ┌─────────────────────────────┐
 │ RAG chain (LCEL)            │  RAG/rag.py — serve_rag(),
 │  retriever (k=5)            │  built ONCE at startup and reused
 │   → prompt template         │
 │   → ChatOllama llama3.1:70b │  (keep_alive 30m, num_predict 512,
 │   → StrOutputParser         │   num_ctx 4096, temperature 0.2)
 └───────┬─────────────┬───────┘
         ▼             ▼
 ┌──────────────┐ ┌──────────────────┐
 │ ChromaDB     │ │ Ollama  :11434   │
 │ chroma_db/   │ │  llama3.1:70b    │
 │ collection:  │ │  nomic-embed-text│
 │ tcp_redbook  │ └──────────────────┘
 └──────────────┘
```

Everything runs locally on the DGX. There are no cloud dependencies.

## Frontend (Frontend/src/)

Single-screen Vite + React app — a prompt-engineering course tutor.

| Piece | File | Role |
|---|---|---|
| Layout & wiring | `App.jsx` | Header on top; course sidebar (25%) + chat panel (75%). Builds the **enriched query** and triggers the **auto-intro** on section change. |
| Chat state | `hooks/useChat.js` | Message list (`user`/`assistant`/`error`/`divider` roles), loading flag, request-sequence guard so a newer request supersedes an in-flight one. |
| Course state | `hooks/useCourse.js` | Current section, completed set (✓), open modules, progress %. |
| Course outline | `course.js` | Hardcoded 4 modules × sections. Edit here to change the course (see UPDATING_CONTENT.md). |
| Backend client | `api.js` | `sendChat()`, `stripThink()`, `checkHealth()`. |
| Sidebar | `components/CourseNav.jsx` | Collapsible modules, active highlight, checkmarks, progress bar, Prev/Next. |
| Chat UI | `components/ChatPanel.jsx`, `MessageList.jsx`, `InputBar.jsx` | Bubbles, auto-scroll, "Thinking… Ns" indicator, Enter-to-send. |
| Avatar slot | `components/AvatarBanner.jsx` | Slim placeholder banner. A future avatar component mounts as its children — no layout changes needed. |
| Status pill | `components/Header.jsx` | Polls `checkHealth()` every 15 s. |

### Where course context is injected

Two prompt templates, both in the frontend (the backend is course-agnostic):

1. **Enriched query** (`App.jsx`) — wraps every typed question before sending; the raw text is what appears in the chat bubble:
   > "The student is currently studying {module} - {section}. Answer the following question as an encouraging teacher would to a student learning this for the first time: {question}"
2. **Auto-intro** (`hooks/useChat.js`) — sent automatically when a section is selected:
   > "Introduce {section} to a student who is new to prompt engineering. Keep it brief — 2-3 sentences that set up what they're about to learn."

## Backend (RAG/)

| Piece | File | Role |
|---|---|---|
| HTTP API | `__init__.py` | Quart app; mimics OpenAI's chat-completions endpoint. Extracts the **last user message** only and calls `run_rag()` via `asyncio.to_thread` (the event loop stays free during inference, so health probes answer instantly). A `before_serving` warmup builds the chain and pre-loads the model in the background at startup. `"stream": true` switches to SSE. |
| RAG chain | `rag.py` | `serve_rag()` builds the LCEL chain (retrieve → stuff context into prompt → ChatOllama → parse); `get_qa_chain()` caches it as a singleton — it is built **once** and reused by every request. Each request logs a `RAG timing:` line splitting retrieval vs generation time. `embed_pdf()` handles ingestion. TTS (Coqui) is optional — starts cleanly without it. |
| Embedding | `embedding.py` | Chunk-by-chunk embedding via `ollama.embed` with skip-if-exists dedup. |
| PDF chunking | `pdfprocess.py` | PyMuPDF load + recursive splitting (chunk 800 / overlap 150). PDFs live in `RAG/example_data/`. |
| Ingestion CLI | `ingest.py` | Standalone script: embeds the course PDF, prints progress and final count. |

## API contract

`POST /v1/chat/completions` — request: `{"model": "...", "messages": [{"role": "user", "content": "..."}]}`.
Response: OpenAI shape; the answer is at `choices[0].message.content`. Errors: `{"error": "..."}` with HTTP 400/500.

**Opt-in streaming** (additive; the default non-streaming shape above is unchanged): add `"stream": true` to the request body and the backend responds with `text/event-stream` SSE — OpenAI-style `chat.completion.chunk` objects (text deltas in `choices[0].delta.content`, then a `finish_reason: "stop"` chunk, then `data: [DONE]`). The frontend does not use this yet.

Frontend-side handling (`Frontend/src/api.js`):
- `<think>…</think>` blocks are stripped from answers (thinking-model artifacts).
- Client timeout is **120 s** (`TIMEOUT_MS`) — with the model warm, answers typically take **15–25 s** (see Performance below).
- **Health probe**: the backend has no health route, so the header pill POSTs an empty body every 15 s; the backend's cheap 400 path proves it's alive without invoking the LLM. Since inference runs off the event loop, the probe stays fast even mid-generation.

## Performance

- **Warm requests** (model already loaded): ~15–25 s total, split roughly retrieval 0.5–4 s / generation the rest — each request logs `RAG timing: retrieval Xs, generation Ys` so you can see the split.
- **Cold start**: loading llama3.1:70b (~43 GB) takes 20–30 s. The backend pre-warms at startup (`before_serving`), and `keep_alive: 30m` keeps the model in GPU memory between requests, so users only hit a cold load after 30+ minutes of idle.
- Answers are capped at 512 tokens (`num_predict`) — intentional for concise course Q&A; raise it in `RAG/config.yaml` if answers get cut off.

## Configuration

| Source | Controls |
|---|---|
| `RAG/config.yaml` | LLM model + generation options (`keep_alive`, `num_predict`, `num_ctx`, `temperature`), embedding model, chunk size/overlap, retrieval k (currently 5), Chroma directory + collection name |
| `Frontend/.env.example` → `.env` | `VITE_API_URL` (default empty = same-origin via the Vite proxy) |
| `Frontend/vite.config.js` | Network binding (`host: true`) and the `/v1` proxy target |

**Important:** the backend opens `RAG/config.yaml` relative to the current working directory — always start `RAG/__init__.py` and `RAG/ingest.py` **from the project root**.
