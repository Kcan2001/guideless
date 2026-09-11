import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { brand } from "@guideless/config";
import { CtaLink } from "@/components/analytics/cta-link";
import { FounderBlock } from "@/components/marketing/founder-block";
import { PageHero, SectionHeading } from "@/components/marketing/page-hero";
import { JsonLd } from "@/components/site/json-ld";
import { PhotoBackdrop } from "@/components/site/photo-hero";
import { buttonVariants } from "@/components/ui/button";
import { operatingPrinciples } from "@/content/founder";
import { sitePhotos } from "@/lib/photos";
import { breadcrumbJsonLd } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "About",
  description: `${brand.name} organizes small-group trips to Europe with no tour guide: hotels, trains, transfers and a few good evenings handled, everything else yours. Who we are and how we operate.`,
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <>
      <PageHero
        photo={sitePhotos.about}
        fallbackAlt="A cypress-lined road through the Châteauneuf-du-Pape vineyards"
        eyebrow="About Guideless"
        title="A travel company with an app instead of a guide."
        lede="We organize the trip and then get out of the way. The idea has a name, minimal intervention travel, and a promise: everything planned, nothing forced."
      />

      <section className="mx-auto w-full max-w-6xl px-6 py-24">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionHeading
              eyebrow="The idea"
              title="Minimal intervention."
              lede="Borrowed from winemaking, where it means doing as little as possible to let the fruit speak. Applied to travel it means this:"
            />
            <ul className="mt-8 space-y-4 text-lg text-foreground/90">
              <li>
                <span className="font-semibold">We intervene where it helps.</span> Hotels in the
                right neighbourhoods, trains that connect, a transfer waiting, one good evening to
                meet everyone.
              </li>
              <li>
                <span className="font-semibold">We stay out where it does not.</span> No guide, no
                coach, no schedule for your afternoons, no mandatory anything.
              </li>
              <li>
                <span className="font-semibold">We make the rest easy to add.</span> A boat, a
                dinner, a race ticket: priced one by one, added when you want, from your phone.
              </li>
            </ul>
          </div>
          <div className="relative aspect-[4/5] overflow-hidden rounded">
            <PhotoBackdrop
              src={sitePhotos.howItWorks}
              fallbackAlt="Flower stalls at the Cours Saleya market in Nice"
              sizes="(min-width: 1024px) 50vw, 100vw"
            />
          </div>
        </div>
      </section>

      <section className="bg-surface py-24">
        <div className="mx-auto w-full max-w-6xl px-6">
          <SectionHeading eyebrow="Who is behind this" title="One founder, one platform." />
          <div className="mt-12">
            <FounderBlock showPrinciples={false} />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-24">
        <SectionHeading eyebrow="How we operate" title="Commitments the product already keeps." />
        <ul className="mt-12 grid gap-6 md:grid-cols-2">
          {operatingPrinciples.map((p) => (
            <li key={p.title} className="rounded border border-border bg-surface p-6">
              <h3 className="text-xl ">{p.title}</h3>
              <p className="mt-2 text-muted-foreground">{p.body}</p>
            </li>
          ))}
        </ul>
        <p className="mt-10 max-w-2xl text-muted-foreground">
          {brand.legalName} is a Delaware company based in Santa Monica, California. Our first
          departures are Nice → Avignon → Paris and the Monaco Grand Prix weekend, and everything on
          this site, from the trip pages to the app, was built in-house.
        </p>
        <div className="mt-16 grid gap-6 rounded bg-ink p-10 text-cloud md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h2 className="text-3xl ">{brand.taglineSecondary}</h2>
            <p className="mt-3 max-w-xl text-cloud/80">
              See the two trips, what each includes and what you can add.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <CtaLink
              href="/tours"
              placement="about_closing"
              className={buttonVariants({ variant: "inverse", size: "lg" })}
            >
              Explore trips <ArrowRight className="h-4 w-4" aria-hidden />
            </CtaLink>
            <Link
              href="/contact"
              className={cn(
                buttonVariants({ size: "lg" }),
                "border border-cloud/30 bg-transparent text-cloud hover:bg-cloud/10",
              )}
            >
              Contact
            </Link>
          </div>
        </div>
      </section>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "About", path: "/about" },
        ])}
      />
    </>
  );
}
