export type RoomCode = string;

export const MORSE_MAP: Record<string, string> = {
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.",
  G: "--.", H: "....", I: "..", J: ".---", K: "-.-", L: ".-..",
  M: "--", N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.",
  S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-",
  Y: "-.--", Z: "--..",
  "0": "-----", "1": ".----", "2": "..---", "3": "...--", "4": "....-",
  "5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----.",
};

/** Mirrors server RoomState (server/src/server/models.py). */
export type RoomState = "WAITING" | "PLAYING" | "FINISHED";

/** Broadcast on the game socket by ConnectionManager.notify_state_change_all. */
export type StateChangeMessage = { state: RoomState };

/** Sent on the game socket when the opponent types (ConnectionManager.update_opponents_sentence). */
export type OpponentTypedMessage = { opponent_morse: string; opponent_ascii: string };

export type SocketStatus = "connecting" | "open" | "closed";

export type KeySymbol = "." | "-";

/** Ends the current letter. Must match the separator in server decode_sentence (morse.py). */
export const NEWCHAR = "NEWCHAR";

/** Anything sent to /keystroke: a dot/dash, a letter break, or " " (a space, as its own letter). */
export type WireSymbol = KeySymbol | " " | typeof NEWCHAR;

/** What a player has typed: morse in wire format (letters joined by NEWCHAR) and its decode. */
export type TypedMessage = { ascii: string; morse: string };
export const EMPTY_TYPED: TypedMessage = { ascii: "", morse: "" };

/** Which experience the player picked; drives the title word and its colour. */
export type GameMode = "duel" | "chat" | "practice";
/** Modes played in a server room (practice is local only). */
export type RoomMode = Exclude<GameMode, "practice">;
/** Second word of the title (MORSE ___): a mode, or the chart/settings screens. */
export type TitleKey = GameMode | "chart" | "settings";

export type LobbyProps = {
  menuIndex: number;
  /** The highlighted mode's CREATE / JOIN submenu is open. */
  isExpanded: boolean;
  subIndex: number;
  isJoining: boolean;
  joinCode: string;
  /** The server rejected joinCode; shown red until it is cleared. */
  isJoinCodeInvalid: boolean;
  isLoading: boolean;
  /** Short, player-facing; details go to the console. Cleared on the next action. */
  errorMessage: string | null;
  onMenuItemClick: (index: number) => void;
  onSubItemClick: (index: number) => void;
  showChart: boolean;
  showSettings: boolean;
  settingsIndex: number;
  onSettingClick: (index: number) => void;
  isMuted: boolean;
};

export interface RoomProps {
  mode: RoomMode;
  isHost: boolean;
  roomState: RoomState;
  socketStatus: SocketStatus;
  typed: TypedMessage;
  opponentTyped: TypedMessage;
  /** A dot/dash was just sent by you / your opponent: light that cursor. */
  isYouSignalOn: boolean;
  isOpponentSignalOn: boolean;
  isReady: boolean;
  isReadying: boolean;
  onReady: () => void;
}
