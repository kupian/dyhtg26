import type { TypedMessage } from "../types";
import { lettersOf, prettyMorse } from "../morse";

type MessageLaneProps = {
  label: string;
  typed: TypedMessage;
  /** Where the newest letter sits: the right edge (opponent) or the centre (you). */
  anchor: "right" | "center";
  tone: "you" | "opponent";
  /** Lights the cursor in the player's colour for the length of a dot/dash. */
  isSignalOn: boolean;
};

/**
 * A single line of typed morse. New letters appear at the anchor and push older ones
 * left, where they fade out (mask-image in .lane-window).
 */
export default function MessageLane({ label, typed, anchor, tone, isSignalOn }: MessageLaneProps) {
  const letters = lettersOf(typed);

  return (
    <section className={`lane lane-${anchor} lane-${tone}`} aria-label={label}>
      <span className="lane-label">{label}</span>
      <div className="lane-window" aria-live="polite">
        <div className="lane-track">
          {letters.map((letter, i) => (
            <span
              key={i}
              className={`lane-letter${letter.isSpace ? " space" : ""}${letter.isPending ? " pending" : ""}`}
            >
              <span className="lane-char">{letter.isSpace ? " " : letter.char}</span>
              <span className="lane-morse">{letter.isSpace ? "/" : prettyMorse(letter.morse)}</span>
            </span>
          ))}
          <span className={`lane-caret${isSignalOn ? " on" : ""}`} aria-hidden />
        </div>
      </div>
    </section>
  );
}
