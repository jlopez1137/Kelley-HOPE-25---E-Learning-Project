import { useEffect, useRef, useState } from 'react';
import { synthesizeSpeech } from '../api';

function PlayButton({ text }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const audioRef = useRef(null);
  const urlRef = useRef(null);

  // Revoke any generated object URL when this bubble unmounts
  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  const play = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const url = await synthesizeSpeech(text);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = url;
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.src = url;
      await audioRef.current.play();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <span className="bubble__tts">
      <button
        type="button"
        className="bubble__tts-btn"
        onClick={play}
        disabled={isLoading}
        title={error || 'Play audio'}
      >
        {isLoading ? '…' : '🔊'}
      </button>
      {error && <span className="bubble__tts-error">{error}</span>}
    </span>
  );
}

function ThinkingIndicator() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="bubble bubble--assistant bubble--thinking">
      <span className="dots">
        <span /><span /><span />
      </span>
      <span className="thinking-label">Thinking…{elapsed > 2 ? ` ${elapsed}s` : ''}</span>
    </div>
  );
}

export default function MessageList({ messages, isLoading }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="message-list">
      {messages.length === 0 && !isLoading && (
        <div className="empty-state">
          <p>Welcome! Pick a section from the course menu to get started,</p>
          <p>or just ask a question about prompt engineering.</p>
        </div>
      )}
      {messages.map((msg) => {
        if (msg.role === 'divider') {
          return (
            <div className="section-divider" key={msg.id}>
              <span>{msg.content}</span>
            </div>
          );
        }
        return (
          <div className={`bubble bubble--${msg.role}`} key={msg.id}>
            {msg.role === 'error' ? `Error: ${msg.content}` : msg.content}
            {msg.role === 'assistant' && <PlayButton text={msg.content} />}
          </div>
        );
      })}
      {isLoading && <ThinkingIndicator />}
      <div ref={bottomRef} />
    </div>
  );
}
