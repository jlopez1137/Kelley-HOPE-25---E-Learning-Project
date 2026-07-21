# Project Discovery & Audit v3.0

## 0a. Revision v3.0 Summary (2026-07-07): Local-First Milestone Reached

Major changes since v2.0 — several items below in the v2.0 baseline are now **historical**:

- **HeyGen is fully removed.** The old CRA frontend (including `SimpleChatUI.jsx` and the `@heygen/streaming-avatar` dependency) was deleted and replaced with a Vite + React **prompt-engineering course tutor** (course sidebar + chat). There are **no cloud dependencies left** — no HeyGen, no ElevenLabs, no cloud STT/TTS.
- **STT/TTS are currently absent by design.** v1 of the new frontend is text-only; the Web Speech API mic was not carried over. The Coqui TTS path in the backend is now optional (wrapped in try/except; the backend starts cleanly without it).
- **Avatar**: a placeholder slot exists at `Frontend/src/components/AvatarBanner.jsx` — a future local avatar (NVIDIA ACE / LivePortrait per section 4) mounts as its children with no layout changes.
- **LLM stack modernized**: langchain 1.x with an LCEL chain (`retriever → prompt → ChatOllama → parser`) replacing the removed `RetrievalQA`; model is now `llama3.1:8b` (was deepseek-r1/qwen3, then `llama3.1:70b`).
- **Env/secret blockers resolved**: no secrets are required anywhere. The only frontend variable is optional `VITE_API_URL` (documented in `Frontend/.env.example`); the browser reaches the backend via the Vite `/v1` proxy.
- **Setup docs completed**: see the root `README.md` (setup + team access on the shared DGX), `docs/ARCHITECTURE.md`, `docs/TROUBLESHOOTING.md`, and `docs/UPDATING_CONTENT.md`. PDF ingestion is now a documented script (`RAG/ingest.py`, course PDF `RAG/example_data/pe2_staff.pdf`, ChromaDB collection `tcp_redbook`).

Updated section 4 status:

| Component | Current State (v3.0) | Planned Local Replacement |
|---|---|---|
| STT | faster-whisper, local on DGX (`POST /v1/audio/transcriptions`) — see below | Done |
| TTS | Piper, local on DGX (`POST /v1/audio/speech`) with a click-to-play 🔊 button per assistant chat bubble — see below | Done for backend + frontend; avatar/lip-sync wiring pending |
| Lip-Sync / Avatar | Placeholder slot in `AvatarBanner.jsx` (HeyGen removed) | NVIDIA ACE or LivePortrait (DGX-hosted) |

**Update (this revision):** STT and TTS both landed as local, DGX-hosted services — not the originally planned OpenAI Whisper / NVIDIA Riva. STT uses `faster-whisper` (CPU, `int8`, mirrors this section's existing local-first spirit at a fraction of Riva's operational complexity); TTS uses `Piper` (CPU, ONNX voices) instead of NVIDIA Riva, chosen for the same reason — a pip-installable, no-server-to-run local engine, since Riva needs a full Triton/Riva server deployment that isn't justified yet on a shared dev box. See `docs/PIPER_TTS_NOTES.md` for the TTS implementation log and `docs/TROUBLESHOOTING.md` for setup/testing of both.

> The v2.0 content below is preserved as the historical baseline. Where it names `SimpleChatUI.jsx`, HeyGen, ElevenLabs, `RetrievalQA`, or missing `.env`/setup docs, treat those as resolved/removed per this summary.

---

# (Historical) Project Discovery & Audit v2.0

## 0. Revision Summary: What Changed Since the Baseline
This revision refreshes the original audit without changing its core baseline. The original discovery documented a prototype that was still cloud-dependent in its avatar and speech layers, with a RAG backend powered by Ollama and ChromaDB.

What changed since the baseline version of this document:
- The current implementation still uses the same core architecture in the inspected files: a React chat UI, a Quart backend, a PDF-driven RAG pipeline, and a HeyGen-based avatar experience.
- The audit now clearly distinguishes between the current implementation and the planned local-first target architecture.
- The local replacement path is now framed as an explicit migration plan: STT -> OpenAI Whisper on DGX, TTS -> NVIDIA Riva, and lip-sync/avatar -> NVIDIA ACE or LivePortrait.
- The document also calls out that the main blockers remain environmental and operational rather than architectural: missing `.env` guidance, missing secret handling for HeyGen, and incomplete local setup documentation.

> In short: the baseline remains the same, but this v2.0 version makes the migration direction and remaining blockers more explicit for the team.

## 1. 3rd-Party & Cloud Dependencies Map
Create a markdown table detailing every external API or cloud service used. Look specifically for HeyGen, OpenAI, or any other non-local tools.
* Columns: File Path | Service Name (e.g., HeyGen) | What it does | Is it a hard dependency? (Y/N)

