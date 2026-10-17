from math import log2, ceil
from uuid import UUID, uuid4
from server.exceptions import RoomError, GameError, PlayerError

"""
MAGIC NUMBERS
"""
MAX_ROOMS = 16
CODE_LENGTH = ceil(log2(MAX_ROOMS))
ROOM_CODES = [ #! TECH DEBT: THIS DOES NOT ALLOW MAX ROOMS TO SCALE BC HARDCODED
    "....",
    "...-",
    "..-.",
    "..--",
    ".-..",
    ".-.-",
    ".--.",
    ".---",
    "-...",
    "-..-",
    "-.-.",
    "-.--",
    "--..",
    "--.-",
    "---.",
    "----"
]

def get_room_code(room_idx: int) -> str:
    return ROOM_CODES[room_idx]


class Player:
    def __init__(self):
        self.id = uuid4()
        self.score = 0
        self.ready = False

    def set_ready(self):
        if not self.ready:
            self.ready = True
        else:
            raise PlayerError("Player is already ready")

class Room:
    max_players = 2

    def __init__(self, code):
        self.code = code
        self.players = {}

    def add_player(self) -> UUID:
        if len(self.players) < self.max_players:
            p = Player()
            self.players[p.id] = p
            return p.id
        else:
            raise RoomError("Room is full")

    def get_player(self, player_id : UUID) -> Player:
        player = self.players.get(player_id)
        if not player:
            raise RoomError("Player does not exist")
        return player

    def set_player_ready(self, player_id):
        self.get_player(player_id).set_ready()

    def get_player_count(self):
        return len(self.players)

class GameManager():
    def __init__(self):
        self.rooms = {}

    def create_room(self) -> str:
        if len(self.rooms) >= MAX_ROOMS:
            raise GameError("Room limit reached")

        room_code = get_room_code(len(self.rooms))
        r = Room(room_code)
        self.rooms[room_code] = r
        return room_code

    def get_room(self, room_code: str) -> Room | None:
        return self.rooms.get(room_code, None)

    def join_room(self, room_code: str) -> UUID:
        room = self.get_room(room_code)
        if not room:
            raise GameError("Room does not exist")

        try:
            return room.add_player()
        except RoomError as re:
            return re