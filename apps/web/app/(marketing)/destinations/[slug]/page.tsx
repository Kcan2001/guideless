import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, MapPin, Phone } from "lucide-react";
import { emptyStates } from "@guideless/config";
import { TrackView } from "@/components/analytics/track-view";
import { JsonLd } from "@/components/site/json-ld";
import { PhotoBackdrop } from "@/components/site/photo-hero";
import { TourCard } from "@/components/tours/tour-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getDestinationBySlug, listDestinationSlugs } from "@/lib/data/destinations";
import { Prose } from "@/components/content/prose";
import { listDestinationGuides } from "@/lib/content/journal";
import { breadcrumbJsonLd } from "@/lib/seo";

export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams() {
  const slugs = await listDestinationSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata(
  props: PageProps<"/destinations/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const detail = await getDestinationBySlug(slug);
  if (!detail) return { title: "Destination not found" };
  const { destination: d } = detail;
  return {
    title: d.seo_title ?? `${d.name}, ${d.country_name}`,
    description: d.seo_description ?? d.summary ?? `Guideless trips through ${d.name}.`,
    alternates: { canonical: `/destinations/${d.slug}` },
  };
}

const EMERGENCY_LABELS: Record<string, string> = {
  general: "Emergency",
  police: "Police",
  ambulance: "Ambulance",
  fire: "Fire",
};

export default async function DestinationPage(props: PageProps<"/destinations/[slug]">) {
  const { slug } = await props.params;
  const detail = await getDestinationBySlug(slug);
  if (!detail) notFound();
  const { destination: d, tours, recommendations } = detail;
  const guides = await listDestinationGuides(d.id);
  const emergency = Object.entries((d.emergency_numbers ?? {}) as Record<string, string>);

  // The closing call to action goes straight to the builder when a trip here has an open departure.
  const bookable = tours.find((t) => t.departures.length > 0);
  const nextDeparture = bookable?.departures[0];

  return (
    <>
      <section className="relative overflow-hidden bg-ink text-cloud">
        <PhotoBackdrop
          src={d.hero_image_url}
          fallbackAlt={`${d.name}, ${d.country_name}`}
          stops={2}
          priority
          className={d.hero_image_url ? undefined : "opacity-70"}
        />
        <div
          className={
            d.hero_image_url
              ? "absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/70 to-ink/20"
              : "absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/30"
          }
          aria-hidden
        />
        <div className="relative mx-auto w-full max-w-6xl px-6 pt-20 pb-16 md:pt-28">
          <nav aria-label="Breadcrumb" className="text-sm text-cloud/70">
            <Link href="/destinations" className="text-cloud/70 no-underline hover:text-cloud">
              Destinations
            </Link>
            <span className="mx-2" aria-hidden>
              /
            </span>
            <span>{d.name}</span>
          </nav>
          <p className="mt-6 flex items-center gap-2 text-sm font-medium uppercase tracking-[0.22em] text-aqua">
            <MapPin className="h-4 w-4" aria-hidden />
            {d.region ? `${d.region}, ` : ""}
            {d.country_name}
          </p>
          <h1 className="mt-3 text-5xl font-bold md:text-7xl">{d.name}</h1>
          {d.summary && (
            <p className="mt-6 max-w-xl text-lg text-cloud/80 md:text-xl">{d.summary}</p>
          )}
        </div>
      </section>

      {d.description && (
        <section className="mx-auto w-full max-w-3xl px-6 py-16 text-lg leading-relaxed">
          <p>{d.description}</p>
        </section>
      )}

      {guides.length > 0 && (
        <section className="mx-auto w-full max-w-3xl px-6 pb-8">
          {guides.map((guide) => (
            <div key={guide.id} className="mb-12 last:mb-0">
              <h2 className="font-heading text-2xl font-bold md:text-3xl">{guide.title}</h2>
              <Prose markdown={guide.body_markdown} className="mt-4" />
            </div>
          ))}
        </section>
      )}

      <section className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-3xl font-bold md:text-4xl">Trips through {d.name}.</h2>
          <Link href="/tours" className={buttonVariants({ variant: "secondary" })}>
            All trips
          </Link>
        </div>
        {tours.length > 0 ? (
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {tours.map((item) => (
              <TourCard key={item.tour.id} item={item} />
            ))}
          </div>
        ) : (
          <p className="mt-8 text-muted-foreground">
            No current routes stop here. New trips are added a few times a year.
          </p>
        )}
      </section>

      <section className="bg-surface py-16">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 md:grid-cols-[1.4fr_1fr]">
          <div>
            <h2 className="text-3xl font-bold md:text-4xl">Recommendations.</h2>
            <p className="mt-2 max-w-xl text-muted-foreground">
              Curated by people who have spent real time here. Travelers see the full list, by
              neighborhood and time of day, in the app.
            </p>
            {recommendations.length > 0 ? (
              <ul className="mt-8 grid gap-4 sm:grid-cols-2">
                {recommendations.map((r) => (
                  <li key={r.id} className="rounded-xl border border-border bg-cloud p-5">
                    <div className="flex flex-wrap gap-1.5">
                      {r.categories.map((c) => (
                        <Badge key={c} variant="included">
                          {c.replace("_", " ")}
                        </Badge>
                      ))}
                    </div>
                    <p className="mt-2 font-semibold">{r.title}</p>
                    {r.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>
                    )}
                    {r.neighborhood && (
                      <p className="mt-2 text-xs text-muted-foreground">{r.neighborhood}</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-8 rounded-xl border border-dashed border-border p-8">
                <p className="font-heading text-lg font-semibold">
                  {emptyStates.noRecommendations.title}
                </p>
                <p className="mt-1 text-muted-foreground">{emptyStates.noRecommendations.body}</p>
              </div>
            )}
          </div>

          <aside className="rounded-xl border border-border bg-cloud p-6">
            <h2 className="font-heading text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Good to know
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Time zone</dt>
                <dd className="font-medium">{d.timezone.replace("_", " ")}</dd>
              </div>
              {emergency.map(([key, number]) => (
                <div key={key} className="flex justify-between gap-4">
                  <dt className="flex items-center gap-1.5 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" aria-hidden /> {EMERGENCY_LABELS[key] ?? key}
                  </dt>
                  <dd className="font-medium">
                    <a href={`tel:${number}`} className="text-foreground">
                      {number}
                    </a>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-5 text-xs text-muted-foreground">
              In an emergency, contact local services first. Guideless support is one tap away in
              the app.
            </p>
            <Link
              href="/how-it-works"
              className={buttonVariants({ variant: "link", size: "sm" }) + " mt-4 px-0"}
            >
              How support works <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </aside>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="rounded-2xl bg-ink px-8 py-12 text-cloud md:px-12">
          <h2 className="font-heading text-3xl font-bold md:text-4xl">
            {bookable ? `See ${d.name} on your own terms.` : `${d.name} is on the list.`}
          </h2>
          <p className="mt-3 max-w-xl text-cloud/80">
            {bookable
              ? "Hotels, trains and one good evening at the start are handled. Choose where you stay and what you join; the rest of the week is yours."
              : "No route stops here yet. New trips are added a few times a year — the newsletter carries them first."}
          </p>
          {bookable && nextDeparture ? (
            <Link
              href={{
                pathname: `/tours/${bookable.tour.slug}/build`,
                query: { departure: nextDeparture.id },
              }}
              className={buttonVariants({ variant: "inverse", size: "lg" }) + " mt-6"}
            >
              Build this trip <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : (
            <Link
              href="/tours"
              className={buttonVariants({ variant: "inverse", size: "lg" }) + " mt-6"}
            >
              Explore trips <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          )}
        </div>
      </section>

      <TrackView
        event="view_destination"
        params={{ destination_id: d.id, destination_slug: d.slug }}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Destinations", path: "/destinations" },
          { name: d.name, path: `/destinations/${d.slug}` },
        ])}
      />
    </>
  );
}
