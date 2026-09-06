import type { MetadataRoute } from "next";
import { listDestinationSlugs } from "@/lib/data/destinations";
import { listTourSlugs, listUpcomingDepartureRefs } from "@/lib/data/tours";
import { siteUrl } from "@/lib/seo";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [tours, destinations, departures] = await Promise.all([
    listTourSlugs(),
    listDestinationSlugs(),
    listUpcomingDepartureRefs(),
  ]);
  const now = new Date();

  return [
    { url: siteUrl("/"), lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: siteUrl("/tours"), lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: siteUrl("/destinations"), lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: siteUrl("/how-it-works"), lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    ...tours.map((slug) => ({
      url: siteUrl(`/tours/${slug}`),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    ...departures.map((d) => ({
      url: siteUrl(`/tours/${d.tourSlug}/departures/${d.id}`),
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...destinations.map((slug) => ({
      url: siteUrl(`/destinations/${slug}`),
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
