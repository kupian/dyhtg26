export type RoomCode = string;

export type LobbyProps = {
  onCreate: () => void | Promise<void>;
  onJoin: (code: RoomCode) => void | Promise<void>;
  isLoading?: boolean;
  errorMessage?: string | null;
  onClearError?: () => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
  selectedIndex?: number;
  onSelectIndexChange?: (index: number) => void;
  isJoining?: boolean;
  onToggleJoining?: (joining: boolean) => void;
  joinCode?: string;
  onJoinCodeChange?: (code: string) => void;
  showRefModal?: boolean;
  onToggleRefModal?: (show: boolean) => void;
  showSettingsModal?: boolean;
  onToggleSettingsModal?: (show: boolean) => void;
  onTriggerMessageDelivery?: (text: string) => void;
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

/** Dot, dash, or " " to end the current letter. */
export type KeySymbol = "." | "-" | " ";

export type LogEntry = { id: number; time: string; text: string };

/** What the player has typed, as decoded by the server in the last /keystroke response. */
export type TypedMessage = { ascii: string; morse: string };
export const EMPTY_TYPED: TypedMessage = { ascii: "", morse: "" };

export interface RoomProps {
  roomCode: RoomCode;
  playerId: string;
  isHost: boolean;
  roomState: RoomState;
  socketStatus: SocketStatus;
  typed: TypedMessage;
  events: LogEntry[];
  isReady: boolean;
  isReadying: boolean;
  isMuted: boolean;
  onLog: (text: string) => void;
  onLeave: () => void;
  onReady: () => void;
  onSendSignal: (symbol: KeySymbol) => void;
}
