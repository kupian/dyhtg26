import type { TypedMessage } from "./types";
import { MORSE_MAP, NEWCHAR } from "./types";

const DECODE: Record<string, string> = Object.fromEntries(
  Object.entries(MORSE_MAP).map(([char, code]) => [code, char.toLowerCase()])
);

/** Local twin of server decode_sentence (morse.py), used by practice mode. */
export function decodeMorse(morse: string): string {
  return morse
    .split(NEWCHAR)
    .filter((chunk) => chunk !== "")
    .map((chunk) => (chunk === " " ? " " : (DECODE[chunk] ?? "?")))
    .join("");
}

export type DisplayLetter = { char: string; morse: string; isSpace: boolean; isPending: boolean };

/**
 * Pair each decoded character with its morse. Every non-empty chunk between NEWCHARs
 * decodes to exactly one character; a trailing chunk is the letter still being typed.
 */
export function lettersOf({ ascii, morse }: TypedMessage): DisplayLetter[] {
  const chunks = morse.split(NEWCHAR).filter((chunk) => chunk !== "");
  const hasPending = morse !== "" && !morse.endsWith(NEWCHAR);
  const chars = [...ascii];
  return chunks.map((chunk, i) => ({
    char: chars[i] ?? "?",
    morse: chunk,
    isSpace: chunk === " ",
    isPending: hasPending && i === chunks.length - 1,
  }));
}

/** Dots and dashes that read clearly in a sans-serif font. */
export function prettyMorse(morse: string): string {
  return morse.replace(/\./g, "·").replace(/-/g, "–");
}
