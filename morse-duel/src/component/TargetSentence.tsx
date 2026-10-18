import type { TypedMessage } from "../types";
import { MORSE_MAP } from "../types";
import { prettyMorse, sentLetters } from "../morse";

type TargetSentenceProps = {
  sentence: string;
  typed: TypedMessage;
};

type LetterState = "done" | "wrong" | "next" | "todo";

/**
 * The duel's target sentence. Each letter shows its morse; letters you've sent turn
 * green (or red if wrong) and the next one to send is highlighted.
 */
export default function TargetSentence({ sentence, typed }: TargetSentenceProps) {
  const sent = sentLetters(typed);
  const chars = [...sentence.toLowerCase()];

  const stateOf = (i: number): LetterState => {
    if (i < sent.length) return sent[i] === chars[i] ? "done" : "wrong";
    return i === sent.length ? "next" : "todo";
  };

  // Group by word so lines only wrap between words; the space keeps its own index.
  const words: { start: number; text: string }[] = [];
  let start = 0;
  for (const word of sentence.split(" ")) {
    words.push({ start, text: word });
    start += word.length + 1;
  }

  return (
    <section className="target" aria-label="Sentence to send">
      {words.map(({ start, text }, w) => (
        <span key={start} className="target-word">
          {[...text].map((char, j) => (
            <span key={j} className={`target-letter ${stateOf(start + j)}`}>
              <span className="target-char">{char}</span>
              <span className="target-morse">{prettyMorse(MORSE_MAP[char.toUpperCase()] ?? "")}</span>
            </span>
          ))}
          {w < words.length - 1 && (
            <span className={`target-letter space ${stateOf(start + text.length)}`}>
              <span className="target-char"> </span>
              <span className="target-morse">/</span>
            </span>
          )}
        </span>
      ))}
    </section>
  );
}
