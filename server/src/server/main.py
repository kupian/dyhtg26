from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from server.game import GameManager, Room
from server.models import RoomControl, CreateRoomResponse, ErrorResponse
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
    summary="Create a new game room",
    responses={409: {"model": ErrorResponse, "description": "Room limit reached"}},
)
def create_room() -> CreateRoomResponse:
    """Creates a room and returns its room code."""
    return CreateRoomResponse(room_code=gm.create_room())
