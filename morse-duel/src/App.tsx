import { useState, useRef } from "react";
import type { RoomCode } from "./types";
import Lobby from "./component/Lobby";
import Room from "./component/Room";


// --- Module scope: created once, not on every render -------------------------
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const REQUEST_TIMEOUT_MS = 10_000;

export type CreateRoomResponse = { room_code: string; player_id: string };
export type JoinRoomResponse = { room_code: string; player_id: string };

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
      throw new Error(`${path} failed: ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Turn whatever fetch threw into something a human can read. */
function describeError(err: unknown): string {
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

export default function App() {
  const [roomCode, setRoomCode] = useState<RoomCode | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Non-render data (sent with later requests) — stable across renders.
  const playerIdRef = useRef<string | null>(null);

  const enterRoom = (code: string, playerId: string) => {
    setRoomCode(code as RoomCode); // cast once, at the API boundary
    setPlayerId(playerId);
    playerIdRef.current = playerId;
    setError(null);
  };

  const createRoom = async (): Promise<void> => {
    if (isLoading) return; // guards double-clicks
    setIsLoading(true);
    setError(null);

    try {
      const data = await postJSON<CreateRoomResponse>("/create-room");
      console.log("create-room →", data);          // <-- look at this
      console.log("room_code =", data?.room_code); // <-- and this

      enterRoom(data.room_code, data.player_id);
    } catch (err) {
      console.error("createRoom failed", err);
      setError(describeError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const joinRoom = async (code: RoomCode): Promise<void> => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      const data = await postJSON<JoinRoomResponse>("/join-room", { room_code: code });
      enterRoom(data.room_code, data.player_id); // <-- this was missing before
    } catch (err) {
      console.error("joinRoom failed", err);
      setError(describeError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const leaveRoom = () => {
    // Placeholder: would disconnect from room / close socket later
    setRoomCode(null);
    setPlayerId(null);
    playerIdRef.current = null;
    setError(null);
  };

  return (
    <div className="app">
      {roomCode ? (
        <Room roomCode={roomCode} onLeave={leaveRoom} />
      ) : (
        <Lobby
          onCreate={createRoom}
          onJoin={joinRoom}
          error={error}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}
