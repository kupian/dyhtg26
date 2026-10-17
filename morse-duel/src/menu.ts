import type { GameMode, RoomMode, TitleKey } from "./types";

export type MenuItemId = "pvp" | "chat" | "practice" | "chart" | "settings";
/** `title` is shown (and coloured) in the title bar while the item is highlighted. */
export type MenuItem = { id: MenuItemId; label: string; title: TitleKey; mode?: GameMode };

/** Main menu. Items with a room mode expand into SUBMENU_ITEMS when selected. */
export const MENU_ITEMS: MenuItem[] = [
  { id: "pvp", label: "PVP", title: "duel", mode: "duel" },
  { id: "chat", label: "CHAT", title: "chat", mode: "chat" },
  { id: "practice", label: "PRACTICE", title: "practice", mode: "practice" },
  { id: "chart", label: "MORSE CHART", title: "chart" },
  { id: "settings", label: "SETTINGS", title: "settings" },
];

export const SUBMENU_ITEMS = [
  { id: "create", label: "CREATE" },
  { id: "join", label: "JOIN" },
] as const;

export const SETTINGS_ITEMS = [
  { id: "sound", label: "SOUND" },
  { id: "testDot", label: "TEST DOT" },
  { id: "testDash", label: "TEST DASH" },
] as const;

/** MORSE DUEL / CHAT / PRACTICE / CHART / SETTINGS */
export const TITLE_WORD: Record<TitleKey, string> = {
  duel: "DUEL",
  chat: "CHAT",
  practice: "PRACTICE",
  chart: "CHART",
  settings: "SETTINGS",
};

export const isRoomMode = (mode: GameMode | undefined): mode is RoomMode =>
  mode === "duel" || mode === "chat";
