import { Check, X } from "lucide-react";

/**
 * Two ways to buy the same weekend, side by side. Static copy with no competitor names: the point
 * is the shape of the purchase (one bundle vs. essentials plus choices), not a price comparison.
 */
export function CompareBlock({
  isEvent,
  eventName,
}: {
  isEvent: boolean;
  eventName?: string | null;
}) {
  const other = isEvent
    ? {
        title: `Traditional ${eventName ?? "event"} package`,
        lines: [
          "One large bundle: hotel, tickets and hospitality priced together",
          "One price, whether or not you want every part",
          "Little to change once you have paid",
          "Everyone in the package does the same thing",
        ],
      }
    : {
        title: "Traditional group tour",
        lines: [
          "Fixed itinerary, decided for you",
          "Mandatory activities and group meals",
          "Large groups and a guide everywhere you go",
          "One price for the whole thing",
        ],
      };
  const ours = isEvent
    ? [
        "Start with the essentials: hotel, trains, welcome drinks, the app",
        "Choose where you stay and how you watch the race",
        "Pick the experiences and transfers you actually want",
        "Add more later, from your account or the app",
        "Join the group moments you like; skip the rest",
      ]
    : [
        "Start with the essentials: hotels, trains, welcome drinks, the app",
        "Choose your accommodation tier and the experiences you want",
        "Your days are yours; the itinerary is a plan, not a schedule",
        "Add more later, from your account or the app",
        "Meet the group when you want to, not because you have to",
      ];
  return (
    <div className="grid gap-6 md:grid-cols-2" data-testid="compare-block">
      <section className="rounded border border-border bg-surface p-7">
        <h3 className="font-heading text-lg text-muted-foreground">{other.title}</h3>
        <ul className="mt-5 space-y-3 text-muted-foreground">
          {other.lines.map((line) => (
            <li key={line} className="flex gap-3">
              <X className="mt-1 h-4 w-4 shrink-0" aria-hidden />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded bg-ink p-7 text-cloud">
        <h3 className="font-heading text-lg text-aqua">Guideless</h3>
        <ul className="mt-5 space-y-3">
          {ours.map((line) => (
            <li key={line} className="flex gap-3">
              <Check className="mt-1 h-4 w-4 shrink-0 text-aqua" aria-hidden />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
