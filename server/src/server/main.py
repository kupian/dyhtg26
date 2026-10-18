import os
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from server.game import GameManager, Room, ChatRoom, PvpRoom
from server.models import CreateRoomRequest, CreateRoomResponse, JoinRoomRequest, JoinRoomResponse, ReadyRequest, ReadyResponse, SentenceRequest, SentenceResponse, KeystrokeRequest, KeystrokeResponse, ErrorResponse, RoomType, RoomState
from server.exceptions import GameError, RoomError, PlayerError
from fastapi.middleware.cors import CORSMiddleware
from server.sockets import ConnectionManager
from uuid import UUID

app = FastAPI()
gm = GameManager()

# In production nginx serves the front-end and proxies /api/ to this server on the
# same origin, so CORS doesn't apply. These cover local dev and direct :8000 access.
# Deployment-specific origins come from CORS_ORIGINS (comma-separated, set in .env).
origins = [
    "http://localhost",
    "http://localhost:8080",
    *(o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()),
]
# Front-end served from this machine's LAN address (10.x, 172.16-31.x, 192.168.x)
lan_origin_regex = r"http://(10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+):8080"

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=lan_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(GameError)
async def game_error_handler(request: Request, exc: GameError):
    return JSONResponse(status_code=409, content={"error": str(exc)})

@app.post(
    "/create-room",
    summary="Create a new game room and join as Player 1",
    responses={409: {"model": ErrorResponse, "description": "Error creating room"}},
)
def create_room(body: CreateRoomRequest) -> JoinRoomResponse:
    """Creates a room and returns its room code."""
    room_code = gm.create_room(body.room_type)
    player_id = gm.join_room(room_code)
    room_type = gm.get_room(room_code).get_type()

    return JoinRoomResponse(room_type=room_type, room_code=room_code,
                              player_id=player_id)

@app.post(
    "/join-room",
    summary="Join an existing room as Player 2",
    responses={409: {"model": ErrorResponse, "description": "Error joining room"}}
)
def join_room(body: JoinRoomRequest) -> JoinRoomResponse:
    """Joins a room and returns the player's generated ID"""
    room = gm.get_room(body.room_code)
    return JoinRoomResponse(room_type=room.get_type(), room_code=body.room_code,
                            player_id=gm.join_room(body.room_code))

@app.post(
    "/ready",
    summary="Set a player as ready to start the game",
    responses={409: {"model": ErrorResponse, "description": "Error readying up player"}}
)
async def ready(body: ReadyRequest) -> ReadyResponse:
    room = gm.get_room(body.room_code)
    await room.set_player_ready(body.player_id)
    return ReadyResponse(message=f"Room {body.room_code}: {body.player_id} set to ready")

@app.post(
    "/sentence",
    summary="Get the current sentence for an active room",
    responses={409: {"model": ErrorResponse, "description": "Error getting sentence"}}
)
def sentence(body: SentenceRequest) -> SentenceResponse:
    room = gm.get_room(body.room_code)
    if not isinstance(room, PvpRoom):
        raise GameError("Only a PvP room can be queried for a sentence")

    sentence = room.get_sentence()
    return SentenceResponse(sentence=sentence.as_ascii())

@app.post(
    "/keystroke",
    summary="Send a keystroke to an active room",
    responses={409: {"model": ErrorResponse, "description": "Error sending keystroke"}}
)
async def keystroke(body: KeystrokeRequest) -> KeystrokeResponse:
    room = gm.get_room(body.room_code)
    if room.room_state != RoomState.PLAYING:
        raise RoomError("Room is not playing")

    player = room.get_player(body.player_id)
    await room.type_character(body.player_id, body.symbol)

    return KeystrokeResponse(
        current_sentence_ascii=player.get_typed_ascii(),
        current_sentence_morse=player.get_typed_morse(),
    )

@app.websocket("/game/{room_code}/{player_id}")
async def websocket_endpoint(websocket: WebSocket, room_code: str, player_id: str):
    try:
        player_uuid = UUID(player_id)
        room = gm.get_room(room_code)
        player = room.get_player(player_uuid)
    except (GameError, ValueError) as e:
        reason = "Could not parse player ID" if isinstance(e, ValueError) else str(e)

        await websocket.accept()
        await websocket.close(code=1008, reason=reason)
        return

    await room.connections.connect(websocket, player_uuid)
    try:
        await room.on_player_connected(player_uuid)
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        # Also runs if the handler fails, so a dead socket is never left registered
        await room.on_player_disconnected(player_uuid)
