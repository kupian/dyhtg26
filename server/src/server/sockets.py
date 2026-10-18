from fastapi import WebSocket, WebSocketDisconnect
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

    def is_connected(self, player_id: UUID) -> bool:
        return player_id in self.active_connections

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
        """Tell every connected player the room's new state

        Args:
            state (RoomState): State the room has moved to
        """
        await self._send_to_all({"state": state.value})

    async def _send_to_all(self, message: dict, skip: UUID | None = None):
        """Send a message to every connected player

        Args:
            message (dict): JSON message to send
            skip (UUID | None): Player not to send it to, if any
        """
        # Copy: another handler may disconnect while we await a send
        for c in list(self.active_connections.values()):
            if c.player_id == skip:
                continue
            try:
                await c.websocket.send_json(message)
            except (WebSocketDisconnect, RuntimeError):
                pass # Their socket is closing; their own handler will clean up

    async def _send_to_others(self, player_id: UUID, message: dict):
        """Send a message to every connected player except player_id

        Args:
            player_id (UUID): Player to skip
            message (dict): JSON message to send
        """
        await self._send_to_all(message, skip=player_id)

    async def _broadcast_player_connect(self, player_id: UUID):
        """Tell every other player that player_id has connected

        Args:
            player_id (UUID): Player who connected
        """
        await self._send_to_others(player_id, {"opponent_connected": True})

    async def _broadcast_player_disconnect(self, player_id: UUID):
        """Tell every other player that player_id has disconnected

        Args:
            player_id (UUID): Player who disconnected
        """
        await self._send_to_others(player_id, {"opponent_connected": False})

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