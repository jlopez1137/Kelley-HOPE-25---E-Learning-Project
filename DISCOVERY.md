# Project Discovery & Audit

## 1. 3rd-Party & Cloud Dependencies Map
Create a markdown table detailing every external API or cloud service used. Look specifically for HeyGen, OpenAI, or any other non-local tools.
* Columns: File Path | Service Name (e.g., HeyGen) | What it does | Is it a hard dependency? (Y/N)

| File Path | Service Name | What it does | Is it a hard dependency? (Y/N) |
|---|---|---|---|
| digital-human/Frontend/src/SimpleChatUI.jsx | HeyGen (@heygen/streaming-avatar) | Streaming avatar SDK used to open a media stream, perform lip-sync and provide cloud TTS via the HeyGen service; frontend constructs `new StreamingAvatar({ token: '' })` and calls `avatar.speak(...)` | Y |
| digital-human/Frontend/package.json | @heygen/streaming-avatar (npm) | NPM package that provides the HeyGen Streaming Avatar SDK used by the frontend | Y |
| digital-human/Frontend/src/SimpleChatUI.jsx | ElevenLabs (voice model, referenced via HeyGen SDK) | Voice-model enum used by the HeyGen SDK to select ElevenLabs-based voices (invoked through HeyGen) | N (indirect / proxied through HeyGen) |
| digital-human/RAG/embedding.py | Ollama (ollama python client) | Used to request embeddings (`ollama.embed(...)`) and used via LangChain as the LLM backend (`Ollama(...)`) — typically backed by a local Ollama server | Y |
| digital-human/RAG/rag.py | Google Gemini (langchain_google_genai) | Optional / commented integration for Google Gemini (requires `GOOGLE_API_KEY` and `GEMINI_MODEL`); cloud LLM if enabled | N |
| digital-human/RAG/config.yaml | nomic-embed-text (Nomic embeddings) | Embedding model name present in config (Nomic embedding service would be a cloud provider if used) | N |
| digital-human/RAG/rag.py | PostHog | Analytics library imported then explicitly disabled (`posthog.disabled = True`) | N |
| digital-human/RAG/rag.py & digital-human/RAG/config.yaml | Coqui TTS (`coqui-tts`) | Local TTS engine instantiated in `rag.py` (`TTS(CONFIG['tts']['model'])`) and configured in `config.yaml`; backend exposes `tts` / `tts_async` but the HTTP handler currently has the TTS call commented out | N |
| digital-human/RAG/config.yaml | ChromaDB | Local vector store (Chroma) used for retrieval | N |
| digital-human/README.md and digital-human/Frontend/.env (expected) | HeyGen API key | README instructs storing the HeyGen API key in `/Frontend/.env`. `SimpleChatUI.jsx` currently uses a hard-coded placeholder token and a TODO to pull from env | Y |
| digital-human/RAG/__init__.py | OpenAI (response format only) | Backend emits OpenAI-compatible chat completion JSON, but does not call OpenAI APIs | N |
| digital-human/pyproject.toml | langchain-google-genai (package) | Python package enabling Google/Gemini integration (cloud) — present as a dependency | N |

## 2. Pipeline Exploration
Based on your read of the code, briefly summarize how the data flows for:

* **Audio (STT/TTS):**
  - STT: The frontend uses the browser's Web Speech API (`window.SpeechRecognition` / `webkitSpeechRecognition`) in `SimpleChatUI.jsx` to capture voice and transcribe to text locally in the browser; the transcript is submitted to the backend like text input. Note: while the Web Speech API runs locally in the browser, the plan is to replace it with a backend DGX-hosted OpenAI Whisper model.
  - TTS: The primary, active path in the UI is HeyGen: the frontend calls `avatar.speak({ text: ... })` on the HeyGen StreamingAvatar instance which streams audio/video from HeyGen (cloud). The backend also includes a local TTS path via Coqui (`coqui-tts`) instantiated in `rag.py` with `tts` / `tts_async` helpers, but the server-side async TTS call is commented out in `__init__.py`, so Coqui is present but not used by the HTTP endpoint by default.

