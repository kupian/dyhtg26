from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from server.game import GameManager, Room
from server.models import *
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
    sentence = gm.get_room(body.room_code).get_sentence()
    return SentenceResponse(sentence=sentence.as_ascii())

@app.post(
    "/keystroke",
    summary="Send a keystroke to an active room",
    responses={409: {"model": ErrorResponse, "description": "Error sending keystroke"}}
)
def keystroke(body: KeystrokeRequest) -> KeystrokeResponse:
    # get player's next correct key
    room = gm.get_room(body.room_code)
    if room.room_state != RoomState.PLAYING:
        raise RoomError("Room is not playing")

    player = room.get_player(body.player_id)

    """
    if player.next_correct_keystroke == body.symbol:
        player.advance_next_keystroke()
        correct = True
    else:
        correct = False
    """
    #! TEMPORARY FOR TESTING ----
    correct=True
    player.type_character(body.symbol)

    #! ------
    #target_character = player.get_target_character()
    typed_sentence = player.get_typed_sentence()


    return KeystrokeResponse(
        correct=correct,
        current_sentence_ascii=typed_sentence,
        current_sentence_morse=typed_sentence,
        #current_target_character=target_character.as_ascii()
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
        while True:
            data = await websocket.receive_text()
            # TODO: handle message
    except WebSocketDisconnect:
        room.connections.disconnect(player_uuid)
