from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from server.game import GameManager, Room
from server.models import CreateRoomResponse, ErrorResponse, JoinRoomResponse
from server.exceptions import GameError, RoomError, PlayerError

app = FastAPI()
gm = GameManager()

@app.exception_handler(GameError)
async def game_error_handler(request: Request, exc: GameError):
    return JSONResponse(status_code=409, content={"detail": str(exc)})

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
