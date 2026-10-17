import type { RoomProps } from "../types";

export default function Room({
  roomCode,
  playerId,
  isHost,
  roomState,
  socketStatus,
  typed,
  events,
  isReady,
  isReadying,
  onReady,
}: RoomProps) {
  const statusLabel =
    socketStatus === "open" ? "CONNECTED" : socketStatus === "connecting" ? "CONNECTING" : "DISCONNECTED";

  return (
    <main className="room">
      <header className="room-header">
        <div className="room-code-badge">
          <span className="room-label">ROOM CODE</span>
          <span className="room-code-val">{roomCode}</span>
        </div>
        <span className={`status-indicator ${socketStatus}`}>
          <span className={`status-dot ${socketStatus}`} />
          {statusLabel}
        </span>
      </header>

      <div className="players-grid">
        <div className={`player-card ${isHost ? "is-you" : ""}`}>
          <div className="player-card-header">
            <span className="player-name">YOU</span>
            {isHost && <span className="badge host">HOST</span>}
          </div>
          <span className="badge">{playerId.slice(0, 8)}</span>
        </div>
        <div className={`player-card ${!isHost ? "is-you" : ""}`}>
          <div className="player-card-header">
            <span className="player-name">OPPONENT</span>
            {!isHost && <span className="badge host">HOST</span>}
          </div>
          <span className="badge">{roomState === "WAITING" ? "WAITING..." : "IN GAME"}</span>
        </div>
      </div>

      {roomState === "WAITING" && (
        <div className="duel-track">
          <div className="duel-track-header">
            <span>LOBBY</span>
            <span>{isReady ? "READY" : "NOT READY"}</span>
          </div>
          <button
            type="button"
            className="primary"
            onClick={onReady}
            disabled={isReady || isReadying || socketStatus !== "open"}
          >
            {isReady ? "READY ✓" : isReadying ? "READING..." : "READY UP"}
          </button>
          {isReady && (
            <p className="hint" style={{ textAlign: "center" }}>
              Waiting for your opponent…
            </p>
          )}
        </div>
      )}

      {roomState === "PLAYING" && (
        <div className="duel-track">
          <div className="duel-track-header">
            <span>YOUR MESSAGE</span>
            <span>{typed.ascii.length} CHARS</span>
          </div>
          <div className="transmission-display">
            <span className="decoded-stream typed-ascii">{typed.ascii || "_"}</span>
            <span className="morse-stream typed-morse">{typed.morse}</span>
          </div>

          <p className="hint" style={{ textAlign: "center" }}>
            Tap DOT / DASH or press . / - · Both together = letter space
          </p>
        </div>
      )}

      {roomState === "FINISHED" && (
        <div className="duel-track">
          <div className="duel-track-header">
            <span>GAME OVER</span>
          </div>
          <div className="transmission-display">
            <span className="decoded-stream">TRANSMISSION COMPLETE</span>
          </div>
        </div>
      )}

      <section className="event-log">
        <h2>EVENTS</h2>
        <ol>
          {events.map((e) => (
            <li key={e.id}>
              <time>{e.time}</time> {e.text}
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
