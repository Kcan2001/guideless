import Link from "next/link";
import { formatMoney } from "@guideless/utils";
import { formatDate } from "@guideless/utils";
import { Badge } from "@/components/ui/badge";
import { PhotoBackdrop } from "@/components/site/photo-hero";
import { tourFromPrice, type TourListItem } from "@/lib/data/tour-filters";

const LEVEL_LABEL = { relaxed: "Relaxed", moderate: "Moderate", active: "Active" } as const;

export function TourCard({
  item,
  headingLevel: Heading = "h3",
}: {
  item: TourListItem;
  /** h2 when the card sits directly under the page h1 (e.g. /tours), h3 inside a titled section. */
  headingLevel?: "h2" | "h3";
}) {
  const { tour, version, destinations, departures } = item;
  const price = tourFromPrice(item);
  const next = departures[0];

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition-shadow hover:shadow-lg focus-within:shadow-lg">
      <Link
        href={`/tours/${tour.slug}`}
        className="relative block aspect-[4/3] overflow-hidden no-underline"
      >
        <PhotoBackdrop
          src={version.hero_image_url}
          fallbackAlt={tour.name}
          stops={destinations.length || 3}
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          imgClassName="transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-ink/80 to-transparent p-5 text-cloud">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-aqua">
              {destinations.map((d) => d.name).join(" → ") || "Route"}
            </p>
            <Heading className="mt-1 font-heading text-2xl font-bold">
              {tour.name}
              <span className="sr-only"> — view trip</span>
            </Heading>
          </div>
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-4 p-5">
        {version.tagline && <p className="text-muted-foreground">{version.tagline}</p>}

        <dl className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Days</dt>
            <dd className="font-semibold">{tour.duration_days}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Group</dt>
            <dd className="font-semibold">
              {tour.group_size_min}–{tour.group_size_max}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Pace</dt>
            <dd className="font-semibold">{LEVEL_LABEL[tour.activity_level]}</dd>
          </div>
        </dl>

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-border pt-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">From</p>
            <p className="font-heading text-xl font-bold">
              {price ? formatMoney(price, { compact: true }) : "Price on request"}
            </p>
          </div>
          {next ? (
            <Badge variant="info">
              Next: {formatDate(next.startDate, "en-US", { month: "short", day: "numeric" })}
            </Badge>
          ) : (
            <Badge variant="optional">Dates coming soon</Badge>
          )}
        </div>
      </div>
    </article>
  );
}
