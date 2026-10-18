import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import fs from 'node:fs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), basicSsl()],
  // Port must match the CORS origins allowed by the server (server/src/server/main.py).
  // host: true listens on 0.0.0.0 so other devices on the LAN can load the app. 
  server: { 
    strictPort: true,
    host: 'dev.example.com',
    https: {
      key: fs.readFileSync('/etc/letsencrypt/live/dev.example.com/privkey.pem'),
      cert: fs.readFileSync('/etc/letsencrypt/live/dev.example.com/fullchain.pem'),
    },
  },
})
