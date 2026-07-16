# Troubleshooting

Real problems this project has hit, with fixes. Commands assume you're SSH'ed into the DGX.

## Quick diagnosis

```bash
ss -tlnp | grep -E '5000|5173'    # are the backend (5000) and frontend (5173) running?
ollama list                        # are llama3.1:70b and nomic-embed-text pulled?
ollama ps                          # is llama3.1:70b loaded in GPU memory? (should stay ~30 min after last use)
```

---

### Browser says ERR_CONNECTION_REFUSED on http://localhost:5173

The servers run **on the DGX**, not on your laptop — `localhost` in your browser points at your own machine.

**Fix:** use `http://129.79.199.105:5173/` instead. (Alternative: SSH tunnel with `ssh -L 5173:localhost:5173 <user>@129.79.199.105`, then localhost works.)

Note: only the Vite frontend listens on the network. The backend is bound to 127.0.0.1 **by design** — the browser reaches it through Vite's `/v1` proxy.

### Header pill says "Backend unreachable" but the backend is running

Your browser is probably running stale JavaScript from before a frontend change.

**Fix:** hard refresh — `Ctrl+Shift+R` (or `Cmd+Shift+R`). If it persists, confirm the backend really is up: `ss -tlnp | grep 5000`, and check the terminal/tmux window where it runs for a traceback.

### `ModuleNotFoundError` (e.g. `No module named 'langchain.chains'`, `yaml`, `quart`)

You're using the wrong Python — the system one instead of the project env.

**Fix:** `conda activate digital-human` first. If your account can't activate it, call it directly:
`/home/hope-intern04/miniconda3/envs/digital-human/bin/python`

### Backend logs "No documents found in the vector store"

ChromaDB is empty — the course PDF hasn't been embedded (or `chroma_db/` was deleted).

**Fix:** from the project root: `python RAG/ingest.py` (takes a while; prints progress per chunk).

### Errors mentioning port 11434, or Ollama connection refused

Ollama isn't running or the models aren't pulled.

**Fix:** `ollama serve` (if not already a service), then verify `ollama list` shows **llama3.1:70b** and **nomic-embed-text**; `ollama pull <model>` for any missing.

### Responses are slow

With the model warm, llama3.1:70b typically takes **15–25 seconds** per answer; the UI shows "Thinking… Ns" while it works and gives up at 120 s (constant `TIMEOUT_MS` in `Frontend/src/api.js`).

Diagnose where the time goes: the backend logs `RAG timing: retrieval Xs, generation Ys` for every request. If generation dominates and is much slower than usual, check GPU load (`nvidia-smi`) — someone else may be using the card. If *every* request is slow, check the model is actually staying loaded (next entry).

### First request is much slower than the rest (cold start)

Loading llama3.1:70b (~43 GB) into GPU memory takes 20–30 s. Two mechanisms normally hide this:

- the backend **pre-warms at startup** (`before_serving` in `RAG/__init__.py`) — the chain is built and the model loaded before the first user request;
- `keep_alive: 30m` in `RAG/config.yaml` keeps the model resident between requests.

So a cold hit should only happen if the backend just started (warmup still in flight) or nobody asked anything for 30+ minutes. Verify residency with `ollama ps` — it should list llama3.1:70b with an expiry ~30 min out. If teammates need the GPU memory back sooner, lower `keep_alive`; if you're demoing all day, raise it.

### Answers get cut off mid-sentence (truncation)

Generation is capped at **512 tokens** (`num_predict` in `RAG/config.yaml`) to keep course Q&A answers concise and fast. If answers are visibly truncated, raise `num_predict` (e.g. 1024) and restart the backend. Also check `num_ctx` (4096): if you increase `retrieve_k` or chunk size, the context window must still fit retrieved chunks + question + answer.

### "Address already in use" when starting a server

Someone (or a forgotten tmux session) is already running it — ports 5000/5173 are shared machine-wide.

**Fix:** `ss -tlnp | grep -E '5000|5173'` shows the PID and owner. Check `tmux ls` for an existing `digital-human` session before starting your own. Usually the right move is to *use* the running instance, not start another.

