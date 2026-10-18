# syntax=docker/dockerfile:1

FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim

WORKDIR /app

# Install dependencies first for layer caching
COPY pyproject.toml uv.lock ./
RUN uv sync --no-install-project

# Copy the app source + README, then install the project package
COPY src ./src
COPY README.md ./
RUN uv sync

EXPOSE 8000

# Short WebSocket pings so a player who drops without closing (phone locked, Wi-Fi lost)
# is noticed in seconds and their opponent told, not after uvicorn's default ~40s
CMD ["uv", "run", "uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8000", \
     "--ws-ping-interval", "5", "--ws-ping-timeout", "5"]
