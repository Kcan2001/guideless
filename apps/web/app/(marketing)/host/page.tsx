import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { brand } from "@guideless/config";
import { JsonLd } from "@/components/site/json-ld";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FormError, FormMessage, Input, Select, Textarea } from "@/components/ui/field";
import { applyToHost } from "@/lib/community/actions";
import { HOST_CREDIT_CAP, HOST_CREDIT_PER_TRAVELER } from "@/lib/data/community";
import { listPublishedTours } from "@/lib/data/tours";
import { breadcrumbJsonLd } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "Host a trip",
  description: `Earn $${HOST_CREDIT_PER_TRAVELER / 100} off your own trip for every traveler you bring, up to $${HOST_CREDIT_CAP / 100}. You host the welcome drinks; Guideless books everything else.`,
  alternates: { canonical: "/host" },
};

const HOW = [
  ["Pick a route and a date", "Any open departure, or ask us to open one for your group."],
  [
    "Share it",
    `Your people book normally, with your name on it. Every confirmed traveler takes $${HOST_CREDIT_PER_TRAVELER / 100} off your own trip.`,
  ],
  [
    "Host night one",
    "You raise the first glass at the welcome drinks. After that, everyone does their own thing, including you.",
  ],
] as const;

export default async function HostPage(props: PageProps<"/host">) {
  const [sp, tours] = await Promise.all([props.searchParams, listPublishedTours()]);
  const applied = sp.applied === "1";
  const error = typeof sp.error === "string" ? sp.error : undefined;

  return (
    <>
      <section className="mx-auto w-full max-w-6xl px-6 pt-20 pb-12">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Host program
        </p>
        <h1 className="mt-3 max-w-3xl text-5xl font-bold md:text-6xl">
          Bring your people, pay less.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Running clubs, alumni groups, a company social committee, a newsletter, a group chat that
          keeps saying &ldquo;we should travel together&rdquo;. You bring the people. We book the
          hotels, the trains and the welcome drinks. Nobody guides anyone.
        </p>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-16">
        <ol className="grid gap-6 md:grid-cols-3">
          {HOW.map(([title, body], i) => (
            <li key={title} className="rounded border border-border bg-surface p-6">
              <span className="font-heading text-sm font-semibold text-link">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2 className="mt-2 text-xl font-semibold">{title}</h2>
              <p className="mt-2 text-muted-foreground">{body}</p>
            </li>
          ))}
        </ol>
        <ul className="mt-8 grid gap-3 text-sm sm:grid-cols-2">
          {[
            `$${HOST_CREDIT_PER_TRAVELER / 100} off your own trip per confirmed traveler, up to $${HOST_CREDIT_CAP / 100}.`,
            "The same amount whichever tier you pick, so a big trip is not a bigger favour.",
            "You never handle money or logistics. Everyone books and pays on this site.",
            "Your group sits inside a departure with other travelers, or fills one on its own.",
          ].map((t) => (
            <li key={t} className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden /> {t}
            </li>
          ))}
        </ul>
      </section>

      <section id="apply" className="scroll-mt-24 bg-surface py-20">
        <div className="mx-auto w-full max-w-3xl px-6">
          {applied ? (
            <div role="status" className="rounded border border-aqua bg-aqua/10 p-8">
              <h2 className="text-3xl font-bold">Thank you. We&rsquo;ll be in touch.</h2>
              <p className="mt-3 text-muted-foreground">
                A real person reads every application, usually within two working days. We&rsquo;ll
                reply from {brand.supportEmail} with dates that could work for your group.
              </p>
              <Link href="/tours" className={cn(buttonVariants({ variant: "secondary" }), "mt-6")}>
                Browse the routes meanwhile <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-3xl font-bold">Tell us about your people.</h2>
              <p className="mt-2 text-muted-foreground">
                Five questions. No commitment either way.
              </p>
              <form action={applyToHost} className="mt-8 space-y-6" noValidate>
                <FormError message={error} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="host-name" label="Your name">
                    <Input
                      id="host-name"
                      name="name"
                      required
                      minLength={2}
                      maxLength={120}
                      autoComplete="name"
                    />
                  </Field>
                  <Field id="host-email" label="Email">
                    <Input
                      id="host-email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                    />
                  </Field>
                </div>
                <Field
                  id="host-community"
                  label="Who would you bring?"
                  hint="The group, how you know each other, what a good trip looks like for them."
                >
                  <Textarea
                    id="host-community"
                    name="communityDescription"
                    required
                    minLength={10}
                    maxLength={2000}
                    rows={4}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field
                    id="host-size"
                    label="Roughly how many"
                    hint="People who might realistically come."
                  >
                    <Input
                      id="host-size"
                      name="communitySize"
                      type="number"
                      min={0}
                      max={10000000}
                      inputMode="numeric"
                    />
                  </Field>
                  <Field id="host-city" label="Your city">
                    <Input
                      id="host-city"
                      name="city"
                      maxLength={120}
                      autoComplete="address-level2"
                    />
                  </Field>
                  <Field id="host-month" label="Preferred month">
                    <Input id="host-month" name="preferredMonth" type="month" />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="host-tour" label="A route you have in mind" hint="Optional.">
                    <Select id="host-tour" name="preferredTourId" defaultValue="">
                      <option value="">Not sure yet</option>
                      {tours.map((t) => (
                        <option key={t.tour.id} value={t.tour.id}>
                          {t.tour.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field
                    id="host-links"
                    label="Links"
                    hint="Instagram, newsletter, club page. Optional."
                  >
                    <Input id="host-links" name="links" maxLength={500} placeholder="https://" />
                  </Field>
                </div>
                <FormMessage message={undefined} />
                <Button type="submit" size="lg">
                  Send application <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
                <p className="text-xs text-muted-foreground">
                  We use this only to reply to you. Privacy policy applies; no lists, no resale.
                </p>
              </form>
            </>
          )}
        </div>
      </section>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Host a trip", path: "/host" },
        ])}
      />
    </>
  );
}
