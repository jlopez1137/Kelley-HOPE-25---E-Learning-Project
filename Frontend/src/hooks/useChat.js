import { useCallback, useRef, useState } from 'react';
import { sendChat } from '../api';

let nextId = 0;

export function useChat() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  // Monotonic sequence number: a response only lands if no newer request has
  // started since (rapid section clicks supersede in-flight intros).
  const requestSeq = useRef(0);

  const append = (role, content) =>
    setMessages((prev) => [...prev, { id: nextId++, role, content }]);

  const run = useCallback(async (apiMessages) => {
    const seq = ++requestSeq.current;
    setIsLoading(true);
    try {
      const reply = await sendChat(apiMessages);
      if (seq !== requestSeq.current) return;
      append('assistant', reply);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      append('error', err.message);
    } finally {
      if (seq === requestSeq.current) setIsLoading(false);
    }
  }, []);

  // User-typed message: show the raw text, send the enriched version plus
  // prior conversation (errors and section dividers excluded).
  const send = useCallback(
    (rawText, enrichedText) => {
      const text = rawText.trim();
      if (!text || isLoading) return;
      const history = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map(({ role, content }) => ({ role, content }));
      append('user', text);
      run([...history, { role: 'user', content: enrichedText }]);
    },
    [messages, isLoading, run]
  );

  // Section change: divider in the chat, then an automatic intro request.
  // Not guarded by isLoading — a newer intro supersedes the in-flight one.
  const sendIntro = useCallback(
    (moduleTitle, section) => {
      append('divider', `${moduleTitle} · ${section}`);
      const prompt = `Introduce ${section} to a student who is new to prompt engineering. Keep it brief — 2-3 sentences that set up what they're about to learn.`;
      run([{ role: 'user', content: prompt }]);
    },
    [run]
  );

  return { messages, isLoading, send, sendIntro };
}
