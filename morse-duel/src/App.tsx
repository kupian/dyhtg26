import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type CSSProperties,
} from "react";
import type {
  KeySymbol,
  OpponentConnectedMessage,
  OpponentReadyMessage,
  OpponentTypedMessage,
  RoomCode,
  RoomMode,
  RoomState,
  SocketStatus,
  StateChangeMessage,
  TitleKey,
  TypedMessage,
  WireSymbol,
} from "./types";
import { EMPTY_TYPED, NEWCHAR } from "./types";
import * as api from "./api";
import { sound } from "./sound";
import {
  DEFAULT_LETTER_HOLD_MS,
  MENU_ITEMS,
  SETTINGS_ITEMS,
  SUBMENU_ITEMS,
  TITLE_WORD,
  isRoomMode,
  nextLetterHoldMs,
  roomModeOf,
  roomTypeOf,
} from "./menu";
import { decodeMorse } from "./morse";
import Lobby from "./component/Lobby";
import Room from "./component/Room";
import Practice from "./component/Practice";
import Popup from "./component/Popup";

type Session = {
  roomCode: RoomCode;
  playerId: string;
  isHost: boolean;
  mode: RoomMode;
};

// In-game typing: a letter is finished by holding its last stroke for the "letter hold"
// time (a setting), or after this long with no dot/dash. Both buttons together is a space.
const LETTER_IDLE_MS = 1000;
// Holding both buttons this long leaves a room or practice mode...
const HOLD_EXIT_MS = 2000;
// ...but the leave meter only appears after this long, so a quick space doesn't flash it.
const HOLD_EXIT_SHOW_MS = 500;
// How long a press lights up: the bulb in menus/lobby, a player's cursor while typing.
const DOT_FLASH_MS = 120;
const DASH_FLASH_MS = 360;

// Room codes are 4 dots/dashes (ROOM_CODES in server/src/server/game.py)
const ROOM_CODE_LENGTH = 4;
const JOIN_INVALID_FLASH_MS = 700;
// Presses this soon after the game-over popup opens don't close it.
const GAME_OVER_MIN_MS = 600;

const isDotKey = (key: string) =>
  key === "." || key === "z" || key === "Z" || key === "ArrowLeft";
const isDashKey = (key: string) =>
  key === "-" || key === "x" || key === "X" || key === "ArrowRight";

