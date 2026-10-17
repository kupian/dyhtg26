export type RoomCode = string;

export type LobbyProps = {
  onCreate: () => void | Promise<void>;
  onJoin: (code: RoomCode) => void | Promise<void>;
  error?: string | null;
  isLoading?: boolean;
  onDismissError?: () => void;
};

export const MORSE_MAP: Record<string, string> = {
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.",
  G: "--.", H: "....", I: "..", J: ".---", K: "-.-", L: ".-..",
  M: "--", N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.",
  S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-",
  Y: "-.--", Z: "--.."
};

/** Mirrors server RoomState (server/src/server/models.py). */
export type RoomState = "WAITING" | "PLAYING" | "FINISHED";

/** Broadcast on the game socket by ConnectionManager.notify_state_change_all. */
export type StateChangeMessage = { state: RoomState };

export type SocketStatus = "connecting" | "open" | "closed";

export type KeySymbol = "." | "-";

export type LogEntry = { id: number; time: string; text: string };

export interface RoomProps {
  roomCode: RoomCode;
  playerId: string;
  roomState: RoomState;
  socketStatus: SocketStatus;
  sentence: string | null;
  events: LogEntry[];
  onLog: (text: string) => void;
  onLeave: () => void;
}