* **Visuals (Lip-Sync/Avatar):**
  - The frontend initializes `StreamingAvatar` from `@heygen/streaming-avatar`, calls `createStartAvatar(...)` with an `avatarName`, and listens for `STREAM_READY` to attach the returned MediaStream to a `<video id="heygen-avatar">` element. Lip-sync and avatar animation are produced server-side by HeyGen and streamed to the browser.

* **Brain (LLM):**
  - Frontend → Backend: The React app POSTs OpenAI-style JSON to `/v1/chat/completions` on the Quart backend (`__init__.py`).
  - Backend: `__init__.py` extracts the user query and calls `run_rag(query)` (from `rag.py`).
  - RAG pipeline: `rag.py` constructs embeddings (uses an embedding model name from `config.yaml`), initializes a Chroma vector store, and builds a `RetrievalQA` chain with an LLM. The current active LLM integration in code is Ollama (`Ollama(...)` + `ollama.embed(...)` in `embedding.py`), so retrieval and generation are performed with local Ollama models and Chroma retrieval. There is commented code and installed packages for Google Gemini (`langchain_google_genai`) which would make the LLM a cloud service if enabled.

## 3. Configuration & Missing Setup
List the gaps you found in your initial scan (e.g., missing .env variables, Ollama local assumptions, PDF input paths) so the team knows what needs to be documented.

- `.env` files are missing: the repo does not contain `/Frontend/.env` or a project root `.env`. The code and README expect both locations but no template or example is provided.
- HeyGen API key usage: `SimpleChatUI.jsx` currently constructs `new StreamingAvatar({ token: '' })` with an inline placeholder and a TODO comment to "Use env variable"; the README says to put a HeyGen key in `/Frontend/.env` but the exact env variable name is not defined in code or README. This is a critical missing piece to run HeyGen.
- Embedding provider mismatch: `config.yaml` lists `embedding_model: nomic-embed-text`, but the code in `embedding.py` uses `ollama.embed(...)` and `rag.py` constructs `OllamaEmbeddings(...)`. That is inconsistent and needs clarification (which embedding provider is actually intended).
- Optional cloud LLMs present but undocumented: `rag.py` imports `ChatGoogleGenerativeAI` and has commented code expecting `GEMINI_MODEL` and `GOOGLE_API_KEY`. `langchain-google-genai` is present in `pyproject.toml` but there are no instructions for enabling Gemini or obtaining credentials.
- Ollama assumptions: The backend expects `ollama` (and local Ollama models) to be available; there are no setup instructions (install, run daemon, model download) documented in README.
- PDF ingestion path unclear: `PDFProcessor` builds file paths under `./example_data/{filename}`; README mentions `embed_pdf('filename.pdf')` but not where to place PDFs or how to supply them to the pipeline.
- ChromaDB persistence: `config.yaml` sets `chroma_db.persist_directory: ./chroma_db`, but no guidance on wiping/migrating or verifying the DB contents is provided.
- Coqui TTS model setup: `config.yaml` references a Coqui model string and `rag.py` instantiates the TTS model; model download / runtime dependencies (PyTorch, audio drivers) are not documented.
- PostHog analytics: `posthog` is imported and immediately disabled. The presence in code and `poetry.lock` might be confusing; document whether analytics should be removed or configured.
- Frontend environment usage: the frontend does not currently read a real environment variable for the HeyGen token; this should be explicitly documented or implemented.

---

This discovery file was generated by scanning `digital-human/Frontend/src/SimpleChatUI.jsx`, `digital-human/RAG/rag.py`, `digital-human/RAG/config.yaml`, `digital-human/RAG/__init__.py`, `digital-human/RAG/embedding.py`, and the repository manifests. No changes were made to source files.

## 4. Target Local Replacements

Planned DGX upgrades:

| Component | Target Local Replacement |
|---|---|
| STT (browser SpeechRecognition) | OpenAI Whisper (hosted on DGX) |
| TTS (HeyGen / Coqui) | NVIDIA Riva |
| Lip-Sync / Avatar | NVIDIA ACE or LivePortrait (DGX-hosted) |