export default function App() {
  // --- Backend / session state ----------------------------------------------
  const [session, setSession] = useState<Session | null>(null);
  const [roomState, setRoomState] = useState<RoomState>("WAITING");
  const [socketStatus, setSocketStatus] = useState<SocketStatus>("closed");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isReadying, setIsReadying] = useState(false);
  // The other player's ready state, pushed over the game socket; null until first heard.
  const [isOpponentReady, setIsOpponentReady] = useState<boolean | null>(null);
  // Whether the other player is in the room; null until one first connects.
  const [isOpponentConnected, setIsOpponentConnected] = useState<boolean | null>(null);
  // Shown over the menu after the server ends a game; any button closes it.
  const [gameOver, setGameOver] = useState<{
    title: string;
    detail: string;
    shownAt: number;
  } | null>(null);
  // Latest typed message from /keystroke (or decoded locally in practice mode).
  const [typed, setTyped] = useState<TypedMessage>(EMPTY_TYPED);
  // Opponent's typed message, pushed over the game socket as they type.
  const [opponentTyped, setOpponentTyped] = useState<TypedMessage>(EMPTY_TYPED);
  // Duel rooms: the sentence to send, fetched once the room starts playing.
  const [targetSentence, setTargetSentence] = useState<string | null>(null);
  const [isInPractice, setIsInPractice] = useState(false);
  // Title word in the menu: follows the highlighted menu item.
  const [titleKey, setTitleKey] = useState<TitleKey>(MENU_ITEMS[0].title);

  // --- Audio / design state -------------------------------------------------
  const [isMuted, setIsMuted] = useState(false);
  // Hold the last dot/dash this long to finish a letter (Settings: 0.1–0.5s).
  const [letterHoldMs, setLetterHoldMs] = useState(DEFAULT_LETTER_HOLD_MS);
  const [isFlashlightOn, setIsFlashlightOn] = useState(false);
  // Cursor flashes while typing: your dot/dash, and the opponent's.
  const [isYouSignalOn, setIsYouSignalOn] = useState(false);
  const [isOpponentSignalOn, setIsOpponentSignalOn] = useState(false);

  // --- Menu navigation ------------------------------------------------------
  const [menuIndex, setMenuIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [subIndex, setSubIndex] = useState(0);
  const [isJoining, setIsJoining] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  // A rejected code is shown red briefly, then cleared for another attempt.
  const [isJoinCodeInvalid, setIsJoinCodeInvalid] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsIndex, setSettingsIndex] = useState(0);

  // Pad visual press state
  const [isDotPadVisual, setIsDotPadVisual] = useState(false);
  const [isDashPadVisual, setIsDashPadVisual] = useState(false);
  const [isHoldingExit, setIsHoldingExit] = useState(false);

  // 2-Button chord tracking: a chord is both buttons down at the same time.
  const isLeftDownRef = useRef(false);
  const isRightDownRef = useRef(false);
  const chordActiveRef = useRef(false);
  const holdTimerRef = useRef<number | null>(null);
  const holdShowTimerRef = useRef<number | null>(null);
  // A dot/dash held down while typing: once held for letterHoldMs it is sent and ends the letter.
  const strokeHoldRef = useRef<{
    side: "left" | "right";
    timer: number;
    fired: boolean;
  } | null>(null);
  const signalTimersRef = useRef<{
    you: number | null;
    opponent: number | null;
  }>({ you: null, opponent: null });

  const flashTimerRef = useRef<number | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  // The server appends symbols in arrival order, so keystrokes are sent one at a time.
  const keystrokeQueueRef = useRef<Promise<void>>(Promise.resolve());
  // Bumped on enter/leave so queued keystrokes from an old room are dropped.
  const keystrokeGenRef = useRef(0);
  // Dots/dashes sent since the last NEWCHAR — i.e. a letter is in progress.
  const letterPendingRef = useRef(false);
  const letterTimerRef = useRef<number | null>(null);

  // Request/socket trace for developers; the UI only shows simple feedback.
  const log = useCallback((text: string) => {
    console.debug(`[morse-duel] ${text}`);
  }, []);

  /** Light the bulb for one button press (menus and lobby only). */
  const triggerFlash = useCallback((durationMs: number) => {
    if (flashTimerRef.current !== null)
      window.clearTimeout(flashTimerRef.current);
    setIsFlashlightOn(true);
    flashTimerRef.current = window.setTimeout(() => {
      flashTimerRef.current = null;
      setIsFlashlightOn(false);
    }, durationMs);
  }, []);

  /** Light a player's cursor for one dot or dash; it switches off instantly. */
  const flashSignal = useCallback(
    (who: "you" | "opponent", symbol: KeySymbol) => {
      const setOn = who === "you" ? setIsYouSignalOn : setIsOpponentSignalOn;
      const timers = signalTimersRef.current;
      if (timers[who] !== null) window.clearTimeout(timers[who]);
      setOn(true);
      timers[who] = window.setTimeout(
        () => {
          timers[who] = null;
          setOn(false);
        },
        symbol === "." ? DOT_FLASH_MS : DASH_FLASH_MS,
      );
    },
    [],
  );

  const clearLetterTimer = useCallback(() => {
    if (letterTimerRef.current !== null) {
      window.clearTimeout(letterTimerRef.current);
      letterTimerRef.current = null;
    }
  }, []);

  const cancelStrokeHold = useCallback(() => {
    if (strokeHoldRef.current) window.clearTimeout(strokeHoldRef.current.timer);
    strokeHoldRef.current = null;
  }, []);

  const resetTyping = useCallback(() => {
    keystrokeGenRef.current++;
    clearLetterTimer();
    cancelStrokeHold();
    letterPendingRef.current = false;
    setTyped(EMPTY_TYPED);
    setOpponentTyped(EMPTY_TYPED);
  }, [clearLetterTimer, cancelStrokeHold]);

  const displayTitle: TitleKey =
    session?.mode ?? (isInPractice ? "practice" : titleKey);

  useEffect(() => {
    const word = TITLE_WORD[displayTitle];
    document.title = `Morse ${word[0]}${word.slice(1).toLowerCase()}`;
  }, [displayTitle]);

  // --- Backend integration --------------------------------------------------

  /** Close the socket and drop all room state, back to the main menu. */
  const exitRoom = useCallback(() => {
    const ws = socketRef.current;
    socketRef.current = null;
    ws?.close();
    setSession(null);
    setSocketStatus("closed");
    setRoomState("WAITING");
    resetTyping();
    setTargetSentence(null);
    setError(null);
    setIsReady(false);
    setIsReadying(false);
    setIsOpponentReady(null);
    setIsOpponentConnected(null);
    setIsJoining(false);
    setJoinCode("");
  }, [resetTyping]);

  const leaveRoom = useCallback(() => {
    exitRoom();
    sound.playMenu(isMuted);
  }, [exitRoom, isMuted]);

  /** The server ended the game: back to the menu, with a popup saying why. */
  const endGame = useCallback(
    (hasOpponentLeft: boolean) => {
      exitRoom();
      setGameOver({
        title: hasOpponentLeft ? "OPPONENT LEFT" : "GAME OVER",
        detail: hasOpponentLeft ? "Your opponent disconnected, so the game is over." : "The game has finished.",
        shownAt: Date.now(),
      });
    },
    [exitRoom],
  );

  /** Close the game-over popup. Returns false if there was none to close. */
  const dismissGameOver = useCallback(() => {
    if (!gameOver) return false;
    // A button already held when the game ended shouldn't close it unseen
    if (Date.now() - gameOver.shownAt < GAME_OVER_MIN_MS) return true;
    setGameOver(null);
    sound.playMenu(isMuted);
    return true;
  }, [gameOver, isMuted]);

  const connect = useCallback(
    (roomCode: RoomCode, playerId: string) => {
      const ws = api.openRoomSocket(roomCode, playerId);
      socketRef.current = ws;
      setSocketStatus("connecting");
      log(`→ WS connect /game/${roomCode}/${playerId}`);

      const isCurrent = () => socketRef.current === ws;
      // Tracked per socket, so the game-over popup can say why the game ended.
      let hasOpponentLeft = false;

      ws.onopen = () => {
        if (!isCurrent()) return;
        setSocketStatus("open");
        log("← WS open");
      };

      ws.onmessage = (ev: MessageEvent<string>) => {
        if (!isCurrent()) return;
        log(`← WS ${ev.data}`);

        let msg:
          | StateChangeMessage
          | OpponentTypedMessage
          | OpponentReadyMessage
          | OpponentConnectedMessage
          | Record<string, unknown>;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          log("✗ WS message was not JSON");
          return;
        }

        if ("state" in msg && msg.state === "FINISHED") {
          endGame(hasOpponentLeft);
          return;
        }

        if ("state" in msg && typeof msg.state === "string") {
          setRoomState(msg.state as RoomState);
        }

        if ("opponent_ready" in msg && typeof msg.opponent_ready === "boolean") {
          setIsOpponentReady(msg.opponent_ready);
        }

        if ("opponent_connected" in msg && typeof msg.opponent_connected === "boolean") {
          setIsOpponentConnected(msg.opponent_connected);
          hasOpponentLeft = !msg.opponent_connected;
          if (msg.opponent_connected) sound.playMenu(isMuted);
          else sound.playError(isMuted);
        }

        if (
          "opponent_morse" in msg &&
          typeof msg.opponent_morse === "string" &&
          typeof msg.opponent_ascii === "string"
        ) {
          setOpponentTyped({
            ascii: msg.opponent_ascii,
            morse: msg.opponent_morse,
          });

          // Flash/beep the opponent's dot or dash (not their NEWCHAR or space)
          const sym = msg.opponent_morse.slice(-1);
          if (sym === "." || sym === "-") {
            flashSignal("opponent", sym);
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
    [log, flashSignal, isMuted, endGame],
  );

  /** Enter the room the server put us in; its room_type, not the menu pick, sets the mode. */
  const enterRoom = useCallback(
    (data: api.JoinRoomResponse, isHost: boolean) => {
      const roomCode = data.room_code as RoomCode;
      const mode = roomModeOf(data.room_type);
      setSession({ roomCode, playerId: data.player_id, isHost, mode });
      setRoomState("WAITING");
      setSocketStatus("closed");
      resetTyping();
      setTargetSentence(null);
      setError(null);
      setIsReady(false);
      setIsReadying(false);
      setIsOpponentReady(null);
      setIsOpponentConnected(null);
      connect(roomCode, data.player_id);
    },
    [connect, resetTyping],
  );

  const createRoom = useCallback(
    async (mode: RoomMode) => {
      if (isLoading) return;
      setIsLoading(true);
      setError(null);
      try {
        const data = await api.createRoom(roomTypeOf(mode));
        log(`← created ${data.room_type} room ${data.room_code} as ${data.player_id}`);
        if (data.room_type !== roomTypeOf(mode)) {
          log(`asked for a ${roomTypeOf(mode)} room, server made ${data.room_type}`);
        }
        enterRoom(data, true);
        sound.playMenu(isMuted);
      } catch (err) {
        console.error("createRoom failed", err);
        setError(
          api.isUnreachable(err)
            ? "CAN'T REACH THE SERVER"
            : "COULDN'T CREATE A ROOM",
        );
        sound.playError(isMuted);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, enterRoom, log, isMuted],
  );

  const joinRoom = useCallback(
    async (code: RoomCode, mode: RoomMode) => {
      if (isLoading) return;
      setIsLoading(true);
      setError(null);
      try {
        const data = await api.joinRoom(code);
        log(`← joined ${data.room_type} room ${data.room_code} as ${data.player_id}`);
        if (data.room_type !== roomTypeOf(mode)) {
          log(`joined from ${mode}, but the room is ${data.room_type}`);
        }
        enterRoom(data, false);
        setIsJoining(false);
        setJoinCode("");
        sound.playMenu(isMuted);
      } catch (err) {
        console.error("joinRoom failed", err);
        setError(
          api.isUnreachable(err)
            ? "CAN'T REACH THE SERVER"
            : "COULDN'T JOIN THAT ROOM",
        );
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
    [isLoading, enterRoom, log, isMuted],
  );

  /** Add a dot/dash to the join code; the 4th symbol submits it. */
  const typeJoinSymbol = useCallback(
    (symbol: KeySymbol) => {
      const mode = MENU_ITEMS[menuIndex].mode;
      if (!isRoomMode(mode)) return;
      if (joinCode.length >= ROOM_CODE_LENGTH) return; // joining, or showing a rejected code
      if (symbol === ".") sound.playDot(isMuted);
      else sound.playDash(isMuted);
      setError(null);

      const next = joinCode + symbol;
      setJoinCode(next);
      if (next.length === ROOM_CODE_LENGTH)
        void joinRoom(next as RoomCode, mode);
    },
    [menuIndex, joinCode, isMuted, joinRoom],
  );

  const readyUp = useCallback(async () => {
    if (!session || isReady || isReadying) return;
    setIsReadying(true);
    log("→ POST /ready");
    try {
      const data = await api.readyUp(session.roomCode, session.playerId);
      log(`← ${data.message}`);
      setIsReady(true);
      sound.playMenu(isMuted);
    } catch (err) {
      log(`✗ /ready: ${api.describeError(err)}`);
      sound.playError(isMuted);
    } finally {
      setIsReadying(false);
    }
  }, [session, isReady, isReadying, log, isMuted]);

  // Duel rooms race to send a sentence; fetch it once the room starts.
  const sessionMode = session?.mode;
  const sessionRoomCode = session?.roomCode;
  useEffect(() => {
    if (sessionMode !== "duel" || !sessionRoomCode || roomState !== "PLAYING") return;
    let isStale = false;
    log("→ POST /sentence");
    api
      .getSentence(sessionRoomCode)
      .then((data) => {
        if (isStale) return;
        log(`← sentence: ${data.sentence}`);
        setTargetSentence(data.sentence);
      })
      .catch((err) => log(`✗ /sentence: ${api.describeError(err)}`));
    return () => {
      isStale = true;
    };
  }, [sessionMode, sessionRoomCode, roomState, log]);

  // --- Typing (in a room, or practice mode) -------------------------------------
  // Dots/dashes are sent as typed. A letter is finished (NEWCHAR) by holding its last
  // stroke for letterHoldMs, or by LETTER_IDLE_MS without input. Both buttons is a space.

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
          setTyped({
            ascii: data.current_sentence_ascii,
            morse: data.current_sentence_morse,
          });
        } catch (err) {
          log(`✗ /keystroke: ${api.describeError(err)}`);
        }
      });
    },
    [session, log],
  );

  /** Send a symbol to the server, or in practice mode decode it locally. */
  const emitSymbol = useCallback(
    (symbol: WireSymbol) => {
      if (isInPractice) {
        setTyped((prev) => {
          const morse = prev.morse + symbol;
          return { morse, ascii: decodeMorse(morse) };
        });
        return;
      }
      postKeystroke(symbol);
    },
    [isInPractice, postKeystroke],
  );

  /** End the letter in progress, if any. */
  const commitLetter = useCallback(() => {
    clearLetterTimer();
    if (!letterPendingRef.current) return;
    letterPendingRef.current = false;
    emitSymbol(NEWCHAR);
  }, [clearLetterTimer, emitSymbol]);

  const typeSymbol = useCallback(
    (symbol: KeySymbol) => {
      flashSignal("you", symbol);
      if (symbol === ".") sound.playDot(isMuted);
      else sound.playDash(isMuted);

      emitSymbol(symbol);
      letterPendingRef.current = true;
      clearLetterTimer();
      letterTimerRef.current = window.setTimeout(commitLetter, LETTER_IDLE_MS);
    },
    [flashSignal, isMuted, emitSymbol, clearLetterTimer, commitLetter],
  );

  /** Both buttons together: finish any letter in progress, then a space. */
  const typeSpace = useCallback(() => {
    sound.playMenu(isMuted);
    commitLetter();
    emitSymbol(" ");
    emitSymbol(NEWCHAR);
  }, [isMuted, commitLetter, emitSymbol]);

  /** A dot/dash went down while typing: if it's still held after letterHoldMs, send it and end the letter. */
  const startStrokeHold = useCallback(
    (side: "left" | "right") => {
      cancelStrokeHold();
      clearLetterTimer(); // the idle pause restarts from this stroke's release
      const hold = { side, fired: false, timer: 0 };
      hold.timer = window.setTimeout(() => {
        hold.fired = true;
        typeSymbol(side === "left" ? "." : "-");
        commitLetter();
      }, letterHoldMs);
      strokeHoldRef.current = hold;
    },
    [
      cancelStrokeHold,
      clearLetterTimer,
      typeSymbol,
      commitLetter,
      letterHoldMs,
    ],
  );

  const enterPractice = useCallback(() => {
    resetTyping();
    setIsInPractice(true);
  }, [resetTyping]);

  const exitPractice = useCallback(() => {
    resetTyping();
    setIsInPractice(false);
    sound.playMenu(isMuted);
  }, [resetTyping, isMuted]);

  const isTyping =
    isInPractice || (session !== null && roomState === "PLAYING");

  // --- Hold both to leave -----------------------------------------------------

  const cancelHoldExit = useCallback(() => {
    for (const ref of [holdTimerRef, holdShowTimerRef]) {
      if (ref.current !== null) window.clearTimeout(ref.current);
      ref.current = null;
    }
    setIsHoldingExit(false);
  }, []);

  const startHoldExit = useCallback(
    (onExit: () => void) => {
      cancelHoldExit();
      holdShowTimerRef.current = window.setTimeout(() => {
        holdShowTimerRef.current = null;
        setIsHoldingExit(true);
      }, HOLD_EXIT_SHOW_MS);
      holdTimerRef.current = window.setTimeout(() => {
        holdTimerRef.current = null;
        setIsHoldingExit(false);
        onExit();
      }, HOLD_EXIT_MS);
    },
    [cancelHoldExit],
  );

  // Close socket and stop timers on unmount
  useEffect(
    () => () => {
      socketRef.current?.close();
      clearLetterTimer();
      cancelStrokeHold();
      cancelHoldExit();
      const timers = signalTimersRef.current;
      if (timers.you !== null) window.clearTimeout(timers.you);
      if (timers.opponent !== null) window.clearTimeout(timers.opponent);
      if (flashTimerRef.current !== null)
        window.clearTimeout(flashTimerRef.current);
    },
    [clearLetterTimer, cancelStrokeHold, cancelHoldExit],
  );

  // --- Menu actions -------------------------------------------------------------

  const highlightMenuItem = useCallback((index: number) => {
    setMenuIndex(index);
    setTitleKey(MENU_ITEMS[index].title);
  }, []);

  /** Run a main-menu item: room modes open their CREATE / JOIN block. */
  const selectTopItem = useCallback(
    (index: number) => {
      const item = MENU_ITEMS[index];
      sound.playMenu(isMuted);
      setError(null);

      if (isRoomMode(item.mode)) {
        setIsExpanded(true);
        setSubIndex(0);
      } else if (item.id === "practice") {
        enterPractice();
      } else if (item.id === "learn") {
        setShowChart(true);
      } else if (item.id === "settings") {
        setSettingsIndex(0);
        setShowSettings(true);
      }
    },
    [isMuted, enterPractice],
  );

  /** CREATE / JOIN under the open mode. */
  const selectSubItem = useCallback(
    (index: number) => {
      const mode = MENU_ITEMS[menuIndex].mode;
      if (!isRoomMode(mode)) return;
      sound.playMenu(isMuted);

      if (SUBMENU_ITEMS[index].id === "create") {
        void createRoom(mode);
      } else {
        setIsJoining(true);
        setJoinCode("");
        setError(null);
      }
    },
    [menuIndex, isMuted, createRoom],
  );

  const activateSetting = useCallback(
    (index: number) => {
      const id = SETTINGS_ITEMS[index].id;
      if (id === "sound") {
        setIsMuted((m) => !m);
        sound.playMenu(false);
      } else if (id === "letterHold") {
        setLetterHoldMs(nextLetterHoldMs);
        sound.playMenu(isMuted);
      } else if (id === "testDot") {
        sound.playDot(isMuted);
      } else {
        triggerFlash(DASH_FLASH_MS); // the Z press lit a dot; show a dash
        sound.playDash(isMuted);
      }
    },
    [isMuted, triggerFlash],
  );

  const handleMenuItemClick = useCallback(
    (index: number) => {
      setIsJoining(false);
      setJoinCode("");
      if (isExpanded && index === menuIndex) {
        // Clicking the open mode again folds it back up
        setIsExpanded(false);
        sound.playMenu(isMuted);
        return;
      }
      setIsExpanded(false);
      highlightMenuItem(index);
      selectTopItem(index);
    },
    [isExpanded, menuIndex, isMuted, highlightMenuItem, selectTopItem],
  );

  const handleSubItemClick = useCallback(
    (index: number) => {
      setSubIndex(index);
      selectSubItem(index);
    },
    [selectSubItem],
  );

  const handleSettingClick = useCallback(
    (index: number) => {
      setSettingsIndex(index);
      activateSetting(index);
    },
    [activateSetting],
  );

  // --- 2-Button action dispatch ---------------------------------------------
  // Everywhere: X (right) cycles, Z (left) selects, both buttons go back.
  // Typing: Z/X are dot/dash, both ends a letter, holding both leaves.

  /** Both buttons (or Escape): step back out of whatever is open. */
  const handleBackAction = useCallback(() => {
    if (dismissGameOver()) return;
    sound.playMenu(isMuted);
    triggerFlash(DOT_FLASH_MS);

    if (showSettings) {
      setShowSettings(false);
    } else if (showChart) {
      setShowChart(false);
    } else if (session) {
      leaveRoom();
    } else if (isInPractice) {
      exitPractice();
    } else if (isJoining) {
      setIsJoining(false);
      setJoinCode("");
      setError(null);
    } else if (isExpanded) {
      setIsExpanded(false);
    }
  }, [
    dismissGameOver,
    isMuted,
    triggerFlash,
    showSettings,
    showChart,
    session,
    leaveRoom,
    isInPractice,
    exitPractice,
    isJoining,
    isExpanded,
  ]);

  /** Z / left: select (dot while typing). */
  const handleLeftAction = useCallback(() => {
    if (isTyping) {
      typeSymbol(".");
      return;
    }
    if (dismissGameOver()) return;
    // Outside games the bulb mirrors the press: dot-length for Z, dash-length for X
    triggerFlash(DOT_FLASH_MS);
    if (showSettings) {
      activateSetting(settingsIndex);
    } else if (showChart) {
      sound.playMenu(isMuted);
    } else if (session) {
      if (roomState === "WAITING") void readyUp();
    } else if (isJoining) {
      typeJoinSymbol(".");
    } else if (isExpanded) {
      selectSubItem(subIndex);
    } else {
      selectTopItem(menuIndex);
    }
  }, [
    isTyping,
    typeSymbol,
    dismissGameOver,
    triggerFlash,
    showSettings,
    activateSetting,
    settingsIndex,
    showChart,
    isMuted,
    session,
    roomState,
    readyUp,
    isJoining,
    typeJoinSymbol,
    isExpanded,
    selectSubItem,
    subIndex,
    selectTopItem,
    menuIndex,
  ]);

  /** X / right: next option (dash while typing). */
  const handleRightAction = useCallback(() => {
    if (isTyping) {
      typeSymbol("-");
      return;
    }
    if (dismissGameOver()) return;
    triggerFlash(DASH_FLASH_MS);
    if (showSettings) {
      sound.playMenu(isMuted);
      setSettingsIndex((i) => (i + 1) % SETTINGS_ITEMS.length);
    } else if (showChart || session) {
      sound.playMenu(isMuted); // nothing to cycle here
    } else if (isJoining) {
      typeJoinSymbol("-");
    } else {
      sound.playMenu(isMuted);
      if (isExpanded) setSubIndex((i) => (i + 1) % SUBMENU_ITEMS.length);
      else highlightMenuItem((menuIndex + 1) % MENU_ITEMS.length);
    }
  }, [
    isTyping,
    typeSymbol,
    dismissGameOver,
    triggerFlash,
    showSettings,
    isMuted,
    showChart,
    session,
    isJoining,
    typeJoinSymbol,
    isExpanded,
    highlightMenuItem,
    menuIndex,
  ]);

  /** Keyboard Enter/Space: while typing, Enter ends the letter and Space adds a space; otherwise both act like Z. */
  const handleEnterKey = useCallback(
    (key: string) => {
      if (isTyping) {
        if (key === " ") typeSpace();
        else commitLetter();
      } else if (!isJoining) {
        handleLeftAction();
      }
    },
    [isTyping, typeSpace, commitLetter, isJoining, handleLeftAction],
  );

  const onChordPress = useCallback(() => {
    chordActiveRef.current = true;
    cancelStrokeHold(); // the first button's hold is now part of the chord
    if (session || isInPractice) {
      // In a room or practice mode, holding both leaves; a tap is a space while typing.
      startHoldExit(session ? leaveRoom : exitPractice);
      if (isTyping) typeSpace();
      else triggerFlash(DOT_FLASH_MS); // waiting room: bulb shows the press
      return;
    }
    handleBackAction();
  }, [
    cancelStrokeHold,
    session,
    isInPractice,
    startHoldExit,
    leaveRoom,
    exitPractice,
    isTyping,
    typeSpace,
    triggerFlash,
    handleBackAction,
  ]);

  /** Release of a tap: returns false if it was a held stroke that already ended the letter. */
  const endStrokeHold = useCallback(
    (side: "left" | "right") => {
      const hold = strokeHoldRef.current;
      if (hold?.side !== side) return true;
      cancelStrokeHold();
      return !hold.fired;
    },
    [cancelStrokeHold],
  );

  // Taps act on release; a chord needs both buttons down at once, so quick taps are
  // never misread as one. Releases that end a chord do nothing else.
  const handleDotPointerDown = useCallback(() => {
    if (isLeftDownRef.current) return;
    isLeftDownRef.current = true;
    setIsDotPadVisual(true);
    if (isRightDownRef.current) onChordPress();
    else if (isTyping) startStrokeHold("left");
  }, [onChordPress, isTyping, startStrokeHold]);

  const handleDotPointerUp = useCallback(() => {
    if (!isLeftDownRef.current) return;
    isLeftDownRef.current = false;
    setIsDotPadVisual(false);
    if (chordActiveRef.current) {
      cancelHoldExit();
      if (!isRightDownRef.current) chordActiveRef.current = false;
      return;
    }
    if (endStrokeHold("left")) handleLeftAction();
  }, [handleLeftAction, cancelHoldExit, endStrokeHold]);

  const handleDashPointerDown = useCallback(() => {
    if (isRightDownRef.current) return;
    isRightDownRef.current = true;
    setIsDashPadVisual(true);
    if (isLeftDownRef.current) onChordPress();
    else if (isTyping) startStrokeHold("right");
  }, [onChordPress, isTyping, startStrokeHold]);

  const handleDashPointerUp = useCallback(() => {
    if (!isRightDownRef.current) return;
    isRightDownRef.current = false;
    setIsDashPadVisual(false);
    if (chordActiveRef.current) {
      cancelHoldExit();
      if (!isLeftDownRef.current) chordActiveRef.current = false;
      return;
    }
    if (endStrokeHold("right")) handleRightAction();
  }, [handleRightAction, cancelHoldExit, endStrokeHold]);

  // Keyboard navigation listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (document.activeElement?.tagName === "INPUT") return;

      if (isDotKey(e.key)) {
        e.preventDefault();
        handleDotPointerDown();
      } else if (isDashKey(e.key)) {
        e.preventDefault();
        handleDashPointerDown();
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleEnterKey(e.key);
      } else if (e.key === "Escape" || e.key === "Backspace") {
        e.preventDefault();
        handleBackAction();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (isDotKey(e.key)) handleDotPointerUp();
      if (isDashKey(e.key)) handleDashPointerUp();
    };

    // Key-ups are lost when the window loses focus; don't leave a button stuck down.
    const releaseAll = () => {
      isLeftDownRef.current = false;
      isRightDownRef.current = false;
      chordActiveRef.current = false;
      setIsDotPadVisual(false);
      setIsDashPadVisual(false);
      cancelHoldExit();
      cancelStrokeHold();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", releaseAll);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", releaseAll);
    };
  }, [
    handleDotPointerDown,
    handleDotPointerUp,
    handleDashPointerDown,
    handleDashPointerUp,
    handleEnterKey,
    handleBackAction,
    cancelHoldExit,
    cancelStrokeHold,
  ]);

  // What each control does on the current screen: [keys, action] hints and pad labels.
  let hints: [string, string][];
  let padLabels: [string, string];
  if (gameOver) {
    hints = [["ANY BUTTON", "CONTINUE"]];
    padLabels = ["OK", "OK"];
  } else if (isTyping) {
    hints = [
      ["HOLD STROKE / PAUSE", "END LETTER"],
      ["BOTH", "SPACE"],
      ["HOLD BOTH", "LEAVE"],
    ];
    padLabels = ["DOT", "DASH"];
  } else if (session) {
    hints = [
      ["Z", "READY"],
      ["HOLD BOTH", "LEAVE"],
    ];
    padLabels = ["READY", ""];
  } else if (showChart) {
    hints = [["BOTH", "BACK"]];
    padLabels = ["", ""];
  } else if (isJoining) {
    hints = [
      ["Z", "DOT"],
      ["X", "DASH"],
      ["BOTH", "BACK"],
    ];
    padLabels = ["DOT", "DASH"];
  } else {
    hints = [
      ["Z", "SELECT"],
      ["X", "NEXT"],
      ["BOTH", "BACK"],
    ];
    padLabels = ["SELECT", "NEXT"];
  }

  return (
    <div className="app">
      <header className={`top-bar mode-${displayTitle}`}>
        <h1 className="brand-title">
          MORSE <span className="brand-mode">{TITLE_WORD[displayTitle]}</span>
        </h1>
        {isMuted && <span className="muted-badge">MUTED</span>}
      </header>

      {/* While typing, the cursors flash instead of the bulb */}
      {!isTyping && (
        <section
          className="flashlight-container"
          aria-label="Morse Flashlight Indicator"
        >
          <div className={`flashlight ${isFlashlightOn ? "active" : ""}`} />
        </section>
      )}

      {session ? (
        <Room
          mode={session.mode}
          roomCode={session.roomCode}
          isHost={session.isHost}
          roomState={roomState}
          socketStatus={socketStatus}
          typed={typed}
          opponentTyped={opponentTyped}
          targetSentence={targetSentence}
          isYouSignalOn={isYouSignalOn}
          isOpponentSignalOn={isOpponentSignalOn}
          isReady={isReady}
          isReadying={isReadying}
          isOpponentReady={isOpponentReady}
          isOpponentConnected={isOpponentConnected}
          onReady={readyUp}
        />
      ) : isInPractice ? (
        <Practice typed={typed} isSignalOn={isYouSignalOn} />
      ) : (
        <Lobby
          menuIndex={menuIndex}
          isExpanded={isExpanded}
          subIndex={subIndex}
          isJoining={isJoining}
          joinCode={joinCode}
          isJoinCodeInvalid={isJoinCodeInvalid}
          isLoading={isLoading}
          errorMessage={error}
          onMenuItemClick={handleMenuItemClick}
          onSubItemClick={handleSubItemClick}
          showChart={showChart}
          showSettings={showSettings}
          settingsIndex={settingsIndex}
          onSettingClick={handleSettingClick}
          isMuted={isMuted}
          letterHoldMs={letterHoldMs}
        />
      )}

      {gameOver && (
        <Popup title={gameOver.title} detail={gameOver.detail} onDismiss={dismissGameOver} />
      )}

      <div className="control-hints" aria-live="polite">
        {isHoldingExit ? (
          <div
            className="hold-meter"
            style={
              {
                "--hold-ms": `${HOLD_EXIT_MS - HOLD_EXIT_SHOW_MS}ms`,
              } as CSSProperties
            }
          >
            <span className="hold-fill" />
            <span className="hold-label">KEEP HOLDING TO LEAVE</span>
          </div>
        ) : (
          hints.map(([keys, action]) => (
            <span key={keys} className="hint-item">
              <span className="hint-keys">{keys}</span> {action}
            </span>
          ))
        )}
      </div>

      <footer className="input-pads">
        <button
          type="button"
          className={`pad-btn ${isDotPadVisual ? "pressed" : ""}`}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId); // keep the release on this pad
            handleDotPointerDown();
          }}
          onPointerUp={handleDotPointerUp}
          onPointerCancel={handleDotPointerUp}
          aria-label={`Left button (Z)${padLabels[0] ? `: ${padLabels[0]}` : ""}`}
        >
          <span className="dot-icon" />
          <span className="pad-hint">
            {padLabels[0]} <span className="pad-key">Z</span>
          </span>
        </button>

        <button
          type="button"
          className={`pad-btn ${isDashPadVisual ? "pressed" : ""}`}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            handleDashPointerDown();
          }}
          onPointerUp={handleDashPointerUp}
          onPointerCancel={handleDashPointerUp}
          aria-label={`Right button (X)${padLabels[1] ? `: ${padLabels[1]}` : ""}`}
        >
          <span className="dash-icon" />
          <span className="pad-hint">
            {padLabels[1]} <span className="pad-key">X</span>
          </span>
        </button>
      </footer>
    </div>
  );
}
