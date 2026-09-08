import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { emails } from "@guideless/config";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
import { PageHero } from "@/components/marketing/page-hero";
import { JsonLd } from "@/components/site/json-ld";
import { buttonVariants } from "@/components/ui/button";
import { FAQ } from "@/content/faq";
import { sitePhotos } from "@/lib/photos";
import { breadcrumbJsonLd, faqJsonLd } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Frequently asked questions",
  description:
    "Is there really no guide? Am I traveling alone? What is included, can I choose my hotel, can I pay separately from friends, can I add experiences later? Straight answers about how a Guideless trip works.",
  alternates: { canonical: "/faq" },
};

export default function FaqPage() {
  return (
    <>
      <PageHero
        photo={sitePhotos.faq}
        fallbackAlt="A covered passage with mosaic floor in Paris"
        eyebrow="Questions"
        title="Everything people ask before they book."
        lede="Straight answers. Anything specific to one trip, such as its deposit or cancellation tiers, is on that trip's page and in your account before you pay."
        compact
      />
      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="max-w-3xl">
          <FaqAccordion items={FAQ} />
        </div>
        <div className="mt-16 grid gap-6 rounded-2xl border border-border bg-surface p-8 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h2 className="text-2xl font-bold">Still wondering about something?</h2>
            <p className="mt-2 text-muted-foreground">
              Email {emails.hello}. If you have booked, message support from your account or the app
              and we already see your trip.
            </p>
          </div>
          <Link href="/contact" className={cn(buttonVariants({ variant: "secondary" }))}>
            Contact <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>
      <JsonLd data={faqJsonLd(FAQ)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "FAQ", path: "/faq" },
        ])}
      />
    </>
  );
}
