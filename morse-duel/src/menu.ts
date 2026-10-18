import type { GameMode, RoomMode, RoomType, TitleKey } from "./types";

export type MenuItemId = "pvp" | "chat" | "practice" | "learn" | "settings";
/** `title` is shown (and coloured) in the title bar while the item is highlighted. */
export type MenuItem = { id: MenuItemId; label: string; title: TitleKey; mode?: GameMode };

/** Main menu. Items with a room mode expand into SUBMENU_ITEMS when selected. */
export const MENU_ITEMS: MenuItem[] = [
  { id: "pvp", label: "PVP", title: "duel", mode: "duel" },
  { id: "chat", label: "CHAT", title: "chat", mode: "chat" },
  { id: "practice", label: "PRACTICE", title: "practice", mode: "practice" },
  { id: "learn", label: "LEARN", title: "learn" },
  { id: "settings", label: "SETTINGS", title: "settings" },
];

export const SUBMENU_ITEMS = [
  { id: "create", label: "CREATE" },
  { id: "join", label: "JOIN" },
] as const;

export const SETTINGS_ITEMS = [
  { id: "sound", label: "SOUND" },
  { id: "letterHold", label: "LETTER HOLD" },
  { id: "testDot", label: "TEST DOT" },
  { id: "testDash", label: "TEST DASH" },
] as const;

// "Letter hold": how long the last dot/dash is held to finish a letter. 0.1–0.5s in 0.1s steps.
export const DEFAULT_LETTER_HOLD_MS = 300;
const LETTER_HOLD_MIN_MS = 100;
const LETTER_HOLD_MAX_MS = 500;
const LETTER_HOLD_STEP_MS = 100;

/** Next letter-hold setting, wrapping from the maximum back to the minimum. */
export const nextLetterHoldMs = (ms: number) =>
  ms >= LETTER_HOLD_MAX_MS ? LETTER_HOLD_MIN_MS : ms + LETTER_HOLD_STEP_MS;

export const formatSeconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

/** MORSE DUEL / CHAT / PRACTICE / LEARN / SETTINGS */
export const TITLE_WORD: Record<TitleKey, string> = {
  duel: "DUEL",
  chat: "CHAT",
  practice: "PRACTICE",
  learn: "LEARN",
  settings: "SETTINGS",
};

export const isRoomMode = (mode: GameMode | undefined): mode is RoomMode =>
  mode === "duel" || mode === "chat";

/** The server's name for each room mode: the menu's DUEL is a "pvp" room. */
const ROOM_TYPE: Record<RoomMode, RoomType> = { duel: "pvp", chat: "chat" };
const ROOM_MODE: Record<RoomType, RoomMode> = { pvp: "duel", chat: "chat" };

export const roomTypeOf = (mode: RoomMode): RoomType => ROOM_TYPE[mode];
export const roomModeOf = (type: RoomType): RoomMode => ROOM_MODE[type];
