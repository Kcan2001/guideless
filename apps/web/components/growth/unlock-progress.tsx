import { Lock, Unlock } from "lucide-react";

export interface DepartureUnlock {
  threshold: number;
  reward: string;
  reached: boolean;
  granted: boolean;
}

/**
 * "6 of 8 — at 8 everyone gets the harbour boat." Counts are real confirmed travelers only.
 * Reaching a threshold is a promise the group can see, not an automatic payout: staff grant it.
 */
export function UnlockProgress({
  confirmed,
  unlocks,
  className,
}: {
  confirmed: number;
  unlocks: DepartureUnlock[];
  className?: string;
}) {
  const active = unlocks.filter((u) => !u.reached);
  const next = active.length > 0 ? active[0] : null;
  if (unlocks.length === 0) return null;

  return (
    <section className={className} aria-labelledby="unlocks-heading">
      <h3 id="unlocks-heading" className="font-heading text-lg ">
        The more of you there are, the better it gets
      </h3>
      {next ? (
        <p className="mt-1 text-sm text-muted-foreground">
          {confirmed} booked. At {next.threshold}, everyone on this departure gets{" "}
          {lowerFirst(next.reward)}.
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">
          {confirmed} booked — every milestone on this departure is unlocked.
        </p>
      )}
      <ul className="mt-4 space-y-2">
        {unlocks.map((u) => (
          <li key={u.threshold} className="flex items-start gap-3 text-sm">
            <span
              className={
                u.reached
                  ? "mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-aqua/30"
                  : "mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cloud"
              }
            >
              {u.reached ? (
                <Unlock className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              )}
            </span>
            <span className={u.reached ? "" : "text-muted-foreground"}>
              <span className="font-medium">{u.threshold} travelers</span> — {u.reward}
              {u.reached && !u.granted && (
                <span className="block text-xs text-muted-foreground">
                  Unlocked. We will confirm the details before you travel.
                </span>
              )}
            </span>
            <span className="sr-only">{u.reached ? "unlocked" : "not yet unlocked"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "A harbour boat" reads badly mid-sentence; "a harbour boat" reads fine. */
function lowerFirst(s: string): string {
  return s.length > 1 && s[1] === s[1]?.toLowerCase() ? s[0]!.toLowerCase() + s.slice(1) : s;
}
