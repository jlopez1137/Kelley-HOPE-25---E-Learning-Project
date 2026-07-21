// Slide-primary shell — two layout states:
//   1 (default): SlideStage fills 100% of the screen; the only other element
//     is the crimson agent-toggle button fixed bottom-right.
//   2 (toggled): the stage shrinks to 68% and AgentPanel slides in from the
//     right at 32% (250ms CSS transition); the toggle becomes a dismiss.
//
// Wiring:
//   - useSlide  owns the current slide number; the course section is derived
//     from it via slideMap.js.
//   - useChat   (KEEP, unmodified) owns the conversation; send(raw, enriched)
//     posts to POST /v1/chat/completions through api.js.
//   - handleSend enriches every typed question with the current slide's
//     module/section — same teaching-context format the chat-primary app
//     used, extended with the slide number. The backend embeds the enriched
//     string verbatim as its retrieval query.

import { useState } from 'react';
import SlideStage from './components/SlideStage';
import AgentPanel from './components/AgentPanel';
import { useChat } from './hooks/useChat';
import { useSlide } from './hooks/useSlide';
import './app.css';

export default function App() {
  const { messages, isLoading, send } = useChat();
  const slides = useSlide();
  const [panelOpen, setPanelOpen] = useState(false);

  // Raw text shows in the student's chat bubble; the enriched version (with
  // the slide's module/section as teaching context) is what the backend gets.
  const handleSend = (text) => {
    const { module, section } = slides.current;
    const enriched = `The student is currently studying ${module} - ${section} (slide ${slides.slide} of the PE 2.0 course deck). Answer the following question as an encouraging teacher would to a student learning this for the first time: ${text}`;
    send(text, enriched);
  };

  return (
    <div className={`app${panelOpen ? ' app--panel-open' : ''}`}>
      <SlideStage
        page={slides.slide}
        total={slides.total}
        hasPrev={slides.hasPrev}
        hasNext={slides.hasNext}
        onPrev={slides.goPrev}
        onNext={slides.goNext}
      />

      <AgentPanel
        open={panelOpen}
        section={slides.current}
        messages={messages}
        isLoading={isLoading}
        onSend={handleSend}
      />

      {/* Persistent toggle: opens the agent panel, doubles as its dismiss. */}
      <button
        type="button"
        className={`agent-toggle${panelOpen ? ' agent-toggle--open' : ''}`}
        onClick={() => setPanelOpen((o) => !o)}
        aria-label={panelOpen ? 'Close AI tutor' : 'Open AI tutor'}
        title={panelOpen ? 'Close AI tutor' : 'Ask the AI tutor'}
      >
        {/* Icon only — chat bubble when closed, × when open. */}
        {panelOpen ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 3C7 3 3 6.6 3 11c0 2.2 1 4.1 2.7 5.5-.2 1.2-.8 2.4-1.6 3.3 1.7-.2 3.3-.8 4.5-1.7 1 .3 2.2.5 3.4.5 5 0 9-3.6 9-8s-4-8-9-8z" />
          </svg>
        )}
      </button>
    </div>
  );
}
