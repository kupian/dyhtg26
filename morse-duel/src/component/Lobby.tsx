import { useState, type FormEvent } from "react";
import type { LobbyProps, RoomCode } from "../types";

export default function Lobby({ onCreate, onJoin }: LobbyProps) {
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [code, setCode] = useState("");

  const handleJoin = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (code.trim()) onJoin(code.trim().toUpperCase() as RoomCode);
  };

  return (
    <main className="lobby">
      <h1>Rooms</h1>

      {showJoinForm ? (
        <form className="join-form" onSubmit={handleJoin}>
          <input
            autoFocus
            placeholder="Enter room code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button type="submit" disabled={!code.trim()}>
            Join
          </button>
          <button
            type="button"
            className="link"
            onClick={() => setShowJoinForm(false)}
          >
            Cancel
          </button>
        </form>
      ) : (
        <div className="actions">
          <button className="primary" onClick={onCreate}>
            Create Room
          </button>
          <button onClick={() => setShowJoinForm(true)}>
            Join Room
          </button>
        </div>
      )}
    </main>
  );
}
