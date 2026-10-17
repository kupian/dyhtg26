from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from server.game import GameManager, Room
from server.models import CreateRoomResponse, ErrorResponse, JoinRoomResponse, ReadyResponse
from server.exceptions import GameError, RoomError, PlayerError
from server.sockets import ConnectionManager
from uuid import UUID

app = FastAPI()
gm = GameManager()

@app.exception_handler(GameError)
async def game_error_handler(request: Request, exc: GameError):
    return JSONResponse(status_code=409, content={"error": str(exc)})

@app.get("/")
def read_root():
    return {"Hello": "World"}

@app.post(
    "/create-room",
    summary="Create a new game room and join as Player 1",
    responses={409: {"model": ErrorResponse, "description": "Error creating room"}},
)
def create_room() -> CreateRoomResponse:
    """Creates a room and returns its room code."""
    room_code = gm.create_room()
    player_id = gm.join_room(room_code)
    return CreateRoomResponse(room_code=room_code,
                              player_id=player_id)

@app.post(
    "/join-room",
    summary="Join an existing room as Player 2",
    responses={409: {"model": ErrorResponse, "description": "Error joining room"}}
)
def join_room(room_code: str) -> JoinRoomResponse:
    """Joins a room and returns the player's generated ID"""
    return JoinRoomResponse(player_id=gm.join_room(room_code))


@app.post(
    "/ready",
    summary="Set a player as ready to start the game",
    responses={409: {"model": ErrorResponse, "description": "Error readying up player"}}
)
def ready(room_code: str, player_id: str) -> ReadyResponse:
    player = gm.get_room(room_code).get_player(UUID(player_id))
    player.set_ready()
    return ReadyResponse(message=f"Room {room_code}: {player_id} set to ready")

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

    await room.connections.connect(websocket, player)
    try:
        while True:
            data = await websocket.receive_text()
            # TODO: handle message
    except WebSocketDisconnect:
        room.connections.disconnect(player)