### `FileNotFoundError: RAG/config.yaml` (or ingest.py exits complaining about the root)

The backend and ingest script resolve paths relative to the **current working directory**.

**Fix:** always run them from the project root: `cd /home/hope-intern04/digital-human` first.

### git: "detected dubious ownership in repository"

The repo belongs to hope-intern04 and you're a different user.

**Fix (once per account):**
```bash
git config --global --add safe.directory /home/hope-intern04/digital-human
```

### Mic button does nothing / "Recording needs HTTPS or localhost"

Browsers only allow microphone access (`getUserMedia`/`MediaRecorder`) on **secure contexts**: `https://` origins, or `http://localhost`/`127.0.0.1`. Opening the app at `http://129.79.199.105:5173/` is plain HTTP on a non-localhost address, so `navigator.mediaDevices` doesn't exist and the mic button fails silently (as of this fix, it now shows a red error message under the input bar instead).

**Fix:** SSH tunnel so the page is served to your browser as `localhost`:
```bash
ssh -L 5173:localhost:5173 -L 5000:localhost:5000 <user>@129.79.199.105
```
then open `http://localhost:5173/` (not the `129.79.199.105` address) in your **local** browser. Chat and other features work fine either way — this only matters for the mic.

### Frontend build/dev fails with "node: command not found"

Node lives inside the conda env, not system-wide.

**Fix:** `conda activate digital-human` (or reinstall: `conda install -n digital-human -c conda-forge "nodejs>=22"`).

### Piper TTS (`POST /v1/audio/speech`) setup, testing, and known limitations

**Setup:** `piper-tts` installs cleanly on this aarch64 DGX (prebuilt wheel, no compilation) via:
```bash
/home/hope-intern04/miniconda3/envs/digital-human/bin/python -m pip install --user "piper-tts>=1.4.2,<2.0.0"
```
(`--user` because, like the other Python deps, this account can't write to the shared conda env's own `site-packages` — see the `ModuleNotFoundError` entry above.) `pyproject.toml` documents the pin.

No manual voice download step is needed — the backend lazy-downloads the configured voice (`tts.piper.model` in `RAG/config.yaml`, default `en_US-lessac-medium`, ~63 MB) into `tts.piper.model_dir` (default `RAG/tts_models/`) on the **first** `/v1/audio/speech` request. Subsequent requests reuse the cached model and voice object (same lazy-singleton pattern as Whisper in `RAG/rag.py`).

**Test command:**
```bash
curl -X POST http://127.0.0.1:5000/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{"text":"Prompt engineering is the practice of designing inputs for AI tools."}' \
  -o response.wav
```
Response is a raw `audio/wav` file (16-bit PCM mono, 22050 Hz). Verify content with `file response.wav`, or round-trip it through `/v1/audio/transcriptions` to sanity-check the words came out right.

**Known limitations:**
- **CPU-only for now.** `PiperVoice.load(..., use_cuda=False)` — synthesis is fast enough on CPU (~0.1–0.2 s for a sentence) that GPU wasn't needed; revisit if longer passages get used.
- **`RAG/tts_output/` grows unbounded.** Every request writes a new `<uuid>.wav` file and never deletes it. Fine for smoke testing; needs a cleanup/TTL policy (or switch to streaming bytes without persisting to disk) before real classroom use.
- **No streaming.** The whole WAV is generated and returned in one response; there's no chunked/streaming audio yet.
- **Frontend-accessible, but not connected to avatar/lip-sync.** Each assistant chat bubble has a 🔊 play button (`Frontend/src/components/MessageList.jsx`) that calls `/v1/audio/speech` on click and plays the returned audio — it's manual/click-to-play only, never autoplay. It's intentionally not connected to `AvatarBanner.jsx`.
- **First request per voice is slower** (~3–4 s) due to the one-time model download; cold-start after a backend restart re-downloads only if `RAG/tts_models/` was deleted — otherwise it just re-loads from disk (~0.5 s).
