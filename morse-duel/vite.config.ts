import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Must match the CORS origin allowed by the server (server/src/server/main.py)
  server: { port: 8080, strictPort: true },
})
