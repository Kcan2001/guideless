import { BedDouble, Sparkles, Star, Ticket, Users } from "lucide-react";
import { formatDate, formatMoney } from "@guideless/utils";
import type { Currency } from "@guideless/types";
import { Badge } from "@/components/ui/badge";
import type { RoomRule } from "@/lib/data/community";
import type { AddOnWithCounts, StayOption } from "@/lib/data/extras";
import { REFERRAL_FRIEND_DISCOUNT, REFERRAL_REWARD } from "@/lib/data/community";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<string, string> = {
  activity: "Experience",
  ticket: "Ticket",
  transfer: "Transfer",
  dinner: "Dinner",
  extra_night: "Extra night",
  room_upgrade: "Room",
  other: "Optional",
};

function money(amount: number, currency: Currency) {
  return formatMoney({ amount, currency }, { compact: true });
}

/** "Your own room is the default. Two travelers can share and each save $350." */
export function RoomRule({ rule, className }: { rule: RoomRule | null; className?: string }) {
  if (!rule) return null;
  const currency = rule.currency as Currency;
  return (
    <p className={cn("flex items-start gap-2 text-sm text-muted-foreground", className)}>
      <BedDouble className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
      <span>
        Your own room is the default.
        {rule.savingPerTraveler > 0
          ? ` Two travelers can share and each save ${money(rule.savingPerTraveler, currency)}.`
          : " Two travelers can share one room if they prefer."}{" "}
        Two per room, never more.
      </span>
    </p>
  );
}

export function StayTiers({
  options,
  currency,
  headingLevel: Heading = "h3",
}: {
  options: StayOption[];
  currency: Currency;
  headingLevel?: "h2" | "h3";
}) {
  if (options.length === 0) return null;
  return (
    <div>
      <Heading className="font-heading text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Where you stay
      </Heading>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {options.map((o) => (
          <li
            key={o.id}
            className={cn(
              "rounded-xl border p-4",
              o.is_default ? "border-aqua bg-aqua/10" : "border-border bg-surface",
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{o.name}</p>
              <span className="text-sm font-semibold">
                {o.price_delta_amount === 0
                  ? "Included"
                  : `${o.price_delta_amount > 0 ? "+" : "−"}${money(Math.abs(o.price_delta_amount), currency)} per traveler`}
              </span>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {o.star_rating && (
                <span
                  className="inline-flex items-center gap-0.5"
                  aria-label={`${o.star_rating} star`}
                >
                  {Array.from({ length: o.star_rating }).map((_, i) => (
                    <Star key={i} className="h-3 w-3 fill-current" aria-hidden />
                  ))}
                </span>
              )}
              {o.area && <span>{o.area}</span>}
              {o.is_default && <Badge variant="optional">Included by default</Badge>}
            </p>
            {o.description && <p className="mt-2 text-sm text-muted-foreground">{o.description}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AddOnList({
  addOns,
  currency,
  featuredOnly = false,
  headingLevel: Heading = "h3",
  title = "Add on what you like",
}: {
  addOns: AddOnWithCounts[];
  currency: Currency;
  featuredOnly?: boolean;
  headingLevel?: "h2" | "h3";
  title?: string;
}) {
  const list = featuredOnly ? addOns.filter((a) => a.is_featured) : addOns;
  const shown = list.length > 0 ? list : addOns;
  if (shown.length === 0) return null;
  return (
    <div>
      <Heading className="font-heading text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </Heading>
      <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-surface">
        {shown.map((a) => {
          const closed = a.bookableUntil < new Date().toISOString().slice(0, 10);
          const soldOut = a.available !== null && a.available <= 0;
          const Icon = a.kind === "ticket" ? Ticket : Sparkles;
          return (
            <li key={a.id} className="flex flex-wrap items-start gap-3 p-4">
              <Icon className="mt-1 h-4 w-4 shrink-0 text-teal" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {a.title}
                  {a.tier_group && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      choose one
                    </span>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {KIND_LABEL[a.kind] ?? "Optional"}
                  {a.day_number ? ` · Day ${a.day_number}` : ""}
                  {a.location_name ? ` · ${a.location_name}` : ""}
                </p>
                {a.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{a.description}</p>
                )}
                <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {a.going > 0 && (
                    <span className="inline-flex items-center gap-1 text-foreground">
                      <Users className="h-3 w-3" aria-hidden /> {a.going} going
                    </span>
                  )}
                  {soldOut ? (
                    <Badge variant="danger">Full</Badge>
                  ) : closed ? (
                    <Badge variant="neutral">Closed {formatDate(a.bookableUntil)}</Badge>
                  ) : a.available !== null && a.available <= 5 ? (
                    <Badge variant="warning">{a.available} left</Badge>
                  ) : null}
                </p>
              </div>
              <p className="text-right font-semibold">
                {money(a.price_amount, currency)}
                <span className="block text-xs font-normal text-muted-foreground">
                  {a.pricing_basis === "per_traveler" ? "per traveler" : "per booking"}
                </span>
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Event landing: stay tiers × the mutually exclusive viewing tiers, read as one menu. */
export function EventTierMenu({
  stayOptions,
  addOns,
  currency,
  eventName,
}: {
  stayOptions: StayOption[];
  addOns: AddOnWithCounts[];
  currency: Currency;
  eventName: string;
}) {
  const viewing = addOns.filter((a) => a.tier_group);
  const rest = addOns.filter((a) => !a.tier_group);
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <StayTiers options={stayOptions} currency={currency} />
      {viewing.length > 0 && (
        <div>
          <h3 className="font-heading text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            How you watch {eventName.replace(/^Formula 1 /, "")}
          </h3>
          <ul className="mt-3 space-y-3">
            {viewing.map((a) => (
              <li key={a.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{a.title}</p>
                  <span className="font-semibold">{money(a.price_amount, currency)}</span>
                </div>
                {a.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{a.description}</p>
                )}
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Per traveler · pick one
                  {a.going > 0 ? ` · ${a.going} going` : ""}
                  {a.available !== null ? ` · ${a.available} left` : ""}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {rest.length > 0 && (
        <div className="lg:col-span-2">
          <AddOnList addOns={rest} currency={currency} title="Also optional" />
        </div>
      )}
    </div>
  );
}

export function ReferralHint({ className }: { className?: string }) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)}>
      Booking with a friend&rsquo;s code? Enter it at checkout for ${REFERRAL_FRIEND_DISCOUNT / 100}{" "}
      off the trip, and they get ${REFERRAL_REWARD / 100} toward theirs.
    </p>
  );
}
