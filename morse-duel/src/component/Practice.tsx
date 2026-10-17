import type { TypedMessage } from "../types";
import MessageLane from "./MessageLane";

/** Solo practice: same controls as a game, decoded locally with no server. */
export default function Practice({ typed, isSignalOn }: { typed: TypedMessage; isSignalOn: boolean }) {
  return (
    <main className="room">
      <MessageLane label="YOU" typed={typed} anchor="center" tone="you" isSignalOn={isSignalOn} />
    </main>
  );
}
