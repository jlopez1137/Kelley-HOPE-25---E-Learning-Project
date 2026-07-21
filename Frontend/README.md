# Frontend — Prompt Engineering Tutor

A Vite + React chat interface for the digital-human RAG backend. Students navigate a
prompt-engineering course in the left sidebar; the chat answers as an encouraging
tutor, grounded in the course PDF embedded in the backend's vector store.

## Prerequisites

- Node.js ≥ 20.19 (installed via conda-forge on this machine — no sudo needed):
  ```bash
  conda install -n digital-human -c conda-forge "nodejs>=22"
  ```
- The Quart RAG backend running on port 5000 (see the root README).

## Run

```bash
conda activate digital-human   # puts node/npm on PATH
cd Frontend
npm install
npm run dev                    # http://localhost:5173
```

Production build: `npm run build && npm run preview`.

## Configuration

The backend URL comes from the `VITE_API_URL` env var (default `http://localhost:5000`).
Copy `.env.example` to `.env` to override. No secrets are needed.

## Notes

- **Latency**: the backend runs llama3.1:8b via Ollama (previously 70b) — warm
  responses take ~3 s. The UI shows a thinking indicator with an elapsed-time
  counter, and the client timeout is 120 s (`TIMEOUT_MS` in `src/api.js`).
- **Course structure** is hardcoded in `src/course.js` (4 modules of sections).
  Clicking a section marks it complete, updates the progress bar, and auto-requests
  a short intro from the tutor. Questions are sent with the current module/section
  prepended as teaching context.
- **Connection status** in the header polls the chat endpoint with an empty body
  every 15 s (the backend has no health route; its cheap 400 path is used as a probe).
- **Avatar**: not integrated yet. A future avatar component (HeyGen, or a local
  LivePortrait/NVIDIA ACE video — see ../DISCOVERY.md) mounts as children of
  `src/components/AvatarBanner.jsx` without any layout changes.
