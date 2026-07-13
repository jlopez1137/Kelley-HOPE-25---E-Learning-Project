// Empty default = same-origin; the Vite dev/preview server proxies /v1 to the
// backend. Set VITE_API_URL to hit a backend on another host directly.
export const API_URL = import.meta.env.VITE_API_URL || '';
export const CHAT_ENDPOINT = `${API_URL}/v1/chat/completions`;
export const API_LABEL = API_URL || 'backend via proxy';
export const MODEL = 'llama3.1:70b';
