# Morse Duel server

## Running

```sh
uv run server
```

Serves on `0.0.0.0:8000` with auto-reload, so other devices on the same network
can reach it. Start the front-end with `npm run dev` in `../morse-duel`, then open
`http://<this machine's LAN IP>:8080` on the other device (`ipconfig getifaddr en0` on macOS).

`fastapi dev --host 0.0.0.0` does the same thing; plain `fastapi dev` only listens on localhost.
