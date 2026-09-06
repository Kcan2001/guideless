import Image from "next/image";
import Link from "next/link";
import { brand, responsibilityLabels } from "@guideless/config";

/**
 * Temporary foundation landing page. The real home page (hero, how it works, featured trips,
 * destinations, included/not included, social proof, sample itinerary, FAQ) is Milestone 3.
 */
export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-3 text-foreground no-underline">
          <Image
            src="/brand/guideless-logo.webp"
            alt={brand.name}
            width={40}
            height={40}
            className="rounded-md"
            priority
          />
          <span className="font-heading text-lg font-bold tracking-tight">{brand.shortName}</span>
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-6 text-sm">
          <Link href="/tours" className="text-foreground no-underline hover:text-link">
            Trips
          </Link>
          <Link href="/how-it-works" className="text-foreground no-underline hover:text-link">
            How it works
          </Link>
        </nav>
      </header>

      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-24">
        <p className="mb-6 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Minimal intervention travel
        </p>
        <h1 className="max-w-3xl text-5xl font-bold leading-[1.05] text-foreground md:text-7xl">
          {brand.tagline}
        </h1>
        <p className="mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground md:text-xl">
          {brand.description}
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/tours"
            className="inline-flex items-center rounded-lg bg-primary px-6 py-3 text-base font-medium text-primary-foreground no-underline transition hover:opacity-90"
          >
            Explore trips
          </Link>
          <Link
            href="/how-it-works"
            className="inline-flex items-center rounded-lg border border-teal px-6 py-3 text-base font-medium text-foreground no-underline transition hover:bg-aqua/20"
          >
            How Guideless works
          </Link>
        </div>

        <dl className="mt-24 grid max-w-3xl gap-8 border-t border-border pt-10 sm:grid-cols-2">
          <div>
            <dt className="font-heading text-base font-semibold">
              {responsibilityLabels.guideless}
            </dt>
            <dd className="mt-2 text-muted-foreground">
              Hotels, trains, transfers, selected experiences, a small group, and a digital
              itinerary that always knows what is next.
            </dd>
          </div>
          <div>
            <dt className="font-heading text-base font-semibold">
              {responsibilityLabels.traveler}
            </dt>
            <dd className="mt-2 text-muted-foreground">
              Your flights, and every free afternoon. {brand.taglineSecondary}
            </dd>
          </div>
        </dl>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground">
          <span>
            © {new Date().getFullYear()} {brand.name}
          </span>
          <a href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a>
        </div>
      </footer>
    </main>
  );
}
