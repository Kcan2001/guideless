import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { PageHero, SectionHeading } from "@/components/marketing/page-hero";
import { JsonLd } from "@/components/site/json-ld";
import { buttonVariants } from "@/components/ui/button";
import { sitePhotos } from "@/lib/photos";
import { breadcrumbJsonLd } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Travel insurance",
  description:
    "Travel insurance is not included in a Guideless trip and is strongly recommended. What it should cover and why it matters for the parts you book yourself.",
  alternates: { canonical: "/travel-insurance" },
};

const COVER = [
  ["Medical care abroad", "Treatment, hospital stays and repatriation. The one that matters most."],
  [
    "Trip cancellation and interruption",
    "Your flights and anything you booked yourself if you cannot travel or have to go home early. Our own tiers cover the trip price; insurance covers the rest.",
  ],
  [
    "Delays and missed connections",
    "A late flight into Nice that misses the welcome evening, or a cancelled train home.",
  ],
  ["Belongings", "Luggage, phone, camera. Especially the phone: it is your itinerary."],
  [
    "Activities you plan to do",
    "Boats, water sports and anything a policy may class as adventurous. Check the exclusions.",
  ],
] as const;

export default function TravelInsurancePage() {
  return (
    <>
      <PageHero
        photo={sitePhotos.insurance}
        fallbackAlt="Vines and olive trees under a Provençal sky"
        eyebrow="Travel insurance"
        title="Not included. Strongly recommended."
        lede="Guideless refunds what we control under the published tiers. Insurance covers what we cannot: your flights, your health and the parts of the trip you booked yourself."
        compact
      />

      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <SectionHeading
              eyebrow="Our position"
              title="Buy it when you book your flight."
              lede="Most policies cover pre-existing conditions and cancellation only if bought soon after your first payment. The deposit counts as a first payment."
            />
            <ul className="mt-8 space-y-3 text-foreground/90">
              {[
                "Travel insurance is not part of any Guideless trip price.",
                "It is strongly recommended on every departure. We do not make it a condition of booking and we do not check it.",
                "We do not sell or recommend a specific insurer. Your bank, card or employer may already provide cover; check what you have first.",
                "Bring the policy number with you. Support can help you reach your insurer but cannot claim on your behalf.",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <Check className="mt-1 h-4 w-4 shrink-0 text-teal" aria-hidden /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-2xl font-bold">What a good policy covers</h2>
            <dl className="mt-6 divide-y divide-border rounded border border-border bg-surface">
              {COVER.map(([title, body]) => (
                <div key={title} className="p-5">
                  <dt className="font-semibold">{title}</dt>
                  <dd className="mt-1 text-muted-foreground">{body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="mt-16 grid gap-6 rounded bg-sand p-8 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h2 className="text-2xl font-bold">What Guideless covers itself</h2>
            <p className="mt-2 text-muted-foreground">
              The trip price follows the published refund tiers, most optional extras refund in full
              until their own deadline, and if we cancel a departure you get everything back. A few
              extras, event tickets above all, are non-refundable from purchase and say so before
              you add them.
            </p>
          </div>
          <Link href="/cancellation" className={cn(buttonVariants({ variant: "secondary" }))}>
            Cancellation policy <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Travel insurance", path: "/travel-insurance" },
        ])}
      />
    </>
  );
}
