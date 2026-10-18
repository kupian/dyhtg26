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

    async def broadcast_state_change(self, state: RoomState):
        for c in self.active_connections.values():
            await c.websocket.send_json({
                "state": state.value
            })

    async def _broadcast_player_disconnect(self, player_id: UUID):
        pass

    async def _send_opponent_ready_state(self, player_id: UUID, opponent_ready_state: bool):
        """Send a player their opponent's ready state

        Args:
            player_id (UUID): Player to receive the notification
            opponent_ready_state (bool): Ready state of the player's opponent

        Raises:
            ConnectionError: Raised if the player is not connected
        """
        c = self.active_connections.get(player_id)
        if not c:
            raise ConnectionError("Player is not connected")
        await c.websocket.send_json({
            "opponent_ready": opponent_ready_state
        })

    async def update_opponents_sentence(self, player_id: UUID, morse_sentence: str, ascii_sentence: str):
        await self.get_connection(player_id).websocket.send_json({
            "opponent_morse": morse_sentence,
            "opponent_ascii": ascii_sentence
        })