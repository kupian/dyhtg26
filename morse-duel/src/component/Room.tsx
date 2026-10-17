import { useEffect, useState } from "react";
import type { KeySymbol, RoomProps } from "../types";
import * as api from "../api";
import { ServerText } from "./ServerText";

export default function Room({
  roomCode,
  playerId,
  roomState,
  socketStatus,
  sentence,
  events,
  onLog,
  onLeave,
}: RoomProps) {
  const [isReady, setIsReady] = useState(false);
  const [isReadying, setIsReadying] = useState(false);
  // Raw /keystroke response — the server owns typed state, we just show it.
  const [typedState, setTypedState] = useState<unknown>(null);

  const readyUp = async () => {
    if (isReady || isReadying) return;
    setIsReadying(true);
    onLog("→ POST /ready");
    try {
      const data = await api.readyUp(roomCode, playerId);
      onLog(`← ${data.message}`);
      setIsReady(true);
    } catch (err) {
      onLog(`✗ /ready: ${api.describeError(err)}`);
    } finally {
      setIsReadying(false);
    }
  };

  const sendKeystroke = async (symbol: KeySymbol) => {
    onLog(`→ POST /keystroke ${symbol}`);
    try {
      const data = await api.sendKeystroke(roomCode, playerId, symbol);
      onLog(`← keystroke: ${JSON.stringify(data)}`);
      setTypedState(data);
    } catch (err) {
      onLog(`✗ /keystroke: ${api.describeError(err)}`);
    }
  };

  // Keyboard input while playing: "." for dot, "-" for dash.
  useEffect(() => {
    if (roomState !== "PLAYING") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === "." || e.key === "-") void sendKeystroke(e.key);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sendKeystroke only closes over stable props
  }, [roomState, roomCode, playerId]);

  return (
    <main className="room">
      <header className="room-header">
        <span className="room-code">Room: {roomCode}</span>
        <button onClick={onLeave}>Leave</button>
      </header>
      <div className="room-body">
        <dl className="room-status">
          <dt>Player</dt>
          <dd title={playerId}>{playerId.slice(0, 8)}</dd>
          <dt>Socket</dt>
          <dd className={`socket-${socketStatus}`}>{socketStatus}</dd>
          <dt>Room</dt>
          <dd>{roomState}</dd>
        </dl>

        {roomState === "WAITING" && (
          <div className="actions">
            <button
              className="primary"
              onClick={readyUp}
              disabled={isReady || isReadying || socketStatus !== "open"}
            >
              {isReady ? "Ready ✓" : "Ready"}
            </button>
            {isReady && <p className="hint">Waiting for your opponent…</p>}
          </div>
        )}

        {roomState === "PLAYING" && (
          <div className="game">
            {sentence ? (
              <>
                <ServerText sentence={sentence} step={0} maxWidth={372} />
                <p className="sentence">{sentence}</p>
              </>
            ) : (
              <p className="hint">Loading sentence…</p>
            )}

            <div className="keys">
              <button onClick={() => sendKeystroke(".")} aria-label="Dot">
                ·
              </button>
              <button onClick={() => sendKeystroke("-")} aria-label="Dash">
                −
              </button>
            </div>
            <p className="hint">or press . and - on your keyboard</p>

            {typedState !== null && (
              <pre className="typed-state">{JSON.stringify(typedState, null, 2)}</pre>
            )}
          </div>
        )}

        <section className="event-log">
          <h2>Events</h2>
          <ol>
            {events.map((e) => (
              <li key={e.id}>
                <time>{e.time}</time> {e.text}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}