| File Path | Service Name | What it does | Is it a hard dependency? (Y/N) |
|---|---|---|---|
| digital-human/Frontend/src/SimpleChatUI.jsx | HeyGen (@heygen/streaming-avatar) | Streaming avatar SDK used to open a media stream, perform lip-sync and provide cloud TTS via the HeyGen service; the frontend constructs `new StreamingAvatar({ token: '' })` and calls `avatar.speak(...)` | Y |
| digital-human/Frontend/package.json | @heygen/streaming-avatar (npm) | NPM package that provides the HeyGen Streaming Avatar SDK used by the frontend | Y |
| digital-human/Frontend/src/SimpleChatUI.jsx | ElevenLabs (voice model, referenced via HeyGen SDK) | Voice-model enum used by the HeyGen SDK to select ElevenLabs-based voices (invoked through HeyGen) | N (indirect / proxied through HeyGen) |
| digital-human/RAG/embedding.py | Ollama (Python client) | Used to request embeddings (`ollama.embed(...)`) and used via LangChain as the LLM backend (`Ollama(...)`) — typically backed by a local Ollama server | Y |
| digital-human/RAG/rag.py | Google Gemini (langchain_google_genai) | Optional / commented integration for Google Gemini (requires `GOOGLE_API_KEY` and `GEMINI_MODEL`); cloud LLM if enabled | N |
| digital-human/RAG/config.yaml | nomic-embed-text (Nomic embeddings) | Embedding model name present in config; this remains a potential provider dependency and should be clarified | N |
| digital-human/RAG/rag.py | PostHog | Analytics library imported then explicitly disabled (`posthog.disabled = True`) | N |
| digital-human/RAG/rag.py & digital-human/RAG/config.yaml | Coqui TTS (`coqui-tts`) | Local TTS engine instantiated in `rag.py` and configured in `config.yaml`; backend helpers exist, but the HTTP path currently leaves the speech call commented out | N |
| digital-human/RAG/config.yaml | ChromaDB | Local vector store (Chroma) used for retrieval | N |
| digital-human/README.md and digital-human/Frontend/.env (expected) | HeyGen API key | The README expects a HeyGen key in the frontend environment, but the code still uses a placeholder token and no clear env var contract is documented | Y |
| digital-human/RAG/__init__.py | OpenAI (response format only) | The backend emits OpenAI-compatible chat completion JSON, but it does not call OpenAI APIs directly | N |
| digital-human/pyproject.toml | langchain-google-genai (package) | Python package enabling Google/Gemini integration (cloud) — present as an optional dependency | N |

## 2. Pipeline Exploration
Based on the current code, this is how the data flows today:

* **Audio (STT/TTS):**
  - STT: The frontend uses the browser's Web Speech API (`window.SpeechRecognition` / `webkitSpeechRecognition`) in `SimpleChatUI.jsx` to capture voice and transcribe to text locally in the browser; the transcript is then submitted to the backend like normal text input. This remains the current implementation, but it is the first component slated for replacement with a backend DGX-hosted OpenAI Whisper model.
  - TTS: The primary active path in the UI is HeyGen. The frontend calls `avatar.speak({ text: ... })` on the HeyGen StreamingAvatar instance, which streams audio and video from the HeyGen service. The backend also contains a Coqui TTS path for local synthesis, but that path is not active in the HTTP flow.

* **Visuals (Lip-Sync/Avatar):**
  - The frontend initializes `StreamingAvatar` from `@heygen/streaming-avatar`, calls `createStartAvatar(...)`, and listens for `STREAM_READY` to attach the returned media stream to a `<video>` element. Lip-sync and avatar animation are therefore still being produced by HeyGen and streamed into the browser.

* **Brain (LLM):**
  - Frontend → Backend: The React app sends OpenAI-style JSON to `/v1/chat/completions` on the Quart backend.
  - Backend: `__init__.py` extracts the user query and calls `run_rag(query)` from `rag.py`.
  - RAG pipeline: `rag.py` initializes embeddings, a Chroma vector store, and a retrieval chain. The current active LLM integration is Ollama, while Gemini remains an optional commented path.

## 3. Configuration & Missing Setup
The gaps identified in the original audit still apply, and they remain the main blockers for a local-first migration.

- `.env` files are still missing or undocumented: the repo does not contain a frontend `.env` or a project-root `.env`, even though the code and README expect them.
- HeyGen secret handling remains unresolved: the frontend still uses a placeholder token and the README points to a frontend `.env`, but the actual env var contract is still not defined.
- Embedding provider setup is still ambiguous: `config.yaml` points to an embedding model name, but the backend code uses Ollama-based embedding calls.
- Optional cloud LLM paths remain undocumented: Gemini support is still present as commented code and an optional dependency, but there is no documented local or cloud setup path.
- Ollama assumptions remain a setup requirement: the backend expects Ollama and a model to be available, but setup instructions are still incomplete.
- PDF ingestion workflow is still underspecified: the processor expects files under `./example_data`, but the repo does not document how PDFs should be placed or verified.
- ChromaDB persistence and verification are still undocumented.
- Coqui TTS setup is still not fully documented, including model download and runtime dependencies.

## 4. Target Local Replacements
The migration target remains the same as the original plan, but it is now explicitly framed as the local replacement roadmap.

| Component | Current State | Planned Local Replacement |
|---|---|---|
| STT | Browser Web Speech API | OpenAI Whisper (hosted on DGX) |
| TTS | HeyGen / Coqui TTS path | NVIDIA Riva |
| Lip-Sync / Avatar | HeyGen streaming avatar | NVIDIA ACE or LivePortrait (DGX-hosted) |

---

This discovery file was refreshed from the original baseline and updated to reflect the current state of the repository as of this revision. No implementation changes were made in the codebase during this audit refresh; this document is meant to make the current architecture and migration plan clearer for the team.
