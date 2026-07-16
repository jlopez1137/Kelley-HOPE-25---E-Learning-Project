# Piper TTS — Implementation Notes

Implementation log for local text-to-speech via [Piper](https://github.com/OHF-Voice/piper1-gpl), added as the backend-only first step toward students hearing the tutor's answers. See `docs/TROUBLESHOOTING.md` for setup/test commands and known limitations; this file is the "what was done and why" log.

## Why Piper (not NVIDIA Riva)

`docs/DISCOVERY.md`'s original migration roadmap named NVIDIA Riva as the planned local TTS replacement. We went with Piper instead:

- Riva needs a full Triton/Riva server deployment — a much heavier operational lift than is justified on a shared dev DGX box right now.
- Piper is pip-installable with a prebuilt aarch64 wheel (no compilation), mirroring how `faster-whisper` was added for STT — same lazy-load-on-first-use pattern, no long-running model server to babysit.
- CPU inference is fast enough (~0.1–0.2 s per sentence on this DGX Spark) that Riva's GPU-serving story wasn't needed to hit acceptable latency.

## What was tested

1. **Compatibility check** (before installing anything): `pip install --dry-run piper-tts` confirmed a prebuilt wheel exists for `linux_aarch64` / Python 3.10 (`piper_tts-1.4.2-cp39-abi3-...aarch64...whl`), with `onnxruntime` already satisfied from the faster-whisper install.
2. **Install**: `pip install --user "piper-tts>=1.4.2,<2.0.0"` — same `--user` pattern as faster-whisper, since this account can't write to the shared conda env's own `site-packages`.
3. **API verification** (via `inspect.signature`, not guessed from memory):
   - `piper.PiperVoice.load(model_path, config_path=None, use_cuda=False, download_dir=None)`
   - `voice.synthesize_wav(text, wav_file: wave.Wave_write, ...)`
   - `piper.download_voices.download_voice(voice: str, download_dir: Path, force_redownload=False)` — fetches `<voice>.onnx` + `<voice>.onnx.json`.
4. **End-to-end smoke test**: downloaded `en_US-lessac-medium`, synthesized "Hello, this is a test of Piper text to speech on DGX Spark." to a WAV file, and **round-tripped it through the faster-whisper `/v1/audio/transcriptions` endpoint** to confirm it was real, intelligible speech (not silence/noise) — got back an almost-exact match of the original text.
5. **Backend integration test** (after wiring `RAG/rag.py` + `RAG/__init__.py`):
   - Cold request (voice not yet downloaded): `POST /v1/audio/speech` with `{"text": "..."}` → `200`, ~3.8 s (includes one-time ~63 MB voice download), valid WAV returned, round-tripped correctly through Whisper again.
   - Warm request (voice already loaded, singleton hit): same endpoint → `200` in ~0.07 s.
   - Error path: `POST /v1/audio/speech` with `{}` → `400 {"error": "No text provided"}`.
   - Regression check: `/v1/chat/completions` and `/v1/audio/transcriptions` both still work after the `rag.py`/`__init__.py` changes (they share those files).

## What was implemented

- `pyproject.toml` — added `piper-tts` dependency.
- `RAG/config.yaml` — restructured `tts:` to be provider-scoped (`provider: piper`, plus a `piper:` block for model/dirs/sample_rate) **without touching the existing `coqui:` values**, which stay exactly as they were. Fixed one stale reference in `RAG/rag.py`'s (dead, since the `TTS` package isn't installed) Coqui path that read `CONFIG['tts']['model']` directly — updated to `CONFIG['tts']['coqui']['model']` to match the new nesting, for consistency, since it's now unreachable but still present code.
- `RAG/rag.py` — added `get_piper_voice()` (lazy singleton, downloads the voice into `tts.piper.model_dir` on first use if missing) and `synthesize_speech(text) -> str` (writes a `<uuid>.wav` into `tts.piper.output_dir`, returns the path). Purely additive — the existing Coqui `tts()`/`tts_async()` functions are untouched.
- `RAG/__init__.py` — added `POST /v1/audio/speech`: `{"text": "..."}` in, raw WAV bytes out (`Content-Type: audio/wav`), synthesis run via `asyncio.to_thread` off the event loop (same pattern as `run_rag`/`transcribe`).

### Frontend wiring (follow-up stage)

- `Frontend/src/config.js` — added `SPEECH_ENDPOINT`.
- `Frontend/src/api.js` — added `synthesizeSpeech(text)`: POSTs `{text}`, returns a blob object URL for playback (caller revokes it when done).
- `Frontend/src/components/MessageList.jsx` — added a `PlayButton` shown only on `assistant` bubbles (not user/error/divider). Click-to-play only, no autoplay. Own loading state (`…` while generating) and inline error text if synthesis fails; disabled while loading.
- `Frontend/src/app.css` — styling for the button and its error state.
- Verified against the live backend: confirmed `POST /v1/audio/speech` returns `content-type: audio/wav` with a real body, matching what `res.blob()` in `synthesizeSpeech()` expects.

## What still needs to be done

- **Not connected to the avatar/lip-sync pipeline** (`AvatarBanner.jsx`) — explicitly out of scope for this stage per the request that introduced this feature.
- **`RAG/tts_output/` has no cleanup policy.** Every request writes a new WAV file that's never deleted. Needs a TTL/cleanup job, or switching to an in-memory/streaming response that doesn't persist to disk, before real usage.
- **No GPU path tested.** `use_cuda=False` is hardcoded implicitly (not exposed in config); fine for now given CPU latency is already low, but worth revisiting if longer-form synthesis is needed later.
- **Voice choice (`en_US-lessac-medium`) is a default, not a deliberate pick** — no comparison against other Piper voices was done for classroom-appropriate tone/clarity.
- **No caching/dedup** of repeated text → audio (e.g. the same course intro spoken every time a section is revisited would re-synthesize instead of reusing a cached file).
