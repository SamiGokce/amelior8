import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Three separate front ends against one backend. Each gets its own bundle so a
// donor never downloads the relay app, and a relay on a field connection never
// downloads the donor app.
export default defineConfig({
  plugins: [react()],
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
