import type { RoomCode, RoomType, WireSymbol } from "./types";

// --- Module scope: created once, not on every render -------------------------
// Default to port 8000 on whatever host served the page, so a phone loading
// http://<lan-ip>:8080 talks to http://<lan-ip>:8000 rather than its own localhost.
const API_BASE: string =
  import.meta.env.VITE_API_URL ?? `${window.location.protocol}//${window.location.hostname}:8000`;
const WS_BASE = API_BASE.replace(/^http/, "ws"); // http→ws, https→wss
const REQUEST_TIMEOUT_MS = 10_000;

/** Both /create-room and /join-room reply with this (server JoinRoomResponse). */
export type JoinRoomResponse = { room_type: RoomType; room_code: string; player_id: string };
export type ReadyResponse = { message: string };
export type SentenceResponse = { sentence: string };
export type KeystrokeResponse = {
  current_sentence_ascii: string;
  current_sentence_morse: string;
};

/** POST JSON and parse JSON, with a timeout and a real error on non-2xx. */
async function postJSON<T>(path: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`${path} failed: ${res.status} ${await readErrorBody(res)}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Pull the server's reason out of a failed response: GameError → {error}, validation → {detail}. */
async function readErrorBody(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    if (typeof json?.error === "string") return json.error;
    if (typeof json?.detail === "string") return json.detail;
    if (json?.detail !== undefined) return JSON.stringify(json.detail);
  } catch {
    // not JSON — fall through to the raw text
  }
  return text || res.statusText;
}

/** Turn whatever fetch threw into something a human can read. */
export function describeError(err: unknown): string {
  if (err instanceof DOMException && err.name === "AbortError") {
    return "The server took too long to respond.";
  }
  // fetch network failures AND CORS blocks both surface as TypeError
  if (err instanceof TypeError) {
    return "Could not reach the server. Is it running, and does it allow this origin (CORS)?";
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}

/** Network failure, CORS block or timeout — as opposed to the server refusing the request. */
export function isUnreachable(err: unknown): boolean {
  return err instanceof TypeError || (err instanceof DOMException && err.name === "AbortError");
}

const ROOM_TYPES: readonly RoomType[] = ["chat", "pvp"];

/** Reject a room type this client can't render, rather than showing the wrong UI. */
function checkRoomType(data: JoinRoomResponse): JoinRoomResponse {
  if (!ROOM_TYPES.includes(data.room_type)) {
    throw new Error(`Unknown room type ${JSON.stringify(data.room_type)}`);
  }
  return data;
}

/** Ask for a room type; the reply's room_type is what the server actually created. */
export const createRoom = (roomType: RoomType) =>
  postJSON<JoinRoomResponse>("/create-room", { room_type: roomType }).then(checkRoomType);

export const joinRoom = (roomCode: RoomCode) =>
  postJSON<JoinRoomResponse>("/join-room", { room_code: roomCode }).then(checkRoomType);

export const readyUp = (roomCode: RoomCode, playerId: string) =>
  postJSON<ReadyResponse>("/ready", { room_code: roomCode, player_id: playerId });

/** The target sentence of a playing room (shown in pvp rooms). */
export const getSentence = (roomCode: RoomCode) =>
  postJSON<SentenceResponse>("/sentence", { room_code: roomCode });

/** Send one dot/dash. The server owns the typed sentence and returns its current state. */
export const sendKeystroke = (roomCode: RoomCode, playerId: string, symbol: WireSymbol) =>
  postJSON<KeystrokeResponse>("/keystroke", { room_code: roomCode, player_id: playerId, symbol });

/** Open the per-player game socket. The server broadcasts room state changes on it. */
export function openRoomSocket(roomCode: RoomCode, playerId: string): WebSocket {
  return new WebSocket(
    `${WS_BASE}/game/${encodeURIComponent(roomCode)}/${encodeURIComponent(playerId)}`
  );
}
