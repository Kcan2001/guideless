import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { JsonLd } from "@/components/site/json-ld";
import { PhotoBackdrop } from "@/components/site/photo-hero";
import { listPublishedDestinations } from "@/lib/data/destinations";
import { breadcrumbJsonLd } from "@/lib/seo";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Destinations",
  description:
    "The cities on Guideless routes — with the logistics organized and the exploring left to you.",
  alternates: { canonical: "/destinations" },
};

export default async function DestinationsPage() {
  const destinations = await listPublishedDestinations();

  return (
    <>
      <section className="mx-auto w-full max-w-6xl px-6 pt-20 pb-10">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Destinations
        </p>
        <h1 className="mt-3 text-5xl font-bold md:text-6xl">Where the routes go.</h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          Places worth several days and no schedule. Each one appears on at least one Guideless
          route.
        </p>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-24">
        {destinations.length === 0 ? (
          <p className="text-muted-foreground">Destinations are being finalized.</p>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {destinations.map((d, i) => (
              <li key={d.id}>
                <Link
                  href={`/destinations/${d.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded border border-border bg-surface no-underline transition-shadow hover:shadow-lg"
                >
                  <div className="relative aspect-[3/2] overflow-hidden">
                    <PhotoBackdrop
                      src={d.hero_image_url}
                      fallbackAlt={`${d.name}, ${d.country_name}`}
                      stops={2 + (i % 3)}
                      tone={i % 2 === 0 ? "ink" : "sand"}
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      imgClassName="transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      {d.region ? `${d.region} · ` : ""}
                      {d.country_name}
                    </p>
                    <h2 className="mt-1 font-heading text-2xl font-bold text-foreground">
                      {d.name}
                    </h2>
                    {d.summary && <p className="mt-2 text-muted-foreground">{d.summary}</p>}
                    <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-medium text-link">
                      Explore {d.name}{" "}
                      <ArrowRight
                        className="h-4 w-4 transition-transform group-hover:translate-x-1"
                        aria-hidden
                      />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Destinations", path: "/destinations" },
        ])}
      />
    </>
  );
}
