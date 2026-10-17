import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Port must match the CORS origins allowed by the server (server/src/server/main.py).
  // host: true listens on 0.0.0.0 so other devices on the LAN can load the app.
  server: { host: true, port: 8080, strictPort: true },
})
