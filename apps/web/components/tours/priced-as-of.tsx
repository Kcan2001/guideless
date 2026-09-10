import { InfoNote } from "@/components/tours/info-note";

/**
 * "as of 10 Sep" next to a price on the tour page, with an (i) explaining what that means.
 *
 * The honesty this exists for: a hotel rate is a live thing, and a marketing page is a cached one.
 * Showing a number without saying when it was true invites exactly the drift that put a $19,626
 * room on sale for $4,450. So the tour page says when it last checked, and the builder — where
 * somebody actually decides — re-derives the price from a fresh supplier rate on entry.
 *
 * Renders nothing for a hand-priced tier, because "as of" would be a claim we cannot support there.
 */
export function PricedAsOf({ pricedAt }: { pricedAt: string | null }) {
  if (!pricedAt) return null;
  const when = new Date(pricedAt);
  if (Number.isNaN(when.getTime())) return null;

  const label = when.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <span>
        as of {label}
        <span aria-hidden>*</span>
      </span>
      <InfoNote label="What does “as of” mean for this price?">
        Hotel rates move, and this page is cached. This price was worked out from a real supplier
        rate on {label} for your exact dates.
        <br />
        <br />
        When you open <strong>Build your trip</strong> we fetch the rate again and show you what it
        costs today &mdash; so the number you decide on is current, not this one. We check once more
        at checkout before taking any money.
      </InfoNote>
    </span>
  );
}
