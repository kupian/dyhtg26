from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from server.game import GameManager, Room
from server.models import CreateRoomResponse, ErrorResponse, JoinRoomRequest, JoinRoomResponse, ReadyRequest, ReadyResponse, SentenceRequest, SentenceResponse
from server.exceptions import GameError, RoomError, PlayerError
from fastapi.middleware.cors import CORSMiddleware
from server.sockets import ConnectionManager
from uuid import UUID

app = FastAPI()
gm = GameManager()

origins = [
    "http://localhost:8080",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
def join_room(body: JoinRoomRequest) -> JoinRoomResponse:
    """Joins a room and returns the player's generated ID"""
    return JoinRoomResponse(room_code=body.room_code,
                            player_id=gm.join_room(body.room_code))

@app.post(
    "/ready",
    summary="Set a player as ready to start the game",
    responses={409: {"model": ErrorResponse, "description": "Error readying up player"}}
)
def ready(body: ReadyRequest) -> ReadyResponse:
    room = gm.get_room(body.room_code)
    room.set_player_ready(body.player_id)
    return ReadyResponse(message=f"Room {body.room_code}: {body.player_id} set to ready")

@app.post(
    "/sentence",
    summary="Get the current sentence for an active room",
    responses={409: {"model": ErrorResponse, "description": "Error getting sentence"}}
)
def sentence(body: SentenceRequest) -> SentenceResponse:
    sentence = gm.get_room(body.room_code).get_sentence()
    return SentenceResponse(sentence=sentence.as_ascii())

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
        while True:
            data = await websocket.receive_text()
            # TODO: handle message
    except WebSocketDisconnect:
        room.connections.disconnect(player_uuid)
