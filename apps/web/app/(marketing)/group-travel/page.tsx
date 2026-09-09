import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BedDouble, CreditCard, MessageCircle, Users } from "lucide-react";
import { CtaLink } from "@/components/analytics/cta-link";
import { PageHero, SectionHeading } from "@/components/marketing/page-hero";
import { JsonLd } from "@/components/site/json-ld";
import { PhotoBackdrop } from "@/components/site/photo-hero";
import { buttonVariants } from "@/components/ui/button";
import { sitePhotos } from "@/lib/photos";
import { breadcrumbJsonLd } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Traveling with friends",
  description:
    "Book the same Guideless departure as your friends with separate bookings and separate bills. Share a room or take your own, choose different hotels and experiences, and still be one group in one chat.",
  alternates: { canonical: "/group-travel" },
};

const HOW = [
  {
    icon: CreditCard,
    title: "Separate bookings, one group",
    body: "Each person or pair books on their own and pays their own deposit and balance. Everyone who books the same departure is in the same group and the same chat. Nobody fronts the money for anyone else.",
  },
  {
    icon: BedDouble,
    title: "Your room, your call",
    body: "Your own room is the default price. Two people on one booking can choose to share a room and each pay less. Never more than two to a room, and never a stranger unless you ask.",
  },
  {
    icon: Users,
    title: "Different choices, same weekend",
    body: "One friend takes the grandstand, another the yacht, a third skips the race for the beach. Each booking picks its own hotel tier and extras, and everyone meets at the welcome drinks.",
  },
  {
    icon: MessageCircle,
    title: "See who is in",
    body: "Once a few of you have added the same optional experience, it shows how many are going, so you can follow the crowd or avoid it. The group chat opens weeks before departure, so plans form in the open.",
  },
];

export default function GroupTravelPage() {
  return (
    <>
      <PageHero
        photo={sitePhotos.groupTravel}
        fallbackAlt="The Baie des Anges from the Promenade"
        eyebrow="Traveling with friends"
        title="Same trip. Separate bills. One group."
        lede="Coordinating friends is usually the hardest part of a trip. On Guideless everyone books their own place on the same departure, pays their own way and still travels together."
      >
        <CtaLink
          href="/tours"
          placement="group_hero"
          className={buttonVariants({ variant: "inverse", size: "lg" })}
        >
          Pick a departure <ArrowRight className="h-4 w-4" aria-hidden />
        </CtaLink>
      </PageHero>

      <section className="mx-auto w-full max-w-6xl px-6 py-24">
        <SectionHeading
          eyebrow="How it works"
          title="Independent payments inside a shared group."
        />
        <ul className="mt-12 grid gap-6 md:grid-cols-2">
          {HOW.map(({ icon: Icon, title, body }) => (
            <li key={title} className="rounded-xl border border-border bg-surface p-7">
              <Icon className="h-6 w-6 text-teal" aria-hidden />
              <h3 className="mt-4 text-xl font-semibold">{title}</h3>
              <p className="mt-2 text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-surface py-24">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionHeading
              eyebrow="Couples and pairs"
              title="Share a room, or don’t."
              lede="Book two travelers on one booking to share a room and each pay the shared-room price shown on the trip. Prefer your own space? Two bookings, two rooms, same group."
            />
            <ol className="mt-8 space-y-4 text-foreground/90">
              {[
                "Pick the departure and start a booking.",
                "Add both travelers and choose one room for two, or one room each.",
                "Choose your hotel tier and extras together or separately per traveler.",
                "Pay the deposit. Add experiences later from either account.",
              ].map((s, i) => (
                <li key={s} className="flex gap-4">
                  <span className="font-heading text-sm font-semibold text-link">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
          </div>
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl">
            <PhotoBackdrop
              src={sitePhotos.together}
              fallbackAlt="A café terrace in Paris"
              sizes="(min-width: 1024px) 50vw, 100vw"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-24">
        <div className="grid gap-6 rounded-2xl bg-ink p-10 text-cloud md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-aqua">
              Bringing a crowd?
            </p>
            <h2 className="mt-3 text-3xl font-bold">Host a departure and travel free.</h2>
            <p className="mt-3 max-w-xl text-cloud/80">
              Bring eight friends to one departure and your own place is on us. Apply on the host
              page and we will set the group up around you.
            </p>
          </div>
          <Link href="/host" className={cn(buttonVariants({ variant: "inverse", size: "lg" }))}>
            About hosting <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Traveling with friends", path: "/group-travel" },
        ])}
      />
    </>
  );
}
