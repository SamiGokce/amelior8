import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Three separate front ends against one backend. Each gets its own bundle so a
// donor never downloads the relay app, and a relay on a field connection never
// downloads the donor app.
export default defineConfig({
  plugins: [react()],
  // Only affects `vite dev`; irrelevant to the production build. Lets the
  // frontend's same-origin `/api/...` calls reach scripts/dev-api.mjs when
  // it's running locally — see that file for why it exists.
  server: {
    proxy: {
      "/api": "http://127.0.0.1:5100",
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        org: resolve(__dirname, 'org.html'),
        relay: resolve(__dirname, 'relay.html'),
      },
    },
  },
})
