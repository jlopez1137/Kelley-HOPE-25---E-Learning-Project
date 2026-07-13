import { useRef, useState } from 'react';

export default function InputBar({ onSend, isLoading }) {
  const [text, setText] = useState('');
  const textareaRef = useRef(null);

  const submit = () => {
    if (!text.trim() || isLoading) return;
    onSend(text);
    setText('');
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="input-bar">
      <textarea
        ref={textareaRef}
        className="input-bar__textarea"
        rows={1}
        value={text}
        placeholder={isLoading ? 'Waiting for response…' : 'Ask your tutor a question'}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button className="input-bar__send" onClick={submit} disabled={isLoading || !text.trim()}>
        Send
      </button>
    </div>
  );
}
