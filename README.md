# Kelley-HOPE-25---E-Learning-Project

## Overview

This project is a Retrieval-Augmented Generation (RAG) e-learning system with a React frontend and a Python backend.

* **Frontend**: Prompt-engineering course tutor — a course navigation sidebar plus a chat interface that answers as an encouraging teacher, grounded in the embedded course material. Voice I/O: a 🎤 mic button transcribes spoken questions, and a 🔊 button on each answer plays it aloud.
* **Backend**: Handles PDF ingestion, embedding, vector storage, LLM-based retrieval, speech-to-text (faster-whisper), and text-to-speech (Piper) — all running locally on the DGX.

## Documentation

* [docs/SETUP.md](docs/SETUP.md) — **start here**: copy-paste commands to get both servers running from any teammate's account.
* [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how everything fits together: data flow from browser to Ollama/ChromaDB, component map, API contract, config sources.
* [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) — symptom → fix for every failure we've hit (connection refused, empty vector store, wrong env, slow responses, …). **Check here first when something breaks.**
* [docs/UPDATING_CONTENT.md](docs/UPDATING_CONTENT.md) — how to swap course PDFs, edit the course outline, tune the tutor prompts, or switch the LLM.
* [docs/PIPER_TTS_NOTES.md](docs/PIPER_TTS_NOTES.md) — TTS implementation log: why Piper (not Riva), what was tested, what's still open.
* [docs/DISCOVERY.md](docs/DISCOVERY.md) — project audit and the local-first migration roadmap (STT/TTS done; avatar pending).
* [docs/CLAUDE.md](docs/CLAUDE.md) — context for Claude Code sessions (commands, constraints).
* [Frontend/README.md](Frontend/README.md) — frontend-specific setup and notes.

## Folder Structure
```
/Frontend                  (Vite + React app)
    ├── index.html
    ├── package.json
    ├── .env.example       (VITE_API_URL)
    └── src/
        ├── App.jsx        (layout: header / course sidebar / chat)
        ├── api.js         (backend client: chat, health check,
                            transcription, speech synthesis)
        ├── course.js      (hardcoded course modules & sections)
        ├── hooks/         (useChat, useCourse)
        └── components/    (Header, CourseNav, ChatPanel, AvatarBanner,
                            MessageList, InputBar)

/RAG
    ├── __init__.py
    ├── rag.py
    ├── embedding.py
    ├── pdfprocess.py
    ├── ingest.py
    ├── config.yaml
    └── ... (Python backend files)
```
## Setup Instructions

**Backend (Python in RAG)**

1. **Install dependencies**
    * A conda environment spec is provided: `conda env create -f environment.yml` (env name `digital-human`)

2. **Configure YAML**
    * Edit `RAG/config.yaml` to set model names, chunk sizes, and other parameters
    * Requires Ollama running at http://localhost:11434 with the configured models pulled (LLM `llama3.1:8b` — see `llm.ollama_model`, embeddings `nomic-embed-text`)

3. **Embed course material**
    ```
    conda run -n digital-human --cwd <project root> python RAG/ingest.py
    ```

4. **Run the backend** (from the project root — config paths are CWD-relative)
    ```
    conda run -n digital-human --cwd <project root> python RAG/__init__.py
    ```
    * Serves http://localhost:5000 with `/v1/chat/completions` (OpenAI-compatible chat), `/v1/audio/transcriptions` (STT), and `/v1/audio/speech` (TTS)

**Frontend (React in /Frontend)**

1. **Install Node (no sudo)**
    ```
    conda install -n digital-human -c conda-forge "nodejs>=22"
    ```

2. **Install dependencies and run**
    ```
    conda activate digital-human
    cd Frontend
    npm install
    npm run dev
    ```
    * App runs on http://localhost:5173
    * Backend URL is configurable via `VITE_API_URL` (copy `.env.example` to `.env`); defaults to http://localhost:5000. No secrets required.

## Team Access on the DGX

Everyone on the team SSHes into the same machine (`129.79.199.105`), so the app only needs to run **once** for everyone.

**Just using the app:** if the servers are already running, open http://129.79.199.105:5173/ in your browser. Nothing to install or run.

**Starting (or restarting) the servers** — run them in a shared tmux session so they survive SSH disconnects:

```bash
tmux new -s digital-human    # or: tmux attach -t digital-human  (if it exists)

# window 1 — backend:
cd /home/hope-intern04/digital-human
conda activate digital-human
python RAG/__init__.py

# Ctrl+B then C to open a second window — frontend:
cd /home/hope-intern04/digital-human/Frontend
conda activate digital-human
npm run dev

# Ctrl+B then D to detach; servers keep running
```

Notes for teammates:

* The project lives at `/home/hope-intern04/digital-human` (world-writable so everyone can edit).
* The `digital-human` conda env belongs to hope-intern04. If `conda activate digital-human` doesn't work from your account, call its Python directly: `/home/hope-intern04/miniconda3/envs/digital-human/bin/python`.
* If git complains about "dubious ownership", run once: `git config --global --add safe.directory /home/hope-intern04/digital-human`
* Ports are shared machine-wide: backend on 5000, frontend on 5173 — only one instance of each should run at a time.
* Ollama must be running on the DGX at http://localhost:11434 with `llama3.1:8b` and `nomic-embed-text` pulled.

## Key Components

**Backend**

* rag.py: Main orchestration for RAG, embedding, retrieval, STT (faster-whisper), and TTS (Piper).
* embedding.py: Handles document embedding and storage in ChromaDB.
* pdfprocess.py: Loads and splits PDFs into chunks for embedding.
* ingest.py: Standalone script that embeds the course PDF into ChromaDB.
* config.yaml: Central configuration for models, chunking, TTS, etc.
* __init__.py: Quart API exposing /v1/chat/completions for chat.

**Frontend**

* src/App.jsx: Layout and wiring — course selection enriches chat queries with the current module/section as teaching context; selecting a section auto-requests a brief intro.
* src/course.js: The hardcoded course outline (4 modules: Foundations, Beginner, Intermediate, Advanced techniques).
* src/components/AvatarBanner.jsx: Placeholder slot where a future digital-human avatar mounts (see DISCOVERY.md for the local avatar roadmap).

## Development Notes

* **PDF Embedding:**
    Run `python RAG/ingest.py` from the project root to process and store the course PDF (`RAG/example_data/pe2_staff.pdf`).
* **LLM Switching:**
    The backend uses Ollama by default (`llm.ollama_model` in config.yaml); a Gemini path exists in code but is commented out.
* **Speech-to-text:**
    faster-whisper (`base.en`, CPU) behind `POST /v1/audio/transcriptions`; the model lazy-loads on first use. The frontend mic button requires the page to be served from `localhost` (SSH tunnel) — see docs/TROUBLESHOOTING.md.
* **Text-to-speech:**
    Piper (`en_US-lessac-medium`, CPU) behind `POST /v1/audio/speech`; the voice auto-downloads on first use. Click-to-play 🔊 per assistant message — no autoplay. The old Coqui path is dead code kept for reference. Implementation log: docs/PIPER_TTS_NOTES.md.
* **Avatar:**
    Not currently integrated (TTS is not wired to lip-sync). The old HeyGen prototype was removed; the planned replacement is a locally hosted stack (see docs/DISCOVERY.md).
