from fastapi import WebSocket
from uuid import UUID
from server.game import Player, Room

class PlayerConnection:
    def __init__(self, websocket: WebSocket, player: Player, room: Room):
        self.player = player
        self.room = room
        self.websocket = websocket

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[UUID, PlayerConnection] = {}

    async def connect(self, websocket: WebSocket, room: Room, player: Player):
        await websocket.accept()
        self.active_connections[player.id] =PlayerConnection(
            websocket, player, room)

    def disconnect(self, player: Player):
        self.active_connections.pop(player.id)

    #async def send_personal_message(self, message: str, websocket: WebSocket):
    #    await websocket.send_text(message)