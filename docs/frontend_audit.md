# Frontend Audit — pre-rebuild inventory

Audit of `Frontend/src/` (15 files, 1,208 lines) ahead of the rebuild to a
**slide-primary layout**: the PE 2.0 student PDF takes ~70% of the screen and
an agent panel slides in from the right on demand. The current layout is
chat-primary with a course-navigation sidebar.

Context read alongside the code: `docs/pe2_table_of_contents.md` (150-slide
structure) and `docs/ARCHITECTURE.md`.

- **KEEP** — direct equivalent purpose in the new layout
- **REPLACE** — concept carries over, implementation rewritten
- **DELETE** — no equivalent purpose

## 1. File classification

| File | Verdict | Reasoning |
|---|---|---|
| `main.jsx` | **KEEP** | Entry point; layout-agnostic. |
| `api.js` | **KEEP** | All four backend calls (`sendChat`, `transcribeAudio`, `synthesizeSpeech`, `checkHealth`) plus `stripThink` are pure plumbing the agent panel needs unchanged. |
| `config.js` | **KEEP** | Endpoint URLs still needed; will likely gain a slide-asset path constant. |
| `index.css` | **KEEP** | Design tokens (colors, light/dark) and base reset apply to any layout. |
| `hooks/useChat.js` | **KEEP** | The request-sequence guard (newer request supersedes in-flight) is exactly what rapid slide-flipping needs. Minor edits: the `divider` append and `sendIntro` wording are tied to the old chat-primary framing. |
| `components/InputBar.jsx` | **KEEP** | Textarea + mic recording (MediaRecorder → STT) drops into the agent panel as-is. |
| `components/MessageList.jsx` | **KEEP** | Bubbles, auto-scroll, `PlayButton` (TTS with object-URL cleanup), `ThinkingIndicator` all reuse. Minor edits: drop the `divider` role rendering and the "pick a section from the course menu" empty-state copy. |
| `App.jsx` | **REPLACE** | Shell becomes slide stage (~70%) + slide-in panel instead of header/sidebar/chat. Carry the enriched-query template (App.jsx:22) and the select→intro trigger into the new shell — context should now come from the current *slide*, not a section title. |
| `course.js` | **REPLACE** | Concept (course structure data) survives, but the data is wrong for the new layout: it's 24 section titles, while the new source of truth is the 150-slide PDF. It needs to become a slide manifest — slide number → module/topic — derived from `docs/pe2_table_of_contents.md`, so the agent panel knows what slide the student is viewing. |
| `hooks/useCourse.js` | **REPLACE** | `currentIndex`/`select`/`completed`/`progress`/`hasPrev`/`hasNext` is exactly slide-position state and gets reshaped into a `useSlides` controller (indices 1–150). `openModules`/`toggleModule` (accordion state) has no equivalent and dies in the rewrite. |
| `components/ChatPanel.jsx` | **REPLACE** | 13 lines of composition; becomes the agent overlay panel (open/close state, slide-in transition) composing the same MessageList + InputBar. |
| `app.css` | **REPLACE** | Keep the bubble/input-bar/thinking blocks (~half); the shell, header, course-nav, avatar-banner, section-divider, and sidebar-stacking media query (~230 of 449 lines) are all styles for DOM that won't exist. |
| `components/CourseNav.jsx` | **DELETE** | The accordion sidebar has no equivalent when the PDF is the navigation surface. Prev/Next and progress become trivial slide controls in the new stage — nothing in this 74-line implementation is worth porting. |
| `components/Header.jsx` | **DELETE** | A persistent chrome bar contradicts a slide-primary stage. Salvage the one valuable piece — the 15 s `checkHealth` polling pattern — into the agent panel as a status dot. |
| `components/AvatarBanner.jsx` | **DELETE** | A banner above a full-height message list has no position in the new layout; the avatar's future home is the agent panel itself. The children-mount-point *idea* should be recreated there. (Note: `docs/CLAUDE.md` and `docs/ARCHITECTURE.md` both point the future avatar at this component — update both when it goes.) |

Tally: **7 KEEP · 5 REPLACE · 3 DELETE.** There is no assets directory; no
orphaned files exist today.

