// The on-demand AI tutor overlay (replaces the old always-visible ChatPanel).
//
// Slides in from the right over 250ms (CSS transition in app.css) and takes
// 32% of the screen while the slide stage keeps 68%. Composes the two KEEP
// chat components unchanged:
//   - MessageList — bubbles, thinking indicator, per-answer 🔊 TTS playback
//                   (POST /v1/audio/speech via api.js)
//   - InputBar    — textarea + 🎤 mic (POST /v1/audio/transcriptions) + Send
// Chat requests themselves go to POST /v1/chat/completions via useChat/api.js
// in App.jsx — this component only lays the pieces out.
//
// Props:
//   open       boolean       — whether the panel is on screen; the panel stays
//                              mounted while closed so chat history survives
//   section    { module, section } — current slide's course position, shown as
//                              the IU-crimson label at the top
//   messages   array         — useChat messages, passed through to MessageList
//   isLoading  boolean       — a chat request is in flight (MessageList spinner,
//                              InputBar submit lock)
//   onSend     (text) => void — called with the raw draft; App enriches it with
//                              slide context before it reaches the backend

import MessageList from './MessageList';
import InputBar from './InputBar';

export default function AgentPanel({ open, section, messages, isLoading, onSend }) {
  return (
    // aria-hidden while closed: the panel is off-screen but still mounted,
    // so screen readers and tab order should ignore it.
    <aside className={`agent-panel${open ? ' agent-panel--open' : ''}`} aria-hidden={!open}>
      <div className="agent-panel__section">
        <span className="agent-panel__module">{section.module}</span>
        <span className="agent-panel__topic">{section.section}</span>
      </div>
      <MessageList messages={messages} isLoading={isLoading} />
      <InputBar onSend={onSend} isLoading={isLoading} />
    </aside>
  );
}
