from fastapi import WebSocket
from uuid import UUID
from server.models import RoomState
import json

class PlayerConnection:
    def __init__(self, websocket: WebSocket, player_id: UUID):
        self.player_id = player_id
        self.websocket = websocket

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[UUID, PlayerConnection] = {}

    async def connect(self, websocket: WebSocket, player_id: UUID):
        await websocket.accept()
        self.active_connections[player_id] =PlayerConnection(
            websocket, player_id)

    def disconnect(self, player_id: UUID):
        self.active_connections.pop(player_id)

    #async def send_personal_message(self, message: str, websocket: WebSocket):
    #    await websocket.send_text(message)

    async def notify_state_change_all(self, state: RoomState):
        for c in self.active_connections.values():
            await c.websocket.send_json({
                "state": state.value
            })