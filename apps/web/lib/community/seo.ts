import { brand } from "@guideless/config";
import { siteUrl } from "@/lib/seo";

/** schema.org Event for an event-anchored tour (Monaco Grand Prix weekend). */
export function tourEventJsonLd(input: {
  name: string;
  slug: string;
  eventName: string;
  startsOn: string;
  endsOn: string | null;
  location: string | null;
  description: string | null;
  priceAmount: number | null;
  currency: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: `${input.eventName} · ${input.name}`,
    description: input.description ?? undefined,
    startDate: input.startsOn,
    endDate: input.endsOn ?? input.startsOn,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: input.location ? { "@type": "Place", name: input.location } : undefined,
    organizer: { "@type": "Organization", name: brand.name, url: siteUrl("/") },
    url: siteUrl(`/tours/${input.slug}`),
    offers:
      input.priceAmount != null && input.currency
        ? {
            "@type": "Offer",
            price: (input.priceAmount / 100).toFixed(2),
            priceCurrency: input.currency,
            availability: "https://schema.org/InStock",
            url: siteUrl(`/tours/${input.slug}`),
          }
        : undefined,
  };
}

/** schema.org Event for a city meetup. */
export function meetupJsonLd(input: {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  venueName: string | null;
  address: string | null;
  city: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: input.title,
    description: input.description ?? undefined,
    startDate: input.startsAt,
    endDate: input.endsAt ?? undefined,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    isAccessibleForFree: true,
    location: {
      "@type": "Place",
      name: input.venueName ?? input.city,
      address: input.address ?? input.city,
    },
    organizer: { "@type": "Organization", name: brand.name, url: siteUrl("/") },
    url: siteUrl(`/meetups/${input.id}`),
  };
}
