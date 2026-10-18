def main() -> None:
    """`uv run server`: dev server reachable from other devices on the local network."""
    import uvicorn

    uvicorn.run(
        "server.main:app", host="0.0.0.0", port=8000, reload=True,
        # Ping often so a player who drops without closing (phone locked, Wi-Fi lost)
        # is noticed in seconds, not uvicorn's default ~40s
        ws_ping_interval=5, ws_ping_timeout=5,
    )
