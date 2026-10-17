import type { RoomProps } from "../types";
import { prettyMorse } from "../morse";
import MessageLane from "./MessageLane";

export default function Room({
  mode,
  roomCode,
  isHost,
  roomState,
  socketStatus,
  typed,
  opponentTyped,
  isYouSignalOn,
  isOpponentSignalOn,
  isReady,
  isReadying,
  onReady,
}: RoomProps) {
  return (
    <main className={`room mode-${mode}`}>
      {roomState === "WAITING" && (
        <section className="lobby-panel">
          <p className="room-code-line">
            ROOM: <span className="room-code">{prettyMorse(roomCode)}</span>
          </p>

          <div className="players-grid">
            <div className="player-card is-you">
              <div className="player-card-header">
                <span className="player-name">YOU</span>
                {isHost && <span className="badge host">HOST</span>}
              </div>
              <span className={`player-status ${isReady ? "ready" : ""}`}>
                {isReady ? "READY" : "NOT READY"}
              </span>
            </div>
            <div className="player-card">
              <div className="player-card-header">
                <span className="player-name">OPPONENT</span>
                {!isHost && <span className="badge host">HOST</span>}
              </div>
              <span className="player-status">WAITING…</span>
            </div>
          </div>

          <button
            type="button"
            className="primary"
            onClick={onReady}
            disabled={isReady || isReadying || socketStatus !== "open"}
          >
            {isReady ? "READY ✓" : isReadying ? "READYING…" : "READY UP"}
          </button>
          {isReady && <p className="hint">Waiting for your opponent…</p>}
        </section>
      )}

      {roomState === "PLAYING" && (
        <section className="lanes">
          <MessageLane
            label="OPPONENT"
            typed={opponentTyped}
            anchor="right"
            tone="opponent"
            isSignalOn={isOpponentSignalOn}
          />
          <MessageLane label="YOU" typed={typed} anchor="center" tone="you" isSignalOn={isYouSignalOn} />
        </section>
      )}

      {roomState === "FINISHED" && <p className="room-finished">TRANSMISSION COMPLETE</p>}
    </main>
  );
}
