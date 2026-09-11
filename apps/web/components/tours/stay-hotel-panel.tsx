import { ExternalLink, Info, MapPin, Star } from "lucide-react";
import type { StayHotel } from "@/lib/data/extras";

/**
 * The properties a stay tier is priced against: name, address, a map link and what each building
 * actually has. Every field here came from the supplier's own record, not from us.
 *
 * A tier is a list, not a hotel. Monaco is five nights in one place; Southern France is three
 * nights in Nice, two in Avignon and three in Paris, and a traveler choosing between tiers wants
 * to see all three. Each leg carries its own city and night count, so nobody has to work out from
 * a single address which city it was.
 *
 * `confirmed` is the honesty switch. Seed 050 set the rule that we do not present a property as
 * booked until it is contracted, and none of these are. So an unconfirmed hotel is shown as the
 * room the price was built from — a weaker and true claim — rather than as "your hotel". Do not
 * remove that line without a signed contract behind the tier.
 */
export function StayHotelPanel({
  hotels,
  confirmed,
}: {
  hotels: readonly StayHotel[];
  confirmed: boolean;
}) {
  if (hotels.length === 0) return null;
  const multi = hotels.length > 1;

  return (
    <section className="mt-4 space-y-3">
      {hotels.map((hotel) => (
        <HotelBlock key={`${hotel.name}-${hotel.checkIn}`} hotel={hotel} showLeg={multi} />
      ))}

      {!confirmed && (
        <p className="flex items-start gap-1.5 px-4 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            {multi ? "These are the properties" : "This is the property"} we priced this tier
            against, and the rooms whose real rates produced the figure above. We have not
            contracted {multi ? "them" : "it"} yet, so your hotel is confirmed and named when you
            book &mdash; it will be {multi ? "these" : "this"} or something we would stay in
            ourselves.
          </span>
        </p>
      )}
    </section>
  );
}

function HotelBlock({ hotel, showLeg }: { hotel: StayHotel; showLeg: boolean }) {
  const mapsQuery = encodeURIComponent(
    [hotel.name, hotel.address, hotel.city].filter(Boolean).join(", "),
  );
  // Coordinates when we have them (an exact pin), the address when we do not (a search).
  const mapsUrl =
    hotel.latitude != null && hotel.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${hotel.latitude},${hotel.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

  return (
    <div className="rounded border border-border bg-surface-muted/40 p-4 text-sm">
      {showLeg && (hotel.legName || hotel.nights > 0) && (
        <p className="eyebrow text-muted-foreground">
          {hotel.legName}
          {hotel.nights > 0 && (
            <span className="font-normal normal-case tracking-normal">
              {" · "}
              {hotel.nights} night{hotel.nights === 1 ? "" : "s"}
            </span>
          )}
        </p>
      )}

      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h4 className="">{hotel.name}</h4>
        {hotel.starRating != null && (
          <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
            {hotel.starRating}
            <Star className="h-3 w-3 fill-current" aria-hidden />
          </span>
        )}
      </div>

      {hotel.description && <p className="mt-1.5 text-muted-foreground">{hotel.description}</p>}

      <a
        href={mapsUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-3 inline-flex items-start gap-1.5 text-xs font-medium underline underline-offset-2 hover:text-ink"
      >
        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          {[hotel.address, hotel.city].filter(Boolean).join(", ")}
          <ExternalLink className="ml-1 inline h-3 w-3 align-[-1px]" aria-hidden />
          <span className="sr-only"> (opens Google Maps in a new tab)</span>
        </span>
      </a>

      {hotel.amenities.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {hotel.amenities.slice(0, 8).map((a) => (
            <li
              key={a}
              className="rounded border border-border bg-surface px-2 py-0.5 text-xs text-muted-foreground"
            >
              {a}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
