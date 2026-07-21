# Setup: starting the app from zero

Copy-paste guide for getting the frontend + backend running on the DGX.
Every block below is safe to paste as-is, from **any teammate's account** — no
`conda activate` needed, no guessing about paths.

> **Already running?** This app runs once, machine-wide, for everyone. Do
> **Step 1** first — if both servers are up, just open
> <http://129.79.199.105:5173/> in your browser and you're done.

---

## Step 1 — Check what's already running

Paste this. It tells you exactly what (if anything) you still need to start:

```bash
echo "--- servers ---"
ss -tln | grep -q ':5000 ' && echo "backend  : RUNNING (port 5000)" || echo "backend  : not running"
ss -tln | grep -q ':5173 ' && echo "frontend : RUNNING (port 5173)" || echo "frontend : not running"
echo "--- ollama ---"
curl -s http://localhost:11434/api/tags | grep -o '"name":"[^"]*"' || echo "OLLAMA NOT RUNNING - ask in the team channel, don't start your own"
echo "--- tmux sessions ---"
tmux ls 2>/dev/null || echo "(none)"
```

- **Both servers RUNNING** → open <http://129.79.199.105:5173/>. Done.
- **Something not running** → continue below, starting only what's missing.
- Ollama must list `llama3.1:8b` and `nomic-embed-text`. It normally always
  runs; if it's down, ask before touching it.

---

## Step 2 — One-time setup for your account

Only needed the first time you ever work on this project. Safe to re-run.

```bash
git config --global --add safe.directory /home/hope-intern04/digital-human
```

---

## Step 3 — Open the shared tmux session

The servers run inside a tmux session named `digital-human` so they survive
SSH disconnects. This command attaches to it if it exists, or creates it:

```bash
tmux new -A -s digital-human
```

You are now *inside* tmux. The three commands you need to know:

| Keys | What it does |
|---|---|
| `Ctrl+B` then `C` | new window |
| `Ctrl+B` then a number (`0`, `1`, …) | switch window |
| `Ctrl+B` then `D` | detach — **servers keep running** |

---

## Step 4 — Start the backend (inside tmux)

Paste this whole block in a tmux window:

```bash
export PATH=/home/hope-intern04/miniconda3/envs/digital-human/bin:$PATH
cd /home/hope-intern04/digital-human
python RAG/ingest.py     # embeds course PDF; idempotent, skips existing chunks
python RAG/__init__.py   # starts the backend on 127.0.0.1:5000
```

Leave it running. You'll see Quart's startup output; the window now belongs to
the backend.

> Why these lines: the `export PATH` line points your shell at the project's
> Python + Node without needing conda; the `cd` matters because the backend
> reads `RAG/config.yaml` relative to where you launched it.

---

## Step 5 — Start the frontend (inside tmux)

Open a **new tmux window** (`Ctrl+B` then `C`), then paste:

```bash
export PATH=/home/hope-intern04/miniconda3/envs/digital-human/bin:$PATH
cd /home/hope-intern04/digital-human/Frontend
npm run dev
```

Leave it running. Vite prints the URLs it's serving on.

Now detach from tmux: `Ctrl+B` then `D`. Both servers keep running.

---

## Step 6 — Verify it works

From any shell (outside tmux is fine):

```bash
curl -s -o /dev/null -w "backend  : HTTP %{http_code} (405 = up)\n" http://127.0.0.1:5000/v1/chat/completions
curl -s -o /dev/null -w "frontend : HTTP %{http_code} (200 = up)\n" http://127.0.0.1:5173/
```

Expected output:

```
backend  : HTTP 405 (405 = up)
frontend : HTTP 200 (200 = up)
```

Then open **<http://129.79.199.105:5173/>** in your browser and send a chat
message. Replies typically take **~3 seconds** once the model is warm (the
backend pre-loads llama3.1:8b at startup); anything under 2 minutes is fine.

Voice features: the 🔊 button on each answer works from any address. The 🎤
mic button needs the page served from `localhost` — browsers block microphone
access on plain-HTTP IP addresses. Use an SSH tunnel
(`ssh -L 5173:localhost:5173 <user>@129.79.199.105`) and open
<http://localhost:5173/> instead; details in TROUBLESHOOTING.md.

---

## Stopping / restarting

```bash
tmux attach -t digital-human
```

Go to the window of the server you want to restart (`Ctrl+B` then `0`/`1`),
press `Ctrl+C` to stop it, then paste the matching block from Step 4 or 5
again. Detach with `Ctrl+B` then `D`.

⚠️ Only one instance of each server can run machine-wide (ports 5000/5173 are
shared). If Step 1 said a server is already RUNNING, someone may be using it —
check the team channel before killing it.

---

## If something breaks

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — it has a symptom → fix table
for every failure we've hit (connection refused, empty vector store, slow
responses, port already in use, …).
