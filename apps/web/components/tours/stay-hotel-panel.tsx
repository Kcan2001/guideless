import { ExternalLink, Info, MapPin, Star } from "lucide-react";
import type { StayHotel } from "@/lib/data/extras";

/**
 * The property a stay tier is priced against: name, address, a map link and what the building
 * actually has. Every field here came from the supplier's own record, not from us.
 *
 * `confirmed` is the honesty switch. Seed 050 set the rule that we do not present a property as
 * booked until it is contracted, and none of these are. So an unconfirmed hotel is shown as the
 * room the price was built from — a weaker and true claim — rather than as "your hotel". Do not
 * remove that line without a signed contract behind the tier.
 */
export function StayHotelPanel({ hotel, confirmed }: { hotel: StayHotel; confirmed: boolean }) {
  const mapsQuery = encodeURIComponent(
    [hotel.name, hotel.address, hotel.city].filter(Boolean).join(", "),
  );
  // Coordinates when we have them (an exact pin), the address when we do not (a search).
  const mapsUrl =
    hotel.latitude != null && hotel.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${hotel.latitude},${hotel.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

  return (
    <section className="mt-4 rounded-lg border border-border bg-muted/40 p-4 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h4 className="font-semibold">{hotel.name}</h4>
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
              className="rounded-full border border-border bg-surface px-2 py-0.5 text-xs text-muted-foreground"
            >
              {a}
            </li>
          ))}
        </ul>
      )}

      {!confirmed && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            This is the property we priced this tier against, and the room whose real rate produced
            the figure above. We have not contracted it yet, so your hotel is confirmed and named
            when you book &mdash; it will be this or something we would stay in ourselves.
          </span>
        </p>
      )}
    </section>
  );
}
