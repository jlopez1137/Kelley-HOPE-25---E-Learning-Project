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
 ┌──────────────────────────────────┐
 │ Quart backend  :5000             │  RAG/__init__.py
 │  POST /v1/chat/completions       │  OpenAI-compatible; non-streaming by
 │   → run_rag(query)               │  default, SSE with "stream": true
 │  POST /v1/audio/transcriptions   │  STT: audio file → {"text": ...}
 │   → transcribe() (faster-whisper)│  (lazy-loaded, CPU int8)
 │  POST /v1/audio/speech           │  TTS: {"text": ...} → WAV bytes
 │   → synthesize_speech() (Piper)  │  (lazy-loaded, CPU ONNX voice)
 └──────────────┬───────────────────┘
                ▼
 ┌─────────────────────────────┐
 │ RAG chain (LCEL)            │  RAG/rag.py — serve_rag(),
 │  retriever (k=5)            │  built ONCE at startup and reused
 │   → prompt template         │
 │   → ChatOllama llama3.1:8b  │  (keep_alive 30m, num_predict 512,
 │   → StrOutputParser         │   num_ctx 4096, temperature 0)
 └───────┬─────────────┬───────┘
         ▼             ▼
 ┌──────────────┐ ┌──────────────────┐
 │ ChromaDB     │ │ Ollama  :11434   │
 │ chroma_db/   │ │  llama3.1:8b     │
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
| Backend client | `api.js` | `sendChat()`, `stripThink()`, `checkHealth()`, `transcribeAudio()` (STT), `synthesizeSpeech()` (TTS — returns a blob object URL the caller must revoke). |
| Sidebar | `components/CourseNav.jsx` | Collapsible modules, active highlight, checkmarks, progress bar, Prev/Next. |
| Chat UI | `components/ChatPanel.jsx`, `MessageList.jsx`, `InputBar.jsx` | Bubbles, auto-scroll, "Thinking… Ns" indicator, Enter-to-send. |
| Voice input | `components/InputBar.jsx` (🎤 button) | Records via `MediaRecorder`, sends to `/v1/audio/transcriptions`, appends the transcript to the textarea. Needs a secure context — mic only works via `localhost` (SSH tunnel), see TROUBLESHOOTING.md. |
| Voice output | `components/MessageList.jsx` (`PlayButton`, 🔊 on assistant bubbles) | Click-to-play only (no autoplay): calls `/v1/audio/speech`, plays the returned WAV. Not wired to the avatar/lip-sync pipeline. |
| Avatar slot | `components/AvatarBanner.jsx` | Slim placeholder banner, slated for removal in the slide-primary rebuild. The avatar's decided home is the **agent panel** in the new layout — do not build against this component. |
| Status pill | `components/Header.jsx` | Polls `checkHealth()` every 15 s. |

### Where course context is injected

