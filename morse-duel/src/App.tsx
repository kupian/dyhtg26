import { useState, useRef } from "react";
import type { RoomCode } from "./types";
import Lobby from "./component/Lobby";
import Room from "./component/Room";

export default function App() {
    const [roomCode, setRoomCode] = useState<RoomCode | null>(null);
    const playerIdRef = useRef("");
    
    const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

    type CreateRoomResponse = { room_code: string; player_id: string };
    type JoinRoomResponse   = { room_code: string; /* ... */ };

    const createRoom = async (): Promise<CreateRoomResponse | null> => {
      try {
        const res = await fetch(`${API_BASE}/create-room`, { method: 'POST' });
        if (!res.ok) throw new Error(`create-room failed: ${res.status}`);

        const data: CreateRoomResponse = await res.json();
        setRoomCode(data.room_code);
        playerIdRef.current = data.player_id; // or setPlayerId(...)
        return data;
      } catch (err) {
        console.error('createRoom failed', err);
        return null;
      }
    };

  const joinRoom = async (roomCode: RoomCode): Promise<JoinRoomResponse | null> => {
    try {
      const res = await fetch(`${API_BASE}/join-room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_code: roomCode }),
      });
      if (!res.ok) return null;

      return (await res.json()) as JoinRoomResponse;
    } catch (err) {
      console.error('joinRoom failed', err);
      return null;
    }
  };


  const leaveRoom = () => {
    // Placeholder: would disconnect from room / close socket later
    setRoomCode(null);
  };

  return (
    <div className="app">
      {roomCode ? (
        <Room roomCode={roomCode} onLeave={leaveRoom} />
      ) : (
        <Lobby onCreate={createRoom} onJoin={joinRoom} />
      )}
    </div>
  );
}
