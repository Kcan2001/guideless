import { brand } from "@guideless/config";
import { siteUrl } from "@/lib/seo";

/**
 * `Article` structured data for a journal post. Only fields we genuinely hold are emitted: an
 * absent image or byline is omitted rather than filled with a plausible-looking default.
 */
export function articleJsonLd(input: {
  title: string;
  description: string;
  slug: string;
  publishedAt: string | null;
  updatedAt: string;
  imageUrl?: string | null;
  authorName?: string | null;
}) {
  const image = input.imageUrl
    ? input.imageUrl.startsWith("/")
      ? siteUrl(input.imageUrl)
      : input.imageUrl
    : null;

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.title,
    description: input.description,
    mainEntityOfPage: { "@type": "WebPage", "@id": siteUrl(`/journal/${input.slug}`) },
    ...(image ? { image: [image] } : {}),
    ...(input.publishedAt ? { datePublished: input.publishedAt } : {}),
    dateModified: input.updatedAt,
    author: input.authorName
      ? { "@type": "Person", name: input.authorName }
      : { "@type": "Organization", name: brand.name },
    publisher: {
      "@type": "Organization",
      name: brand.name,
      url: siteUrl("/"),
    },
  };
}
