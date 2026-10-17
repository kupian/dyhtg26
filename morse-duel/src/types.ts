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

export interface LobbyProps {
  onCreate: () => void;
  onJoin: (code: RoomCode) => void;
}

export interface RoomProps {
  roomCode: RoomCode;
  onLeave: () => void;
}
