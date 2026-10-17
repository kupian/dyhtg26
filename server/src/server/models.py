from pydantic import BaseModel
from uuid import UUID
from enum import Enum
class RoomState(Enum):
    WAITING = "WAITING"
    PLAYING = "PLAYING"
    FINISHED = "FINISHED"
class CreateRoomResponse(BaseModel):
    room_code: str
    player_id: UUID
class JoinRoomResponse(BaseModel):
    player_id: UUID

class ReadyResponse(BaseModel):
    message: str

class ErrorResponse(BaseModel):
    error: str