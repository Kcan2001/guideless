import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Mail, MessageSquare, Phone } from "lucide-react";
import { brand, emails, social } from "@guideless/config";
import { PageHero } from "@/components/marketing/page-hero";
import { JsonLd } from "@/components/site/json-ld";
import { buttonVariants } from "@/components/ui/button";
import { sitePhotos } from "@/lib/photos";
import { breadcrumbJsonLd } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Contact",
  description: `Reach ${brand.name} by email before you book, and through in-app support once you have. Emergency numbers for every destination are one tap away in the app.`,
  alternates: { canonical: "/contact" },
};

/** The mailboxes we publish, in the order a customer is likely to need them. */
const CONTACT_ADDRESSES = [
  {
    address: emails.hello,
    use: "Trips, dates, hotel tiers and traveling with friends — anything before you book.",
  },
  {
    address: emails.support,
    use: "Help with a booking you already have, or with a trip that has already started.",
  },
  {
    address: emails.finance,
    use: "Payments, refunds, invoices and anything that appears on a card statement.",
  },
  {
    address: emails.partners,
    use: "Hotels, boat operators, wine estates, press and anyone proposing to work with us.",
  },
] as const;

export default function ContactPage() {
  return (
    <>
      <PageHero
        photo={sitePhotos.contact}
        fallbackAlt="Place Masséna under a soft sky"
        eyebrow="Contact"
        title="Talk to the people who organize the trip."
        lede="There is no call center. The people who book the hotels and trains are the people who answer."
        compact
      />
      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-surface p-6">
            <Mail className="h-6 w-6 text-teal" aria-hidden />
            <h2 className="mt-4 text-xl font-semibold">Before you book</h2>
            <p className="mt-2 text-muted-foreground">
              Questions about a trip, a date, a hotel tier or traveling with friends: email us and a
              person replies.
            </p>
            <a
              href={`mailto:${emails.hello}`}
              className={cn(buttonVariants({ variant: "secondary" }), "mt-5")}
            >
              {emails.hello}
            </a>
          </div>
          <div className="rounded-xl border border-border bg-surface p-6">
            <MessageSquare className="h-6 w-6 text-teal" aria-hidden />
            <h2 className="mt-4 text-xl font-semibold">Once you have booked</h2>
            <p className="mt-2 text-muted-foreground">
              Message support from your account or the Guideless app. We already see your booking,
              your itinerary and today&rsquo;s route, so you never explain from scratch.
            </p>
            <Link href="/account" className={cn(buttonVariants({ variant: "secondary" }), "mt-5")}>
              Open your account
            </Link>
            <p className="mt-3 text-sm text-muted-foreground">
              Or email{" "}
              <a href={`mailto:${emails.support}`} className="text-link">
                {emails.support}
              </a>
              .
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-6">
            <Phone className="h-6 w-6 text-teal" aria-hidden />
            <h2 className="mt-4 text-xl font-semibold">In an emergency</h2>
            <p className="mt-2 text-muted-foreground">
              Call local emergency services first. The app shows the right numbers for every
              destination on your route, with a one-tap dial. In the EU, 112 works everywhere.
            </p>
          </div>
        </div>

        <div className="mt-16 border-t border-border pt-10">
          <h2 className="text-2xl font-bold">Where to write</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Every address reaches a person, not a ticket queue. Choosing the right one gets you a
            faster answer, and keeps a traveler mid-trip from waiting behind a hotel contract.
          </p>
          <dl className="mt-8 grid gap-x-10 gap-y-6 sm:grid-cols-2">
            {CONTACT_ADDRESSES.map((entry) => (
              <div key={entry.address}>
                <dt>
                  <a href={`mailto:${entry.address}`} className="font-medium text-link">
                    {entry.address}
                  </a>
                </dt>
                <dd className="mt-1 text-sm text-muted-foreground">{entry.use}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-16 grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold">Press, partners and suppliers</h2>
            <p className="mt-3 text-muted-foreground">
              Hotels, boat operators, wine estates and anyone who would like to work with Guideless:
              write to{" "}
              <a href={`mailto:${emails.partners}`} className="text-link">
                {emails.partners}
              </a>
              .
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-bold">Follow along</h2>
            <p className="mt-3 text-muted-foreground">
              New departures are announced on Instagram and by email, one message per new trip.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href={`${social.instagram.url}?utm_source=website&utm_medium=contact`}
                rel="noopener noreferrer me"
                target="_blank"
                className={buttonVariants({ variant: "secondary" })}
              >
                @{social.instagram.handle}
                <span className="sr-only">(opens Instagram in a new tab)</span>
              </a>
              <Link href="/tours" className={cn(buttonVariants({ variant: "link" }), "px-0")}>
                See the trips <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </div>

        <p className="mt-16 text-sm text-muted-foreground">
          {brand.legalName}, trading as {brand.name}. Registered in Delaware, United States.
        </p>
      </section>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Contact", path: "/contact" },
        ])}
      />
    </>
  );
}
