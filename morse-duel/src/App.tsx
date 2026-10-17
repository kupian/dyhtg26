import { useEffect, useRef, useState } from "react";
import type { LogEntry, RoomCode, RoomState, SocketStatus, StateChangeMessage } from "./types";
import * as api from "./api";
import Lobby from "./component/Lobby";
import Room from "./component/Room";

type Session = { roomCode: RoomCode; playerId: string };

const MAX_LOG_ENTRIES = 50;

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [roomState, setRoomState] = useState<RoomState>("WAITING");
  const [socketStatus, setSocketStatus] = useState<SocketStatus>("closed");
  const [sentence, setSentence] = useState<string | null>(null);
  const [events, setEvents] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // The live socket. Opened from event handlers (not an effect) so StrictMode's
  // double-mount can't open and immediately drop a second connection.
  const socketRef = useRef<WebSocket | null>(null);
  const nextLogId = useRef(0);

  const log = (text: string) => {
    const entry = { id: nextLogId.current++, time: new Date().toLocaleTimeString(), text };
    setEvents((prev) => [entry, ...prev].slice(0, MAX_LOG_ENTRIES));
  };

  // Close the socket if the whole app unmounts.
  useEffect(() => () => socketRef.current?.close(), []);

  const loadSentence = async (roomCode: RoomCode) => {
    log("→ POST /sentence");
    try {
      const data = await api.getSentence(roomCode);
      log(`← sentence: "${data.sentence}"`);
      setSentence(data.sentence);
    } catch (err) {
      log(`✗ /sentence: ${api.describeError(err)}`);
    }
  };

  const connect = (roomCode: RoomCode, playerId: string) => {
    const ws = api.openRoomSocket(roomCode, playerId);
    socketRef.current = ws;
    setSocketStatus("connecting");
    log(`→ WS connect /game/${roomCode}/${playerId}`);

    // Ignore events from a socket we've since replaced or left behind.
    const isCurrent = () => socketRef.current === ws;

    ws.onopen = () => {
      if (!isCurrent()) return;
      setSocketStatus("open");
      log("← WS open");
    };

    ws.onmessage = (ev: MessageEvent<string>) => {
      if (!isCurrent()) return;
      log(`← WS ${ev.data}`);

      let msg: StateChangeMessage;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        log("✗ WS message was not JSON");
        return;
      }
      if (!msg.state) return;

      setRoomState(msg.state);
      if (msg.state === "PLAYING") void loadSentence(roomCode);
    };

    ws.onclose = (ev) => {
      if (!isCurrent()) return;
      setSocketStatus("closed");
      log(`← WS closed (${ev.code}${ev.reason ? `: ${ev.reason}` : ""})`);
    };
  };

  const enterRoom = (code: string, playerId: string) => {
    const roomCode = code as RoomCode; // cast once, at the API boundary
    setSession({ roomCode, playerId });
    setRoomState("WAITING");
    setSentence(null);
    setError(null);
    connect(roomCode, playerId);
  };

  const createRoom = async (): Promise<void> => {
    if (isLoading) return; // guards double-clicks
    setIsLoading(true);
    setError(null);

    try {
      const data = await api.createRoom();
      log(`← created room ${data.room_code} as ${data.player_id}`);
      enterRoom(data.room_code, data.player_id);
    } catch (err) {
      console.error("createRoom failed", err);
      setError(api.describeError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const joinRoom = async (code: RoomCode): Promise<void> => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      const data = await api.joinRoom(code);
      log(`← joined room ${data.room_code} as ${data.player_id}`);
      enterRoom(data.room_code, data.player_id);
    } catch (err) {
      console.error("joinRoom failed", err);
      setError(api.describeError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const leaveRoom = () => {
    // The server has no leave endpoint yet; this only drops the socket.
    const ws = socketRef.current;
    socketRef.current = null;
    ws?.close();
    setSession(null);
    setSocketStatus("closed");
    setRoomState("WAITING");
    setSentence(null);
    setEvents([]);
    setError(null);
  };

  return (
    <div className="app">
      {session ? (
        <Room
          roomCode={session.roomCode}
          playerId={session.playerId}
          roomState={roomState}
          socketStatus={socketStatus}
          sentence={sentence}
          events={events}
          onLog={log}
          onLeave={leaveRoom}
        />
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