## 2. Redundant code

- **`api.js` — triplicated fetch boilerplate.** `sendChat`,
  `transcribeAudio`, and `synthesizeSpeech` each repeat the same ~20-line
  pattern: try/fetch with `AbortSignal.timeout`, identical
  TimeoutError → "timed out after 2 minutes" mapping, identical "Cannot reach
  the backend at …" message, then a parse-JSON-and-check-`res.ok` block. One
  shared `request()` helper would collapse ~40 lines. Since this file is KEEP,
  it's the highest-value cleanup in the rebuild.
- **`CourseNav.jsx:30-32` — re-derives what `course.js` already computed.**
  `SECTIONS.findIndex(...)` inside a nested render loop recomputes the flat
  index that `SECTIONS` was built to provide (each entry already carries
  `key`, `moduleIndex`). O(n²) per render and duplicated flattening logic.
  Moot once the file is deleted — but don't copy the pattern into the slide
  manifest.
- **`config.js:8` — `MODEL = 'llama3.1:70b'` is dead-in-effect.** The backend
  ignores the request's `model` field (it only echoes it back; the real model
  comes from `RAG/config.yaml`, currently `llama3.1:8b`). It's sent on every
  request and misleads readers twice over — wrong value *and* no effect.
- **`<think>`-stripping exists in two languages.** `stripThink` in
  `api.js:6-8` and the `'<think>' in text` split in `RAG/rag.py:180-181` do
  the same job on opposite sides of the wire. Only the frontend one is live
  (the rag.py copy is inside the dead Coqui path), but it's the kind of
  duplicate that diverges silently.
- **Double `isLoading` send-guard** — `useChat.js:36` and `InputBar.jsx:14`
  both block submission while loading. Harmless belt-and-suspenders, but one
  owner would be cleaner in the rewrite.
- **No unused imports or fully dead functions found** in `Frontend/src` —
  every export is consumed somewhere today. After the DELETEs land, watch for
  two new orphans: `API_LABEL` (`config.js:7`, used only by Header) and the
  `COURSE` export shape (consumed only by CourseNav).

## 3. Documentation gaps

Best-documented files, as the standard to match: **`api.js`** (explains the
object-URL ownership contract and *why* `checkHealth` probes the chat
endpoint) and **`useChat.js`** (explains the sequence guard).

Gaps, worst first:

- **`CourseNav.jsx`** — zero comments. Takes the entire `useCourse` return
  object as a `course` prop plus `onSelect`, and the non-obvious `findIndex`
  flat-index lookup is unexplained.
- **`InputBar.jsx`** — zero comments for the most stateful component in the
  app: the MediaRecorder lifecycle (chunks → blob → transcribe → append to
  textarea), the secure-context constraint (explained only inside a
  user-facing error string), and props are all undocumented.
- **`ChatPanel.jsx`** — no comment; trivial today, but as the future agent
  panel its props contract should be stated.
- **`Header.jsx`** — no comment saying what it polls or that "health" is
  really an empty POST to the chat endpoint (that rationale lives only in
  `api.js`).
- **`App.jsx`** — the two prompt templates (the enriched query and the intro
  trigger) are the app's most behavior-defining strings, with no comment in
  the file explaining that they exist as a pair or that the backend embeds
  them verbatim as the retrieval query. `ARCHITECTURE.md` documents them, but
  that's exactly the kind of doc that drifts (see below).
- **Cross-cutting: the message-role contract is implicit.** `user` /
  `assistant` / `error` / `divider` roles are produced in `useChat.js` and
  pattern-matched in `MessageList.jsx` with no single place declaring the
  message shape `{id, role, content}`. Anyone adding a role must discover the
  coupling by reading both files.
- **Doc drift already present in `ARCHITECTURE.md`** (worth fixing alongside
  the rebuild since the audit exposed it): line 69 quotes the *old* auto-intro
  wording (changed 2026-07-21 to topic-first), and the diagram/performance
  sections say `llama3.1:70b`, `temperature 0.2`, 15–25 s — `config.yaml` is
  now `llama3.1:8b`, `temperature 0`, ~3 s warm.
