export type RoomCode = string;

export type LobbyProps = {
  onCreate: () => void | Promise<void>;
  onJoin: (code: RoomCode) => void | Promise<void>;
  error?: string | null;
  isLoading?: boolean;
  onDismissError?: () => void;
};


export interface RoomProps {
  roomCode: RoomCode;
  onLeave: () => void;
}
