# CLAUDE.md

E-learning RAG system: a Vite + React prompt-engineering course tutor (`Frontend/`) talking to a Quart RAG backend (`RAG/`) backed by Ollama + ChromaDB, with local voice I/O — faster-whisper STT (mic button) and Piper TTS (🔊 per assistant bubble). See `docs/ARCHITECTURE.md` for the full data flow.

## Environment

- Shared NVIDIA DGX (aarch64 Ubuntu), **no sudo**. Multiple teammates use this machine — check `ss -tlnp | grep -E '5000|5173'` and `tmux ls` before starting servers.
- Conda env **`digital-human`** has everything: Python 3.10 ML stack **and** Node.js. Use `conda run -n digital-human ...` or activate it.
- Ollama at `http://localhost:11434`; required models: `llama3.1:8b` (LLM — see `llm.ollama_model` in `RAG/config.yaml`), `nomic-embed-text` (embeddings).
- Speech models need no manual install: faster-whisper (`base.en`) and the Piper voice (`en_US-lessac-medium`, → `RAG/tts_models/`) lazy-download on first use. New Python deps go in `pyproject.toml` and are installed with `pip install --user` (this account can't write the shared conda env's site-packages).

## Commands (all from the project root)

```bash
# Embed the course PDF into ChromaDB (idempotent, skips existing chunks)
conda run -n digital-human --cwd /home/hope-intern04/digital-human python RAG/ingest.py

# Backend — http://localhost:5000 (must run from project root: config path is CWD-relative)
conda run -n digital-human --cwd /home/hope-intern04/digital-human python RAG/__init__.py

# Frontend dev server — http://129.79.199.105:5173 (binds all interfaces)
conda run -n digital-human --cwd /home/hope-intern04/digital-human/Frontend npm run dev

# Frontend production build
conda run -n digital-human --cwd /home/hope-intern04/digital-human/Frontend npm run build
```

## Constraints & gotchas

- Backend API contract is OpenAI-style `POST /v1/chat/completions`. The default non-streaming response shape must not change — the frontend depends on it. SSE streaming is available **opt-in** via `"stream": true` (OpenAI `chat.completion.chunk` format); the frontend doesn't use it yet.
- Audio endpoints (frontend depends on both shapes): `POST /v1/audio/transcriptions` (multipart `file` → `{"text"}`) and `POST /v1/audio/speech` (`{"text"}` → WAV bytes). STT/TTS models are lazy singletons in `RAG/rag.py` (`get_whisper_model()`, `get_piper_voice()`) — keep new model loads lazy and off the event loop (`asyncio.to_thread`), matching the existing pattern.
- The mic button only works over a secure context (`localhost` via SSH tunnel) — a plain-HTTP IP address hides `navigator.mediaDevices`; see `docs/TROUBLESHOOTING.md`. `RAG/tts_output/` accumulates a WAV per speech request with no cleanup yet (gitignored, as is `RAG/tts_models/`).
- The browser reaches the backend through the **Vite `/v1` proxy** (`Frontend/vite.config.js`); the backend stays bound to 127.0.0.1. Don't hardcode `localhost:5000` in frontend code — use `VITE_API_URL`/same-origin via `Frontend/src/config.js`.
- LLM responses take ~3 s warm (llama3.1:8b, temperature 0). The RAG chain is a startup-built singleton (`get_qa_chain()` in `RAG/rag.py`) and the backend pre-warms the model; `keep_alive: 30m` + `num_predict`/`num_ctx`/`temperature` live in `RAG/config.yaml`. Inference runs via `asyncio.to_thread` — don't call `run_rag()` directly on the event loop. Each request logs `RAG timing: retrieval Xs, generation Ys`. Client timeout is 120 s (`TIMEOUT_MS` in `Frontend/src/api.js`).
- TTS is **Piper** (chosen over NVIDIA Riva — see `docs/PIPER_TTS_NOTES.md`). Coqui TTS and HeyGen were deliberately removed — do not reinstall Coqui or reintroduce HeyGen (the dead Coqui code path and its `tts.coqui` config are intentionally preserved but inert). TTS is click-to-play only and not wired to the avatar; the avatar's decided home is the **agent panel** in the upcoming slide-primary layout (`AvatarBanner.jsx` is slated for deletion — don't build against it).
- Course outline is hardcoded in `Frontend/src/course.js`; tutor prompt templates live in `Frontend/src/App.jsx` and `Frontend/src/hooks/useChat.js` (see `docs/UPDATING_CONTENT.md`).
- No test suite. Verify changes by running both servers and exercising the chat (see `docs/TROUBLESHOOTING.md` for known failure modes).