Two prompt templates in the frontend (the backend's own prompt, in `RAG/rag.py`, adds a tutor persona: answer from the retrieved course material first, general knowledge as fallback, refusals forbidden):

1. **Enriched query** (`App.jsx`) — wraps every typed question before sending; the raw text is what appears in the chat bubble:
   > "The student is currently studying {module} - {section}. Answer the following question as an encouraging teacher would to a student learning this for the first time: {question}"
2. **Auto-intro** (`hooks/useChat.js`) — sent automatically when a section is selected:
   > "{section} ({module}). Give a 2-3 sentence introduction to this topic for a student who is new to prompt engineering, setting up what they're about to learn. …"

   The topic leads the string deliberately: the backend embeds the whole
   message as the vector-search query, and instruction-first phrasing drags
   retrieval off-topic.

## Backend (RAG/)

| Piece | File | Role |
|---|---|---|
| HTTP API | `__init__.py` | Quart app; mimics OpenAI's chat-completions endpoint. Extracts the **last user message** only and calls `run_rag()` via `asyncio.to_thread` (the event loop stays free during inference, so health probes answer instantly). A `before_serving` warmup builds the chain and pre-loads the model in the background at startup. `"stream": true` switches to SSE. Also serves `/v1/audio/transcriptions` (STT) and `/v1/audio/speech` (TTS), both run off the event loop via `asyncio.to_thread`. |
| RAG chain | `rag.py` | `serve_rag()` builds the LCEL chain (retrieve → stuff context into prompt → ChatOllama → parse); `get_qa_chain()` caches it as a singleton — it is built **once** and reused by every request. Each request logs a `RAG timing:` line splitting retrieval vs generation time. `embed_pdf()` handles ingestion. |
| Speech-to-text | `rag.py` — `transcribe()` | faster-whisper (`base.en`, CPU, int8 — `stt:` block in config.yaml). Model is a lazy singleton via `get_whisper_model()`: loaded on first request, not at startup. Accepts any ffmpeg-readable audio. |
| Text-to-speech | `rag.py` — `synthesize_speech()` | Piper (`en_US-lessac-medium`, CPU ONNX — `tts.piper` block in config.yaml). Lazy singleton via `get_piper_voice()`; auto-downloads the voice (~63 MB) into `RAG/tts_models/` on first use. Writes a WAV per request into `RAG/tts_output/` (no cleanup yet — see PIPER_TTS_NOTES.md). The old Coqui `tts()` path is dead code (package not installed) but preserved under `tts.coqui`. |
| Embedding | `embedding.py` | Chunk-by-chunk embedding via `ollama.embed` with skip-if-exists dedup. |
| PDF chunking | `pdfprocess.py` | PyMuPDF load + recursive splitting (chunk 800 / overlap 150). PDFs live in `RAG/example_data/`. |
| Ingestion CLI | `ingest.py` | Standalone script: embeds the course PDF, prints progress and final count. |

## API contract

`POST /v1/chat/completions` — request: `{"model": "...", "messages": [{"role": "user", "content": "..."}]}`.
Response: OpenAI shape; the answer is at `choices[0].message.content`. Errors: `{"error": "..."}` with HTTP 400/500.

**Opt-in streaming** (additive; the default non-streaming shape above is unchanged): add `"stream": true` to the request body and the backend responds with `text/event-stream` SSE — OpenAI-style `chat.completion.chunk` objects (text deltas in `choices[0].delta.content`, then a `finish_reason: "stop"` chunk, then `data: [DONE]`). The frontend does not use this yet.

**Audio endpoints** (both OpenAI-inspired, both `asyncio.to_thread` off the event loop):
- `POST /v1/audio/transcriptions` — multipart form with a `file` field (any ffmpeg-readable audio). Response: `{"text": "..."}`. Errors: `{"error": "..."}` with 400/500.
- `POST /v1/audio/speech` — JSON `{"text": "..."}`. Response: raw WAV bytes (`Content-Type: audio/wav`, 16-bit PCM mono 22050 Hz). Errors: `{"error": "..."}` with 400/500.

Frontend-side handling (`Frontend/src/api.js`):
- `<think>…</think>` blocks are stripped from answers (thinking-model artifacts).
- Client timeout is **120 s** (`TIMEOUT_MS`) — with the model warm, answers typically take **~3 s** (see Performance below).
- **Health probe**: the backend has no health route, so the header pill POSTs an empty body every 15 s; the backend's cheap 400 path proves it's alive without invoking the LLM. Since inference runs off the event loop, the probe stays fast even mid-generation.

## Performance

- **Warm requests** (model already loaded): ~3 s typical (measured 2.4–8 s across all 24 section intros on llama3.1:8b) — each request logs `RAG timing: retrieval Xs, generation Ys` so you can see the split.
- **Cold start**: loading llama3.1:8b (~4.9 GB) takes a few seconds. The backend pre-warms at startup (`before_serving`), and `keep_alive: 30m` keeps the model in GPU memory between requests, so users only hit a cold load after 30+ minutes of idle.
- Answers are capped at 512 tokens (`num_predict`) — intentional for concise course Q&A; raise it in `RAG/config.yaml` if answers get cut off.
- **STT/TTS**: both lazy-load on first use, so the *first* transcription (~model load) and first speech request (~63 MB voice download) are slower; warm requests are fast (speech synthesis ~0.1–0.2 s per sentence on CPU).

## Configuration

| Source | Controls |
|---|---|
| `RAG/config.yaml` | LLM model + generation options (`keep_alive`, `num_predict`, `num_ctx`, `temperature`), embedding model, chunk size/overlap, retrieval k (currently 5), Chroma directory + collection name, STT (`stt:` — whisper model/device/compute type), TTS (`tts:` — provider-scoped: `piper` voice/dirs, legacy `coqui` preserved) |
| `Frontend/.env.example` → `.env` | `VITE_API_URL` (default empty = same-origin via the Vite proxy) |
| `Frontend/vite.config.js` | Network binding (`host: true`) and the `/v1` proxy target |

**Important:** the backend opens `RAG/config.yaml` relative to the current working directory — always start `RAG/__init__.py` and `RAG/ingest.py` **from the project root**.
