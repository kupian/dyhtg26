from math import log2, ceil
from uuid import UUID, uuid4
from server.exceptions import RoomError, GameError, PlayerError
import server.morse as morse
from server.sockets import ConnectionManager
from server.models import RoomState, RoomType

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
        #self.target_character : Letter | None = None
        self.typed_morse : str = ""
        self.typed_ascii : str = ""
        #self.next_correct_keystroke = ''

    def set_ready(self):
        if not self.ready:
            self.ready = True
        else:
            raise PlayerError("Player is already ready")

    #def get_target_character(self) -> Letter:
    #    if not self.target_character:
    #        raise PlayerError("Player has no target character")
    #    return self.target_character

    def get_typed_morse(self) -> str:
        return self.typed_morse

    def get_typed_ascii(self) -> str:
        return self.typed_ascii

    def type_character(self, symbol: str):
        self.typed_morse += symbol
        self.typed_ascii = morse.decode_sentence(self.typed_morse)

class Room:
    MAX_PLAYERS = 2

    def __init__(self, code):
        self.code : str = code
        self.players : dict[UUID, Player] = {}
        self.connections = ConnectionManager()
        self.room_state = RoomState.WAITING
        self.current_sentence : Sentence | None = None\

    def get_type(self) -> RoomType:
            return RoomType.CHAT

    def add_player(self) -> UUID:
        if len(self.players) < self.MAX_PLAYERS:
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

    def get_opponent_uuid(self, player_id: UUID) -> UUID | None:
        others = [pid for pid in self.players if pid != player_id]
        return others[0] if others else None

    async def set_player_ready(self, player_id: UUID):
        player = self.get_player(player_id)
        player.set_ready()
        await self.send_ready_state_to_opponent(player_id)
        if len(self.players) == Room.MAX_PLAYERS and all([player.ready for player in self.players.values()]):
            # If the room is full and all players are ready we can start
            await self.start_room()

    async def send_ready_state_to_opponent(self, player_id: UUID):
        """Tell player id's opponent their ready state, if connected

        Args:
            player_id (UUID): ID of the player who's opponent should be sent a ready state
        """
        opponent_id = self.get_opponent_uuid(player_id)
        if opponent_id is None:
            return
        try:
            await self.connections._send_opponent_ready_state(
                opponent_id, self.get_player(player_id).ready
            )
        except ConnectionError:
            pass # Opponent is not yet connected to the websocket

    async def on_player_connected(self, player_id: UUID):
        """Swap ready states with the opponent, if there is one"""
        opponent_id = self.get_opponent_uuid(player_id)
        if opponent_id is not None:
            await self.send_ready_state_to_opponent(player_id)    # opponent learns we've joined
            await self.send_ready_state_to_opponent(opponent_id)  # we learn if they're ready

    async def type_character(self, player_id: UUID, symbol: str):
        player = self.get_player(player_id)
        player.type_character(symbol)
        opponent = self.get_opponent_uuid(player_id)

        if not opponent:
            return
        try:
            await self.connections.update_opponents_sentence(
                opponent,
                player.get_typed_morse(),
                player.get_typed_ascii()
            )
        except ConnectionError:
            # TODO: figure out what happens if the other player disconnects mid-session
            pass

    def get_player_count(self):
        return len(self.players)

    async def start_room(self):
        if self.room_state == RoomState.WAITING:
            self.room_state = RoomState.PLAYING
            await self.connections.broadcast_state_change(self.room_state)
        else:
            raise RoomError("Room cannot be started now")

class ChatRoom(Room):
    pass

class PvpRoom(Room):
    def get_type(self) -> RoomType:
        return RoomType.PVP

    def generate_new_sentence(self):
        # TODO: Implement this
        self.current_sentence = Sentence("The quick brown fox jumped over the lazy dog")

    def get_sentence(self) -> Sentence:
        if not self.room_state == RoomState.PLAYING:
            raise GameError("Room is not active")
        if not self.current_sentence:
            raise RoomError("This room has no sentence")
        return self.current_sentence

    async def start_room(self):
        if self.room_state == RoomState.WAITING:
            self.room_state = RoomState.PLAYING
            self.generate_new_sentence()
            await self.connections.broadcast_state_change(self.room_state)
        else:
            raise RoomError("Room cannot be started now")


class GameManager():
    def __init__(self):
        self.rooms = {}

    def create_room(self, room_type:RoomType) -> str:
        if len(self.rooms) >= MAX_ROOMS:
            raise GameError("Room limit reached")

        room_code = get_room_code(len(self.rooms))
        r = ChatRoom(room_code)
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
