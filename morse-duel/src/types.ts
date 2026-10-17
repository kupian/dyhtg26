export type RoomCode = string;

export interface LobbyProps {
  onCreate: () => void;
  onJoin: (code: RoomCode) => void;
}

export interface RoomProps {
  roomCode: RoomCode;
  onLeave: () => void;
}
