import { useState, useEffect, useRef, useCallback } from "react";
import type { KeySymbol, LogEntry, RoomCode, RoomState, SocketStatus, StateChangeMessage } from "./types";
import { MORSE_MAP } from "./types";
import * as api from "./api";
import { sound } from "./sound";
import Lobby from "./component/Lobby";
import Room from "./component/Room";

interface TapeItem {
  char: string;
  morse: string;
}

type Session = { roomCode: RoomCode; playerId: string; isHost: boolean };

const MAX_LOG_ENTRIES = 50;

const MENU_OPTIONS = [
  { id: "create", label: "CREATE GAME" },
  { id: "join", label: "JOIN GAME" },
  { id: "ref", label: "MORSE CHART" },
  { id: "settings", label: "SETTINGS" },
];

export default function App() {
  // --- Backend / session state (from vibecoded-frontend) --------------------
  const [session, setSession] = useState<Session | null>(null);
  const [roomState, setRoomState] = useState<RoomState>("WAITING");
  const [socketStatus, setSocketStatus] = useState<SocketStatus>("closed");
  const [sentence, setSentence] = useState<string | null>(null);
  const [events, setEvents] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isReadying, setIsReadying] = useState(false);

  // --- Audio / design state (from ai-front-end-test) ------------------------
  const [isMuted, setIsMuted] = useState(false);
  const [isFlashlightOn, setIsFlashlightOn] = useState(false);
  const [isOpponentGlow, setIsOpponentGlow] = useState(false);
  const [tapeItems, setTapeItems] = useState<TapeItem[]>([
    { char: "S", morse: "..." },
    { char: "O", morse: "---" },
    { char: "S", morse: "..." },
    { char: " ", morse: " " },
    { char: "R", morse: ".-." },
    { char: "E", morse: "." },
    { char: "A", morse: ".-" },
    { char: "D", morse: "-.." },
    { char: "Y", morse: "-.--" },
  ]);

  // Lobby navigation state
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isJoining, setIsJoining] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [showRefModal, setShowRefModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Pad visual press state
  const [isDotPadVisual, setIsDotPadVisual] = useState(false);
  const [isDashPadVisual, setIsDashPadVisual] = useState(false);

  // 2-Button chord tracking
  const isLeftDownRef = useRef(false);
  const isRightDownRef = useRef(false);
  const lastLeftDownTimeRef = useRef(0);
  const lastRightDownTimeRef = useRef(0);
  const chordActiveRef = useRef(false);
  const chordRegisteredRef = useRef(false);
  const pendingChordTimerRef = useRef<number | null>(null);
  const lastChordTimeRef = useRef(0);
  const lastBackTimeRef = useRef(0);

  const timeoutsRef = useRef<number[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const nextLogId = useRef(0);

  const log = useCallback((text: string) => {
    const entry = { id: nextLogId.current++, time: new Date().toLocaleTimeString(), text };
    setEvents((prev) => [entry, ...prev].slice(0, MAX_LOG_ENTRIES));
  }, []);

  const clearFlashSequence = useCallback(() => {
    timeoutsRef.current.forEach((t) => clearTimeout(t));
    timeoutsRef.current = [];
    setIsFlashlightOn(false);
    setIsOpponentGlow(false);
  }, []);

  const triggerFlash = useCallback(
    (durationMs = 120, isOpponent = false) => {
      clearFlashSequence();
      if (isOpponent) setIsOpponentGlow(true);
      else setIsFlashlightOn(true);

      const timeout = window.setTimeout(() => {
        setIsFlashlightOn(false);
        setIsOpponentGlow(false);
      }, durationMs) as unknown as number;
      timeoutsRef.current.push(timeout);
    },
    [clearFlashSequence]
  );

  const addTapeSymbol = useCallback((symbol: KeySymbol) => {
    const displayChar = symbol === "." ? "·" : "—";
    setTapeItems((prev) => [...prev, { char: displayChar, morse: symbol }].slice(-16));
  }, []);

  const deliverMorseMessage = useCallback(
    (text: string) => {
      clearFlashSequence();
      setTapeItems([]);

      const unit = 80;
      let timeOffset = 60;
      const textUpper = text.toUpperCase();

      for (let i = 0; i < textUpper.length; i++) {
        const char = textUpper[i];
        const code = MORSE_MAP[char];

        if (!code || char === " ") {
          timeOffset += unit * 3;
          const spaceItem: TapeItem = { char: " ", morse: " " };
          const stepTimeout = window.setTimeout(() => {
            setTapeItems((prev) => [...prev, spaceItem].slice(-16));
          }, timeOffset) as unknown as number;
          timeoutsRef.current.push(stepTimeout);
          continue;
        }

        for (const symbol of code) {
          const onTimeout = window.setTimeout(() => {
            setIsFlashlightOn(true);
            if (symbol === ".") sound.playDot(isMuted);
            else sound.playDash(isMuted);
          }, timeOffset) as unknown as number;
          timeoutsRef.current.push(onTimeout);

          const duration = symbol === "." ? unit : unit * 3;
          timeOffset += duration;

          const offTimeout = window.setTimeout(() => {
            setIsFlashlightOn(false);
          }, timeOffset) as unknown as number;
          timeoutsRef.current.push(offTimeout);

          timeOffset += unit;
        }

        const item: TapeItem = { char, morse: code };
        const appendTimeout = window.setTimeout(() => {
          setTapeItems((prev) => [...prev, item].slice(-16));
        }, timeOffset) as unknown as number;
        timeoutsRef.current.push(appendTimeout);

        timeOffset += unit * 2;
      }
    },
    [clearFlashSequence, isMuted]
  );

  // Initial landing greeting
  useEffect(() => {
    let timer: number | null = null;
    if (!session) {
      timer = window.setTimeout(() => {
        deliverMorseMessage("SOS READY");
      }, 50) as unknown as number;
    }
    return () => {
      if (timer) window.clearTimeout(timer);
      clearFlashSequence();
    };
  }, [session, deliverMorseMessage, clearFlashSequence]);

  // --- Backend integration --------------------------------------------------

  const loadSentence = useCallback(
    async (roomCode: RoomCode) => {
      log("→ POST /sentence");
      try {
        const data = await api.getSentence(roomCode);
        log(`← sentence: "${data.sentence}"`);
        setSentence(data.sentence);
      } catch (err) {
        log(`✗ /sentence: ${api.describeError(err)}`);
      }
    },
    [log]
  );

  const connect = useCallback(
    (roomCode: RoomCode, playerId: string) => {
      const ws = api.openRoomSocket(roomCode, playerId);
      socketRef.current = ws;
      setSocketStatus("connecting");
      log(`→ WS connect /game/${roomCode}/${playerId}`);

      const isCurrent = () => socketRef.current === ws;

      ws.onopen = () => {
        if (!isCurrent()) return;
        setSocketStatus("open");
        log("← WS open");
      };

      ws.onmessage = (ev: MessageEvent<string>) => {
        if (!isCurrent()) return;
        log(`← WS ${ev.data}`);

        let msg: StateChangeMessage | Record<string, unknown>;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          log("✗ WS message was not JSON");
          return;
        }

        if ("state" in msg && typeof msg.state === "string") {
          setRoomState(msg.state as RoomState);
          if (msg.state === "PLAYING") void loadSentence(roomCode);
        }

        // Future-proof: opponent signal flashes
        if ("type" in msg && msg.type === "opponent_signal") {
          const sym = msg.symbol;
          if (sym === "." || sym === "-") {
            triggerFlash(sym === "." ? 120 : 260, true);
            if (sym === ".") sound.playDot(isMuted);
            else sound.playDash(isMuted);
          }
        }
      };

      ws.onclose = (ev) => {
        if (!isCurrent()) return;
        setSocketStatus("closed");
        log(`← WS closed (${ev.code}${ev.reason ? `: ${ev.reason}` : ""})`);
      };
    },
    [log, loadSentence, triggerFlash, isMuted]
  );

  const enterRoom = useCallback(
    (code: string, playerId: string, isHost: boolean) => {
      const roomCode = code as RoomCode;
      setSession({ roomCode, playerId, isHost });
      setRoomState("WAITING");
      setSocketStatus("closed");
      setSentence(null);
      setError(null);
      setIsReady(false);
      setIsReadying(false);
      connect(roomCode, playerId);
    },
    [connect]
  );

  const createRoom = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.createRoom();
      log(`← created room ${data.room_code} as ${data.player_id}`);
      enterRoom(data.room_code, data.player_id, true);
      deliverMorseMessage(`ROOM ${data.room_code} CREATED`);
      sound.playMenu(isMuted);
    } catch (err) {
      console.error("createRoom failed", err);
      setError(api.describeError(err));
      sound.playError(isMuted);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, enterRoom, deliverMorseMessage, log, isMuted]);

  const joinRoom = useCallback(
    async (code: RoomCode) => {
      if (isLoading) return;
      setIsLoading(true);
      setError(null);
      try {
        const data = await api.joinRoom(code);
        log(`← joined room ${data.room_code} as ${data.player_id}`);
        enterRoom(data.room_code, data.player_id, false);
        setIsJoining(false);
        setJoinCode("");
        deliverMorseMessage(`ROOM ${code} JOINED`);
        sound.playMenu(isMuted);
      } catch (err) {
        console.error("joinRoom failed", err);
        setError(api.describeError(err));
        sound.playError(isMuted);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, enterRoom, deliverMorseMessage, log, isMuted]
  );

  const leaveRoom = useCallback(() => {
    const ws = socketRef.current;
    socketRef.current = null;
    ws?.close();
    setSession(null);
    setSocketStatus("closed");
    setRoomState("WAITING");
    setSentence(null);
    setEvents([]);
    setError(null);
    setIsReady(false);
    setIsReadying(false);
    setIsJoining(false);
    setJoinCode("");
    deliverMorseMessage("STANDBY");
    sound.playMenu(isMuted);
  }, [deliverMorseMessage, isMuted]);

  const readyUp = useCallback(async () => {
    if (!session || isReady || isReadying) return;
    setIsReadying(true);
    log("→ POST /ready");
    try {
      const data = await api.readyUp(session.roomCode, session.playerId);
      log(`← ${data.message}`);
      setIsReady(true);
      deliverMorseMessage("READY");
      sound.playMenu(isMuted);
    } catch (err) {
      log(`✗ /ready: ${api.describeError(err)}`);
      sound.playError(isMuted);
    } finally {
      setIsReadying(false);
    }
  }, [session, isReady, isReadying, log, deliverMorseMessage, isMuted]);

  const sendKeystroke = useCallback(
    async (symbol: KeySymbol) => {
      if (!session) return;
      addTapeSymbol(symbol);
      triggerFlash(symbol === "." ? 90 : 240);
      if (symbol === ".") sound.playDot(isMuted);
      else sound.playDash(isMuted);

      log(`→ POST /keystroke ${symbol}`);
      try {
        const data = await api.sendKeystroke(session.roomCode, session.playerId, symbol);
        log(`← keystroke: ${JSON.stringify(data)}`);
      } catch (err) {
        log(`✗ /keystroke: ${api.describeError(err)}`);
      }
    },
    [session, addTapeSymbol, triggerFlash, log, isMuted]
  );

  // Close socket on unmount
  useEffect(() => () => socketRef.current?.close(), []);

  // --- 2-Button action dispatch ---------------------------------------------

  const handleEnterAction = useCallback(() => {
    if (Date.now() - lastBackTimeRef.current < 600) return;
    sound.playMenu(isMuted);
    triggerFlash(140);

    if (showSettingsModal) {
      setIsMuted((m) => !m);
      return;
    }
    if (showRefModal) {
      setShowRefModal(false);
      return;
    }

    if (session) {
      if (roomState === "WAITING") {
        void readyUp();
      }
      return;
    }

    if (isJoining) {
      if (joinCode.length === 4) {
        void joinRoom(joinCode as RoomCode);
      } else {
        sound.playError(isMuted);
        deliverMorseMessage("ENTER 4 SIGNALS");
      }
      return;
    }

    if (selectedIndex === 0) {
      void createRoom();
    } else if (selectedIndex === 1) {
      setIsJoining(true);
      setJoinCode("");
      setError(null);
      deliverMorseMessage("ENTER 4 SIGNAL CODE TO JOIN");
    } else if (selectedIndex === 2) {
      setShowRefModal(true);
      deliverMorseMessage("MORSE CHART");
    } else if (selectedIndex === 3) {
      setShowSettingsModal(true);
      deliverMorseMessage("SETTINGS");
    }
  }, [
    showSettingsModal,
    showRefModal,
    session,
    roomState,
    isJoining,
    joinCode,
    selectedIndex,
    isMuted,
    triggerFlash,
    joinRoom,
    createRoom,
    deliverMorseMessage,
    readyUp,
  ]);

  const handleBackAction = useCallback(() => {
    if (pendingChordTimerRef.current !== null) {
      window.clearTimeout(pendingChordTimerRef.current);
      pendingChordTimerRef.current = null;
    }
    lastBackTimeRef.current = Date.now();
    sound.playMenu(isMuted);
    triggerFlash(80);

    if (showSettingsModal) {
      setShowSettingsModal(false);
      return;
    }
    if (showRefModal) {
      setShowRefModal(false);
      return;
    }
    if (isJoining) {
      setIsJoining(false);
      setJoinCode("");
      setError(null);
      deliverMorseMessage("CANCELLED");
      return;
    }
    if (session) {
      leaveRoom();
    }
  }, [showSettingsModal, showRefModal, isJoining, session, isMuted, triggerFlash, deliverMorseMessage, leaveRoom]);

  const handleLeftAction = useCallback(() => {
    if (Date.now() - lastBackTimeRef.current < 600) return;

    if (showSettingsModal) {
      setIsMuted((m) => !m);
      sound.playMenu(false);
      return;
    }
    if (showRefModal) {
      sound.playMenu(isMuted);
      return;
    }

    if (session) {
      if (roomState === "PLAYING") {
        void sendKeystroke(".");
      } else if (roomState === "WAITING") {
        triggerFlash(90);
        sound.playMenu(isMuted);
      }
      return;
    }

    if (isJoining) {
      if (joinCode.length < 4) {
        triggerFlash(90);
        sound.playDot(isMuted);
        setJoinCode((prev) => prev + ".");
        addTapeSymbol(".");
        setError(null);
      }
      return;
    }

    sound.playMenu(isMuted);
    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : MENU_OPTIONS.length - 1));
  }, [showSettingsModal, showRefModal, session, roomState, isJoining, joinCode.length, isMuted, triggerFlash, sendKeystroke, addTapeSymbol]);

  const handleRightAction = useCallback(() => {
    if (Date.now() - lastBackTimeRef.current < 600) return;

    if (showSettingsModal) {
      setIsMuted((m) => !m);
      sound.playMenu(false);
      return;
    }
    if (showRefModal) {
      sound.playMenu(isMuted);
      return;
    }

    if (session) {
      if (roomState === "PLAYING") {
        void sendKeystroke("-");
      } else if (roomState === "WAITING") {
        triggerFlash(240);
        sound.playMenu(isMuted);
      }
      return;
    }

    if (isJoining) {
      if (joinCode.length < 4) {
        triggerFlash(240);
        sound.playDash(isMuted);
        setJoinCode((prev) => prev + "-");
        addTapeSymbol("-");
        setError(null);
      }
      return;
    }

    sound.playMenu(isMuted);
    setSelectedIndex((prev) => (prev < MENU_OPTIONS.length - 1 ? prev + 1 : 0));
  }, [showSettingsModal, showRefModal, session, roomState, isJoining, joinCode.length, isMuted, triggerFlash, sendKeystroke, addTapeSymbol]);

  const onChordPress = useCallback(() => {
    chordActiveRef.current = true;
    const now = Date.now();
    if (now - lastBackTimeRef.current < 600) return;
    if (chordRegisteredRef.current) return; // already counted this simultaneous press

    chordRegisteredRef.current = true;

    if (pendingChordTimerRef.current !== null) {
      // Second chord arrived before the enter timer fired -> BACK
      window.clearTimeout(pendingChordTimerRef.current);
      pendingChordTimerRef.current = null;
      lastBackTimeRef.current = now;
      handleBackAction();
      return;
    }

    if (now - lastChordTimeRef.current < 400) {
      // Second chord shortly after the previous one -> BACK
      lastBackTimeRef.current = now;
      handleBackAction();
      return;
    }

    // First chord -> wait briefly; if no second chord arrives, trigger ENTER
    pendingChordTimerRef.current = window.setTimeout(() => {
      pendingChordTimerRef.current = null;
      if (Date.now() - lastBackTimeRef.current >= 600) {
        handleEnterAction();
      }
    }, 250) as unknown as number;
    lastChordTimeRef.current = now;
  }, [handleBackAction, handleEnterAction]);

  const handleDotPointerDown = useCallback(() => {
    isLeftDownRef.current = true;
    lastLeftDownTimeRef.current = Date.now();
    setIsDotPadVisual(true);

    if (isRightDownRef.current || Date.now() - lastRightDownTimeRef.current < 160) {
      onChordPress();
    }
  }, [onChordPress]);

  const handleDotPointerUp = useCallback(() => {
    isLeftDownRef.current = false;
    setIsDotPadVisual(false);

    if (Date.now() - lastBackTimeRef.current < 600) {
      chordActiveRef.current = false;
      if (!isRightDownRef.current) chordRegisteredRef.current = false;
      return;
    }

    if (chordActiveRef.current) {
      if (!isRightDownRef.current) {
        chordActiveRef.current = false;
        chordRegisteredRef.current = false;
      }
    } else {
      handleLeftAction();
    }
  }, [handleLeftAction]);

  const handleDashPointerDown = useCallback(() => {
    isRightDownRef.current = true;
    lastRightDownTimeRef.current = Date.now();
    setIsDashPadVisual(true);

    if (isLeftDownRef.current || Date.now() - lastLeftDownTimeRef.current < 160) {
      onChordPress();
    }
  }, [onChordPress]);

  const handleDashPointerUp = useCallback(() => {
    isRightDownRef.current = false;
    setIsDashPadVisual(false);

    if (Date.now() - lastBackTimeRef.current < 600) {
      chordActiveRef.current = false;
      if (!isLeftDownRef.current) chordRegisteredRef.current = false;
      return;
    }

    if (chordActiveRef.current) {
      if (!isLeftDownRef.current) {
        chordActiveRef.current = false;
        chordRegisteredRef.current = false;
      }
    } else {
      handleRightAction();
    }
  }, [handleRightAction]);

  // Keyboard navigation listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (document.activeElement?.tagName === "INPUT") return;

      const isDotKey = e.key === "." || e.key === "z" || e.key === "Z" || e.key === "ArrowLeft";
      const isDashKey = e.key === "-" || e.key === "x" || e.key === "X" || e.key === "ArrowRight";

      if (isDotKey) {
        e.preventDefault();
        handleDotPointerDown();
      } else if (isDashKey) {
        e.preventDefault();
        handleDashPointerDown();
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (Date.now() - lastBackTimeRef.current >= 600) {
          handleEnterAction();
        }
      } else if (e.key === "Escape" || e.key === "Backspace") {
        e.preventDefault();
        handleBackAction();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const isDotKey = e.key === "." || e.key === "z" || e.key === "Z" || e.key === "ArrowLeft";
      const isDashKey = e.key === "-" || e.key === "x" || e.key === "X" || e.key === "ArrowRight";

      if (isDotKey) handleDotPointerUp();
      if (isDashKey) handleDashPointerUp();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    handleDotPointerDown,
    handleDotPointerUp,
    handleDashPointerDown,
    handleDashPointerUp,
    handleEnterAction,
    handleBackAction,
  ]);

  return (
    <div className="app">
      <header className="top-bar">
        <div className="brand">
          <span className="brand-title">MORSE DUEL</span>
          <span className="brand-sub">[ 2-ACTION ]</span>
        </div>
        {isMuted && <span className="top-status muted-badge">[ MUTED ]</span>}
      </header>

      <section className="flashlight-container" aria-label="Morse Flashlight Indicator">
        <div
          className={`flashlight ${
            isFlashlightOn ? "active" : isOpponentGlow ? "active-opponent" : ""
          }`}
        />

        <div className="morse-display">
          <div className="teletype-tape">
            {tapeItems.map((item, idx) => (
              <div
                key={idx}
                className={`tape-pair ${item.char === " " ? "space" : ""}`}
              >
                <span className="tape-morse">{item.morse}</span>
                <span className="tape-char">{item.char}</span>
              </div>
            ))}
          </div>
          <span className="cursor" />
        </div>
      </section>

      {session ? (
        <Room
          roomCode={session.roomCode}
          playerId={session.playerId}
          isHost={session.isHost}
          roomState={roomState}
          socketStatus={socketStatus}
          sentence={sentence}
          events={events}
          isReady={isReady}
          isReadying={isReadying}
          isMuted={isMuted}
          onLog={log}
          onLeave={leaveRoom}
          onReady={readyUp}
          onSendSignal={sendKeystroke}
        />
      ) : (
        <Lobby
          onCreate={createRoom}
          onJoin={joinRoom}
          isLoading={isLoading}
          errorMessage={error}
          onClearError={() => setError(null)}
          isMuted={isMuted}
          onToggleMute={() => setIsMuted((m) => !m)}
          selectedIndex={selectedIndex}
          onSelectIndexChange={setSelectedIndex}
          isJoining={isJoining}
          onToggleJoining={setIsJoining}
          joinCode={joinCode}
          onJoinCodeChange={setJoinCode}
          showRefModal={showRefModal}
          onToggleRefModal={setShowRefModal}
          showSettingsModal={showSettingsModal}
          onToggleSettingsModal={setShowSettingsModal}
          onTriggerMessageDelivery={deliverMorseMessage}
        />
      )}

      <div className="chord-banner">
        <span>
          BOTH 1x: <span className="chord-action">ENTER</span>
        </span>
        <span>|</span>
        <span>
          BOTH 2x: <span className="chord-action">BACK</span>
        </span>
      </div>

      <footer className="input-pads">
        <button
          type="button"
          className={`pad-btn ${isDotPadVisual ? "pressed" : ""}`}
          onPointerDown={handleDotPointerDown}
          onPointerUp={handleDotPointerUp}
          onPointerCancel={handleDotPointerUp}
          aria-label="Dot Button - Left Action"
        >
          <span className="dot-icon" />
          <span className="pad-hint">DOT [ . / Z ]</span>
        </button>

        <button
          type="button"
          className={`pad-btn ${isDashPadVisual ? "pressed" : ""}`}
          onPointerDown={handleDashPointerDown}
          onPointerUp={handleDashPointerUp}
          onPointerCancel={handleDashPointerUp}
          aria-label="Dash Button - Right Action"
        >
          <span className="dash-icon" />
          <span className="pad-hint">DASH [ - / X ]</span>
        </button>
      </footer>
    </div>
  );
}
