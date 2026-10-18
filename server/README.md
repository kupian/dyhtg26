# Morse Duel server

## Running

```sh
uv run server
```

Serves on port 8000 with auto-reload. Start the front-end with `npm run dev` in
`../morse-duel` and open `http://localhost:8080`.

The Vite dev server proxies `/api` to this server on `127.0.0.1:8000` (see
`vite.config.ts`), the same way nginx does in production, so the browser only
ever talks to port 8080 and CORS doesn't come into it. That also means
`fastapi dev`, which only listens on localhost, works just as well.

To play from another device on the same network, open
`http://<this machine's LAN IP>:8080` on it (`ipconfig getifaddr en0` on macOS).
