import type { RoomProps } from "../types";
import { correctPrefixLength, prettyMorse, sentLetters } from "../morse";
import MessageLane from "./MessageLane";
import TargetSentence from "./TargetSentence";

export default function Room({
  mode,
  roomCode,
  isHost,
  roomState,
  socketStatus,
  typed,
  opponentTyped,
  targetSentence,
  isYouSignalOn,
  isOpponentSignalOn,
  isReady,
  isReadying,
  isOpponentReady,
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
              <span className={`player-status ${isOpponentReady ? "ready" : ""}`}>
                {isOpponentReady === null ? "WAITING…" : isOpponentReady ? "READY" : "NOT READY"}
              </span>
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
          {isReady && isOpponentReady !== true && <p className="hint">Waiting for your opponent…</p>}
          {!isReady && isOpponentReady === true && <p className="hint">Your opponent is ready!</p>}
        </section>
      )}

      {roomState === "PLAYING" && mode === "duel" && (
        <section className="lanes">
          {targetSentence === null ? (
            <p className="hint">LOADING SENTENCE…</p>
          ) : (
            <>
              <DuelProgress
                label="YOU"
                tone="you"
                done={correctPrefixLength(targetSentence, sentLetters(typed))}
                total={targetSentence.length}
              />
              <DuelProgress
                label="OPPONENT"
                tone="opponent"
                done={correctPrefixLength(targetSentence, sentLetters(opponentTyped))}
                total={targetSentence.length}
              />
              <TargetSentence sentence={targetSentence} typed={typed} />
            </>
          )}
          <MessageLane label="YOU" typed={typed} anchor="center" tone="you" isSignalOn={isYouSignalOn} />
        </section>
      )}

      {roomState === "PLAYING" && mode === "chat" && (
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

/** How far through the target sentence a player is. */
function DuelProgress({
  label,
  tone,
  done,
  total,
}: {
  label: string;
  tone: "you" | "opponent";
  done: number;
  total: number;
}) {
  return (
    <div className={`duel-progress lane-${tone}`}>
      <span className="lane-label">{label}</span>
      <progress className="duel-progress-bar" value={done} max={total} aria-label={`${label} progress`} />
      <span className="duel-progress-count">
        {done}/{total}
      </span>
    </div>
  );
}
