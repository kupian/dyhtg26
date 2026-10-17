from math import log2, ceil
from uuid import UUID, uuid4
from server.exceptions import RoomError, GameError, PlayerError
import server.morse as morse
from server.sockets import ConnectionManager
from server.models import RoomState

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

class Letter:
    def __init__(self, ascii_char: str):
        self.ascii = ascii_char.lower()
        self.morse = morse.encode.get(self.ascii, "")
        if self.morse == "":
            raise GameError(f"Morse encoding does not exist for {self.ascii}")

    def as_ascii(self):
        return self.ascii

    def as_morse(self):
        return self.morse
class Word:
    def __init__(self, ascii_str: str):
        self.letters = [Letter(c) for c in ascii_str]

    def as_ascii(self):
            return "".join([letter.as_ascii() for letter in self.letters])

    def as_morse(self):
        return " ".join([letter.as_morse() for letter in self.letters])
class Sentence:
    def __init__(self, ascii_str: str):
        self.words = [Word(w) for w in ascii_str.split(" ")]

    def as_ascii(self):
        return " ".join([word.as_ascii() for word in self.words])

    def as_morse(self):
        return " ".join([word.as_morse() for word in self.words])
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
        self.code : str = code
        self.players : dict[UUID, Player] = {}
        self.connections = ConnectionManager()
        self.room_state = RoomState.WAITING
        self.current_sentence : Sentence | None = None

    def generate_new_sentence(self):
        # TODO: implement this
        self.current_sentence = Sentence("The quick brown fox jumped over the lazy dog")

    def get_sentence(self) -> Sentence:
        if not self.room_state == RoomState.PLAYING:
            raise GameError("Room is not active")
        if not self.current_sentence:
            raise RoomError("This room has no sentence")
        return self.current_sentence

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

    async def set_player_ready(self, player_id: UUID):
        self.get_player(player_id).set_ready()
        if all([player.ready for player in self.players.values()]):
            await self.start_room()

    def get_player_count(self):
        return len(self.players)

    async def start_room(self):
        if self.room_state == RoomState.WAITING:
            self.room_state = RoomState.PLAYING
            self.generate_new_sentence()
            await self.connections.notify_state_change_all(self.room_state)
        else:
            raise RoomError("Room cannot be started now")

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

    def get_room(self, room_code: str) -> Room:
        room = self.rooms.get(room_code)
        if not room:
            raise GameError("Room does not exist")
        return room

    def join_room(self, room_code: str) -> UUID:
        room = self.get_room(room_code)
        if not room:
            raise GameError("Room does not exist")
        return room.add_player()
