// Empty default = same-origin; the Vite dev/preview server proxies /v1 to the
// backend. Set VITE_API_URL to hit a backend on another host directly.
export const API_URL = import.meta.env.VITE_API_URL || '';
export const CHAT_ENDPOINT = `${API_URL}/v1/chat/completions`;
export const TRANSCRIBE_ENDPOINT = `${API_URL}/v1/audio/transcriptions`;
export const SPEECH_ENDPOINT = `${API_URL}/v1/audio/speech`;
export const API_LABEL = API_URL || 'backend via proxy';
// Dead-in-effect: sent in the request body, but the backend only echoes it
// back — the model actually used is llm.ollama_model in RAG/config.yaml.
// Kept until the frontend rebuild removes it.
export const MODEL = 'llama3.1:70b';
