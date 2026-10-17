import { useState } from "react";
import type { RoomCode } from "./types";
import Lobby from "./component/Lobby";
import Room from "./component/Room";

export default function App() {
  const [roomCode, setRoomCode] = useState<RoomCode | null>(null);

  const createRoom = () => {
    // Placeholder code generation — swap for server-issued codes later
    const code = Math.random().toString(36).slice(2, 8).toUpperCase() as RoomCode;
    setRoomCode(code);
  };

  const joinRoom = (code: RoomCode) => {
    setRoomCode(code.trim().toUpperCase());
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
