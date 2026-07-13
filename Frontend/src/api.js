import { API_URL, CHAT_ENDPOINT, MODEL } from './config';

const TIMEOUT_MS = 120_000;

// Thinking models (qwen3, deepseek-r1) wrap reasoning in <think> tags
export function stripThink(text) {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

export async function sendChat(messages) {
  let res;
  try {
    res = await fetch(CHAT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, messages }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new Error('Request timed out after 2 minutes.');
    }
    throw new Error(`Cannot reach the backend at ${API_URL || 'localhost:5000 (via proxy)'} — is it running?`);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON body; fall through to status-based error
  }

  if (!res.ok) {
    throw new Error(data?.error || `Backend returned HTTP ${res.status}`);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Backend returned an empty response.');
  }
  return stripThink(content);
}

// The backend has no dedicated health route, so probe the chat endpoint with an
// empty JSON body: its 400 "No data provided" path answers without invoking the
// LLM. Any HTTP response means the backend is up; a network error means it isn't.
export async function checkHealth() {
  try {
    await fetch(CHAT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(5000),
    });
    return true;
  } catch {
    return false;
  }
}
