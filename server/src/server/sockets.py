from fastapi import WebSocket
from uuid import UUID
from server.models import RoomState
from server.exceptions import ConnectionError

class PlayerConnection:
    def __init__(self, websocket: WebSocket, player_id: UUID):
        self.player_id = player_id
        self.websocket = websocket

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[UUID, PlayerConnection] = {}

    def get_connection(self, player_id: UUID) -> PlayerConnection:
        connection = self.active_connections.get(player_id)
        if not connection:
            raise ConnectionError("That player is not connected")
        return connection

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

    async def update_opponents_sentence(self, player_id: UUID, morse_sentence: str, ascii_sentence: str):
        await self.get_connection(player_id).websocket.send_json({
            "opponent_morse": morse_sentence,
            "opponent_ascii": ascii_sentence
        })