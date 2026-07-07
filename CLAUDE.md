# CLAUDE.md

E-learning RAG system: a Vite + React prompt-engineering course tutor (`Frontend/`) talking to a Quart RAG backend (`RAG/`) backed by Ollama + ChromaDB. See `docs/ARCHITECTURE.md` for the full data flow.

## Environment

- Shared NVIDIA DGX (aarch64 Ubuntu), **no sudo**. Multiple teammates use this machine — check `ss -tlnp | grep -E '5000|5173'` and `tmux ls` before starting servers.
- Conda env **`digital-human`** has everything: Python 3.10 ML stack **and** Node.js. Use `conda run -n digital-human ...` or activate it.
- Ollama at `http://localhost:11434`; required models: `llama3.1:70b` (LLM), `nomic-embed-text` (embeddings).

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

- Backend API contract is OpenAI-style `POST /v1/chat/completions` (non-streaming). The frontend depends on this shape — don't change it.
- The browser reaches the backend through the **Vite `/v1` proxy** (`Frontend/vite.config.js`); the backend stays bound to 127.0.0.1. Don't hardcode `localhost:5000` in frontend code — use `VITE_API_URL`/same-origin via `Frontend/src/config.js`.
- LLM responses take 30–60 s (llama3.1:70b). Client timeout is 120 s (`TIMEOUT_MS` in `Frontend/src/api.js`).
- Coqui TTS and HeyGen were deliberately removed/optional — do not reinstall Coqui or reintroduce HeyGen. The future avatar mounts as children of `Frontend/src/components/AvatarBanner.jsx`.
- Course outline is hardcoded in `Frontend/src/course.js`; tutor prompt templates live in `Frontend/src/App.jsx` and `Frontend/src/hooks/useChat.js` (see `docs/UPDATING_CONTENT.md`).
- No test suite. Verify changes by running both servers and exercising the chat (see `docs/TROUBLESHOOTING.md` for known failure modes).
