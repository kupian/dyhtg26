from pydantic import BaseModel
from uuid import UUID
from enum import Enum
class RoomState(Enum):
    WAITING = "WAITING"
    PLAYING = "PLAYING"
    FINISHED = "FINISHED"

class RoomType(Enum):
    CHAT = "chat"
    PVP = "pvp"

class CreateRoomRequest(BaseModel):
    room_type : RoomType
class CreateRoomResponse(BaseModel):
    room_code: str
    player_id: UUID
class JoinRoomRequest(BaseModel):
    room_code: str

class JoinRoomResponse(BaseModel):
    room_type: RoomType
    room_code: str
    player_id: UUID

class ReadyRequest(BaseModel):
    room_code: str
    player_id: UUID

class ReadyResponse(BaseModel):
    message: str

class SentenceRequest(BaseModel):
    room_code: str

class SentenceResponse(BaseModel):
    sentence: str

class KeystrokeRequest(BaseModel):
    room_code: str
    player_id: UUID
    symbol: str

class KeystrokeResponse(BaseModel):
    current_sentence_ascii: str
    current_sentence_morse: str
class ErrorResponse(BaseModel):
    error: str