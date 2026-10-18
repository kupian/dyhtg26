import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // host: true listens on 0.0.0.0 so other devices on the LAN can load the app.
    host: true,
    port: 8080,
    strictPort: true,
    // Same-origin proxy to the FastAPI server, like nginx in production (nginx.conf):
    // /api/foo -> http://127.0.0.1:8000/foo, including the /api/game/... WebSocket.
    // The browser never makes a cross-origin request, so CORS doesn't apply in dev.
    // 127.0.0.1, not localhost: Node may resolve localhost to ::1, which `fastapi dev`
    // doesn't listen on.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        ws: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
