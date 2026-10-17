from fastapi import FastAPI
from server.game import GameManager, Room
from server.exceptions import GameError, RoomError, PlayerError

app = FastAPI()
gm = GameManager()

@app.get("/")
def read_root():
    return {"Hello": "World"}


@app.get("/create-room")
def create_room():
    try:
        room = gm.create_room()
    except GameError as ge:
        print(ge)
