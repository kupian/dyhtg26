import type { RoomProps } from "../types";

export default function Room({ roomCode, onLeave }: RoomProps) {
  // Extension point: connect signaling/voice/video/socket here later
  return (
    <main className="room">
      <header className="room-header">
        <span className="room-code">Room: {roomCode}</span>
        <button onClick={onLeave}>Leave</button>
      </header>
      <div className="room-body">
        <p>Room placeholders go here (participants, chat, media controls…).</p>
      </div>
    </main>
  );
}
