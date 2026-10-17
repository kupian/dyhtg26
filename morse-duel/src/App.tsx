import { useState, useEffect, useRef, useCallback } from "react";
import type {
  KeySymbol,
  LogEntry,
  OpponentTypedMessage,
  RoomCode,
  RoomState,
  SocketStatus,
  StateChangeMessage,
  TypedMessage,
  WireSymbol,
} from "./types";
import { EMPTY_TYPED, MORSE_MAP, NEWCHAR } from "./types";
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

// In-game typing: a letter is finished after this long with no dot/dash...
const LETTER_IDLE_MS = 1000;
// ...or by a chord (both buttons). Two chords within this window add a space.
const DOUBLE_CHORD_MS = 500;

// Room codes are 4 dots/dashes (ROOM_CODES in server/src/server/game.py)
const ROOM_CODE_LENGTH = 4;
const JOIN_INVALID_FLASH_MS = 700;

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
  const [events, setEvents] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isReadying, setIsReadying] = useState(false);
  // Latest typed message from /keystroke — the server owns typed state.
  const [typed, setTyped] = useState<TypedMessage>(EMPTY_TYPED);
  // Opponent's typed message, pushed over the game socket as they type.
  const [opponentTyped, setOpponentTyped] = useState<TypedMessage>(EMPTY_TYPED);

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
  // A rejected code is shown red briefly, then cleared for another attempt.
  const [isJoinCodeInvalid, setIsJoinCodeInvalid] = useState(false);
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
  // The server appends symbols in arrival order, so keystrokes are sent one at a time.
  const keystrokeQueueRef = useRef<Promise<void>>(Promise.resolve());
  // Bumped on enter/leave so queued keystrokes from an old room are dropped.
  const keystrokeGenRef = useRef(0);
  // Dots/dashes sent since the last NEWCHAR — i.e. a letter is in progress.
  const letterPendingRef = useRef(false);
  const letterTimerRef = useRef<number | null>(null);
  const lastGameChordRef = useRef(0);

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

  const addTapeSymbol = useCallback((symbol: KeySymbol | " ") => {
    const item = symbol === " " ? { char: " ", morse: " " } : { char: symbol === "." ? "·" : "—", morse: symbol };
    setTapeItems((prev) => [...prev, item].slice(-16));
  }, []);

  const clearLetterTimer = useCallback(() => {
    if (letterTimerRef.current !== null) {
      window.clearTimeout(letterTimerRef.current);
      letterTimerRef.current = null;
    }
  }, []);

  const resetTyping = useCallback(() => {
    keystrokeGenRef.current++;
    clearLetterTimer();
    letterPendingRef.current = false;
    lastGameChordRef.current = 0;
    setTyped(EMPTY_TYPED);
    setOpponentTyped(EMPTY_TYPED);
  }, [clearLetterTimer]);

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

        let msg: StateChangeMessage | OpponentTypedMessage | Record<string, unknown>;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          log("✗ WS message was not JSON");
          return;
        }

        if ("state" in msg && typeof msg.state === "string") {
          setRoomState(msg.state as RoomState);
        }

        if (
          "opponent_morse" in msg &&
          typeof msg.opponent_morse === "string" &&
          typeof msg.opponent_ascii === "string"
        ) {
          setOpponentTyped({ ascii: msg.opponent_ascii, morse: msg.opponent_morse });

          // Flash/beep the opponent's dot or dash (not their NEWCHAR or space)
          const sym = msg.opponent_morse.slice(-1);
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
    [log, triggerFlash, isMuted]
  );

  const enterRoom = useCallback(
    (code: string, playerId: string, isHost: boolean) => {
      const roomCode = code as RoomCode;
      setSession({ roomCode, playerId, isHost });
      setRoomState("WAITING");
      setSocketStatus("closed");
      resetTyping();
      setError(null);
      setIsReady(false);
      setIsReadying(false);
      connect(roomCode, playerId);
    },
    [connect, resetTyping]
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
        setIsJoinCodeInvalid(true);
        window.setTimeout(() => {
          setIsJoinCodeInvalid(false);
          setJoinCode("");
        }, JOIN_INVALID_FLASH_MS);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, enterRoom, deliverMorseMessage, log, isMuted]
  );

  /** Add a dot/dash to the join code; the 4th symbol submits it. */
  const typeJoinSymbol = useCallback(
    (symbol: KeySymbol) => {
      if (joinCode.length >= ROOM_CODE_LENGTH) return; // joining, or showing a rejected code
      triggerFlash(symbol === "." ? 90 : 240);
      if (symbol === ".") sound.playDot(isMuted);
      else sound.playDash(isMuted);
      addTapeSymbol(symbol);
      setError(null);

      const next = joinCode + symbol;
      setJoinCode(next);
      if (next.length === ROOM_CODE_LENGTH) void joinRoom(next as RoomCode);
    },
    [joinCode, triggerFlash, isMuted, addTapeSymbol, joinRoom]
  );

  const leaveRoom = useCallback(() => {
    const ws = socketRef.current;
    socketRef.current = null;
    ws?.close();
    setSession(null);
    setSocketStatus("closed");
    setRoomState("WAITING");
    resetTyping();
    setEvents([]);
    setError(null);
    setIsReady(false);
    setIsReadying(false);
    setIsJoining(false);
    setJoinCode("");
    deliverMorseMessage("STANDBY");
    sound.playMenu(isMuted);
  }, [deliverMorseMessage, isMuted, resetTyping]);

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

  // --- In-game typing ---------------------------------------------------------
  // Dots/dashes are sent as typed. A letter is finished by LETTER_IDLE_MS without
  // input or by one chord, which sends NEWCHAR; two chords in a row add a space.

  /** Queue a keystroke behind any in flight, so the server sees them in typed order. */
  const postKeystroke = useCallback(
    (symbol: WireSymbol) => {
      if (!session) return;
      const { roomCode, playerId } = session;
      const gen = keystrokeGenRef.current;

      keystrokeQueueRef.current = keystrokeQueueRef.current.then(async () => {
        if (gen !== keystrokeGenRef.current) return; // left the room while queued
        log(`→ POST /keystroke ${JSON.stringify(symbol)}`);
        try {
          const data = await api.sendKeystroke(roomCode, playerId, symbol);
          if (gen !== keystrokeGenRef.current) return;
          log(`← keystroke: ${JSON.stringify(data)}`);
          setTyped({ ascii: data.current_sentence_ascii, morse: data.current_sentence_morse });
        } catch (err) {
          log(`✗ /keystroke: ${api.describeError(err)}`);
        }
      });
    },
    [session, log]
  );

  /** End the letter in progress, if any. */
  const commitLetter = useCallback(() => {
    clearLetterTimer();
    if (!letterPendingRef.current) return;
    letterPendingRef.current = false;
    postKeystroke(NEWCHAR);
  }, [clearLetterTimer, postKeystroke]);

  const typeSymbol = useCallback(
    (symbol: KeySymbol) => {
      addTapeSymbol(symbol);
      triggerFlash(symbol === "." ? 90 : 240);
      if (symbol === ".") sound.playDot(isMuted);
      else sound.playDash(isMuted);

      postKeystroke(symbol);
      letterPendingRef.current = true;
      lastGameChordRef.current = 0; // a symbol between two chords breaks the double-chord
      clearLetterTimer();
      letterTimerRef.current = window.setTimeout(commitLetter, LETTER_IDLE_MS);
    },
    [addTapeSymbol, triggerFlash, isMuted, postKeystroke, clearLetterTimer, commitLetter]
  );

  /** Both buttons together: once ends the letter, twice in a row adds a space. */
  const handleGameChord = useCallback(() => {
    const now = Date.now();
    sound.playMenu(isMuted);
    triggerFlash(140);

    if (now - lastGameChordRef.current < DOUBLE_CHORD_MS) {
      lastGameChordRef.current = 0;
      commitLetter(); // normally already done by the first chord
      addTapeSymbol(" ");
      postKeystroke(" ");
      postKeystroke(NEWCHAR);
    } else {
      lastGameChordRef.current = now;
      commitLetter();
    }
  }, [isMuted, triggerFlash, commitLetter, addTapeSymbol, postKeystroke]);

  const inGame = session !== null && roomState === "PLAYING";

  // Close socket and stop the letter timer on unmount
  useEffect(
    () => () => {
      socketRef.current?.close();
      clearLetterTimer();
    },
    [clearLetterTimer]
  );

  // --- 2-Button action dispatch ---------------------------------------------

  const handleEnterAction = useCallback(() => {
    if (Date.now() - lastBackTimeRef.current < 600) return;
    if (inGame) {
      handleGameChord(); // keyboard Enter/Space acts like pressing both buttons
      return;
    }
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
      // A full code submits itself (typeJoinSymbol); ENTER only prompts for the rest.
      if (joinCode.length < ROOM_CODE_LENGTH) {
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
    createRoom,
    deliverMorseMessage,
    readyUp,
    inGame,
    handleGameChord,
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
        typeSymbol(".");
      } else if (roomState === "WAITING") {
        triggerFlash(90);
        sound.playMenu(isMuted);
      }
      return;
    }

    if (isJoining) {
      typeJoinSymbol(".");
      return;
    }

    // Main menu: left selects the highlighted option (right cycles through them)
    handleEnterAction();
  }, [showSettingsModal, showRefModal, session, roomState, isJoining, isMuted, triggerFlash, typeSymbol, typeJoinSymbol, handleEnterAction]);

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
        typeSymbol("-");
      } else if (roomState === "WAITING") {
        triggerFlash(240);
        sound.playMenu(isMuted);
      }
      return;
    }

    if (isJoining) {
      typeJoinSymbol("-");
      return;
    }

    // Main menu: right cycles to the next option, wrapping to the top
    sound.playMenu(isMuted);
    setSelectedIndex((prev) => (prev < MENU_OPTIONS.length - 1 ? prev + 1 : 0));
  }, [showSettingsModal, showRefModal, session, roomState, isJoining, isMuted, triggerFlash, typeSymbol, typeJoinSymbol]);

  const onChordPress = useCallback(() => {
    chordActiveRef.current = true;
    const now = Date.now();
    if (now - lastBackTimeRef.current < 600) return;
    if (chordRegisteredRef.current) return; // already counted this simultaneous press

    chordRegisteredRef.current = true;

    if (inGame) {
      // In game a chord acts immediately (no ENTER/BACK wait); a double chord is a space.
      handleGameChord();
      return;
    }

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
  }, [handleBackAction, handleEnterAction, inGame, handleGameChord]);

  // Menus accept a sloppy chord (second press within 160ms); in game both must be held,
  // otherwise a quick dash-then-dot would end the letter.
  const isChordWith = useCallback(
    (otherDown: boolean, otherLastDown: number) =>
      otherDown || (!inGame && Date.now() - otherLastDown < 160),
    [inGame]
  );

  const handleDotPointerDown = useCallback(() => {
    isLeftDownRef.current = true;
    lastLeftDownTimeRef.current = Date.now();
    setIsDotPadVisual(true);

    if (isChordWith(isRightDownRef.current, lastRightDownTimeRef.current)) {
      onChordPress();
    }
  }, [onChordPress, isChordWith]);

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

    if (isChordWith(isLeftDownRef.current, lastLeftDownTimeRef.current)) {
      onChordPress();
    }
  }, [onChordPress, isChordWith]);

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
          typed={typed}
          opponentTyped={opponentTyped}
          events={events}
          isReady={isReady}
          isReadying={isReadying}
          isMuted={isMuted}
          onLog={log}
          onLeave={leaveRoom}
          onReady={readyUp}
          onSendSignal={typeSymbol}
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
          isJoinCodeInvalid={isJoinCodeInvalid}
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
