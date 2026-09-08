import { brand, emails, social } from "@guideless/config";
import type { Tables } from "@guideless/types";
import type { PublicDeparture, RouteStop } from "@/lib/data/tours";

/**
 * JSON-LD builders. Output is embedded via <JsonLd />. Keep to schema.org types Google documents:
 * TouristTrip, Product/Offer, BreadcrumbList, FAQPage, Organization.
 */

export function siteUrl(path = ""): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    name: brand.name,
    url: siteUrl(),
    logo: siteUrl("/brand/guideless-logo.webp"),
    slogan: brand.tagline,
    email: brand.supportEmail,
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer service",
        email: emails.hello,
        availableLanguage: "English",
      },
      {
        "@type": "ContactPoint",
        contactType: "billing support",
        email: emails.finance,
        availableLanguage: "English",
      },
      {
        "@type": "ContactPoint",
        contactType: "sales",
        email: emails.partners,
        availableLanguage: "English",
      },
    ],
    sameAs: [social.instagram.url],
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: siteUrl(item.path),
    })),
  };
}

export function faqJsonLd(faqs: Array<{ question: string; answer: string }>) {
  if (faqs.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

function toMajor(amount: number): string {
  return (amount / 100).toFixed(2);
}

export function tourJsonLd(input: {
  tour: Tables<"tours">;
  version: Tables<"tour_versions">;
  route: RouteStop[];
  departures: PublicDeparture[];
  days: Array<{ day_number: number; title: string; summary: string | null }>;
}) {
  const { tour, version, route, departures, days } = input;
  const url = siteUrl(`/tours/${tour.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name: tour.name,
    description: version.summary ?? version.tagline ?? brand.description,
    url,
    image: version.hero_image_url ?? undefined,
    touristType: ["Independent traveler", "Small group"],
    provider: { "@type": "TravelAgency", name: brand.name, url: siteUrl() },
    itinerary: {
      "@type": "ItemList",
      numberOfItems: route.length,
      itemListElement: route.map((stop, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "City",
          name: stop.destination.name,
          url: siteUrl(`/destinations/${stop.destination.slug}`),
        },
      })),
    },
    subTrip: days.map((d) => ({
      "@type": "TouristTrip",
      name: `Day ${d.day_number}: ${d.title}`,
      description: d.summary ?? undefined,
    })),
    offers: departures.map((d) => ({
      "@type": "Offer",
      url: siteUrl(`/tours/${tour.slug}/departures/${d.id}`),
      price: toMajor(d.priceAmount),
      priceCurrency: d.currency,
      availability:
        d.status === "open" || d.status === "guaranteed"
          ? "https://schema.org/InStock"
          : "https://schema.org/SoldOut",
      validFrom: new Date().toISOString().slice(0, 10),
      priceValidUntil: d.bookingDeadline ?? d.startDate,
    })),
  };
}
