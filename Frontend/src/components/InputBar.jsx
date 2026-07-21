import { useRef, useState } from 'react';
import { transcribeAudio } from '../api';

// Composer row: textarea + 🎤 mic (speech-to-text) + Send.
//
// Props:
//   onSend(text)  — called with the raw draft on submit; the parent enriches
//                   and dispatches it (see App.jsx handleSend)
//   isLoading     — a chat request is in flight; blocks submit and the mic
//
// Mic flow: MediaRecorder buffers audio chunks while recording; on stop they
// are combined into a single Blob, POSTed to /v1/audio/transcriptions (via
// transcribeAudio), and the transcript is appended to whatever is already
// typed — the user reviews and presses Send themselves; nothing auto-submits.
export default function InputBar({ onSend, isLoading }) {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [micError, setMicError] = useState(null);
  const textareaRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

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

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const startRecording = async () => {
    setMicError(null);
    // Mic capture requires a secure context: browsers expose
    // navigator.mediaDevices only on HTTPS or localhost, so on this app's
    // plain-HTTP IP address it is undefined — the fix is viewing the page
    // through an SSH tunnel as localhost (see docs/TROUBLESHOOTING.md).
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicError(
        window.isSecureContext
          ? 'Recording is not supported in this browser.'
          : 'Recording needs HTTPS or localhost — this page is served over plain HTTP at a non-localhost address. SSH tunnel with `ssh -L 5173:localhost:5173 <user>@129.79.199.105` and open http://localhost:5173/ instead.'
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        setIsTranscribing(true);
        try {
          const transcript = await transcribeAudio(blob);
          if (transcript) {
            setText((prev) => (prev.trim() ? `${prev.trim()} ${transcript}` : transcript));
          }
        } catch (err) {
          setMicError(err.message);
        } finally {
          setIsTranscribing(false);
          textareaRef.current?.focus();
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      setMicError('Microphone access denied or unavailable.');
    }
  };

  const toggleMic = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const micDisabled = isLoading || isTranscribing;
  const micLabel = isRecording ? '⏹' : isTranscribing ? '…' : '🎤';

  return (
    <div className="input-bar-wrap">
      {micError && <div className="input-bar__mic-error">{micError}</div>}
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
        <button
          type="button"
          className={`input-bar__mic${isRecording ? ' input-bar__mic--recording' : ''}`}
          onClick={toggleMic}
          disabled={micDisabled}
          title={micError || (isRecording ? 'Stop recording' : 'Record a question')}
        >
          {micLabel}
        </button>
        <button className="input-bar__send" onClick={submit} disabled={isLoading || !text.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
