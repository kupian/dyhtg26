def main() -> None:
    """`uv run server`: dev server reachable from other devices on the local network."""
    import uvicorn

    uvicorn.run("server.main:app", host="0.0.0.0", port=8000, reload=True)
