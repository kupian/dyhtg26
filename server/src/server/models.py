from pydantic import BaseModel
from uuid import UUID
from enum import Enum

class RoomControlOption(Enum):
    create = "create"
    join = "join"
    ready = "ready"

class RoomControl(BaseModel):
    command: RoomControlOption
    player_id: UUID | None