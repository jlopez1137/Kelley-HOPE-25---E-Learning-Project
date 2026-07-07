import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The Quart backend binds to 127.0.0.1 on the DGX, so remote browsers can't
// reach it directly. The dev server listens on all interfaces and proxies
// /v1 to the backend, letting the app fetch same-origin by default.
const proxy = {
  '/v1': 'http://localhost:5000',
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy,
  },
  preview: {
    host: true,
    proxy,
  },
})
