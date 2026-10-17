from fastapi import WebSocket
from uuid import UUID
from server.game import Player, Room, RoomState
import json

class PlayerConnection:
    def __init__(self, websocket: WebSocket, player: Player):
        self.player = player
        self.websocket = websocket

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[UUID, PlayerConnection] = {}

    async def connect(self, websocket: WebSocket, player: Player):
        await websocket.accept()
        self.active_connections[player.id] =PlayerConnection(
            websocket, player)

    def disconnect(self, player: Player):
        self.active_connections.pop(player.id)

    #async def send_personal_message(self, message: str, websocket: WebSocket):
    #    await websocket.send_text(message)

    async def notify_state_change_all(self, state: RoomState):
        for c in self.active_connections.values():
            await c.websocket.send_json({
                "state": state
            })