import { Check, LifeBuoy, MessagesSquare, Smartphone } from "lucide-react";

interface IncludedItem {
  id: string;
  title: string;
  description: string | null;
}

/**
 * "Base trip includes" strip under the hero: the tour's own included items, plus the three things
 * every Guideless trip carries (the app, the group, support) when the catalog does not already
 * list them. Group timing comes from the departure, so the copy cannot drift from the product.
 */
export function BaseIncludes({
  included,
  groupOpensDaysBefore,
}: {
  included: IncludedItem[];
  groupOpensDaysBefore: number | null;
}) {
  const has = (re: RegExp) => included.some((i) => re.test(i.title));
  const always = [
    !has(/\bapp\b/i) && {
      icon: Smartphone,
      title: "The Guideless app",
      text: "Itinerary, tickets, maps and recommendations in one place.",
    },
    !has(/\bgroup\b|\bchat\b/i) && {
      icon: MessagesSquare,
      title: "Your group",
      text: groupOpensDaysBefore
        ? `Group chat and the roster open ${groupOpensDaysBefore} days before departure.`
        : "Group chat and the roster open before departure.",
    },
    !has(/\bsupport\b/i) && {
      icon: LifeBuoy,
      title: "Trip support",
      text: "A private line to Guideless in the app, before and during the trip.",
    },
  ].filter((x): x is { icon: typeof Smartphone; title: string; text: string } => Boolean(x));

  if (included.length === 0 && always.length === 0) return null;

  return (
    <section
      aria-labelledby="base-includes-heading"
      className="border-b border-border bg-surface"
      data-testid="base-includes"
    >
      <div className="mx-auto w-full max-w-6xl px-6 py-12 md:py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Base trip includes
            </p>
            <h2 id="base-includes-heading" className="mt-2 text-2xl font-bold md:text-3xl">
              The important stuff is handled.
            </h2>
          </div>
          <p className="font-heading text-lg text-muted-foreground">Add only what you want.</p>
        </div>
        <ul className="mt-8 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {included.map((i) => (
            <li key={i.id} className="flex gap-3">
              <Check className="mt-1 h-4 w-4 shrink-0 text-teal" aria-hidden />
              <div>
                <p className="font-medium">{i.title}</p>
                {i.description && (
                  <p className="mt-0.5 text-sm text-muted-foreground">{i.description}</p>
                )}
              </div>
            </li>
          ))}
          {always.map((a) => (
            <li key={a.title} className="flex gap-3">
              <a.icon className="mt-1 h-4 w-4 shrink-0 text-teal" aria-hidden />
              <div>
                <p className="font-medium">{a.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{a.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
