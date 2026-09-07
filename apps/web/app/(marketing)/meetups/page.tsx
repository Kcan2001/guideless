import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, Users } from "lucide-react";
import { formatInZone } from "@guideless/utils";
import { JsonLd } from "@/components/site/json-ld";
import { Button, buttonVariants } from "@/components/ui/button";
import { rsvpMeetup } from "@/lib/community/actions";
import { meetupJsonLd } from "@/lib/community/seo";
import { getMyMeetupRsvps, listUpcomingMeetups } from "@/lib/data/community";
import { breadcrumbJsonLd } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "City evenings",
  description:
    "Monthly evenings in a few cities for people who have travelled with Guideless and people thinking about it. Free, informal, no pitch.",
  alternates: { canonical: "/meetups" },
};

export default async function MeetupsPage() {
  const meetups = await listUpcomingMeetups();
  const mine = await getMyMeetupRsvps(meetups.map((m) => m.id));
  const cities = [...new Set(meetups.map((m) => m.city))];

  return (
    <>
      <section className="mx-auto w-full max-w-6xl px-6 pt-20 pb-12">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          City evenings
        </p>
        <h1 className="mt-3 max-w-3xl text-5xl font-bold md:text-6xl">
          Meet the group before there is a group.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          One evening a month, one bar, no agenda. People who have travelled with us answer
          questions; people who are curious ask them. Come alone. First round on us.
        </p>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-24">
        {meetups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10">
            <p className="font-heading text-xl font-semibold">Nothing on the calendar right now.</p>
            <p className="mt-1 text-muted-foreground">
              New evenings are announced to past travelers first, then here.
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            {cities.map((city) => (
              <div key={city}>
                <h2 className="text-2xl font-bold">{city}</h2>
                <ul className="mt-4 grid gap-4 md:grid-cols-2">
                  {meetups
                    .filter((m) => m.city === city)
                    .map((m) => {
                      const going = mine.has(m.id);
                      const full = m.capacity != null && m.going >= m.capacity && !going;
                      return (
                        <li
                          key={m.id}
                          className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5"
                        >
                          <div>
                            <Link
                              href={`/meetups/${m.id}`}
                              className="font-heading text-xl font-semibold text-foreground no-underline hover:text-link"
                            >
                              {m.title}
                            </Link>
                            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                                {formatInZone(m.starts_at, m.timezone, { includeZone: true })}
                              </span>
                              {m.venue_name && (
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="h-3.5 w-3.5" aria-hidden /> {m.venue_name}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1">
                                <Users className="h-3.5 w-3.5" aria-hidden /> {m.going} going
                              </span>
                            </p>
                            {m.description && (
                              <p className="mt-2 text-sm text-muted-foreground">{m.description}</p>
                            )}
                          </div>
                          <form action={rsvpMeetup} className="mt-auto flex items-center gap-3">
                            <input type="hidden" name="meetupId" value={m.id} />
                            <input type="hidden" name="returnTo" value="/meetups" />
                            <input
                              type="hidden"
                              name="status"
                              value={going ? "cancelled" : "going"}
                            />
                            <Button
                              type="submit"
                              size="sm"
                              variant={going ? "secondary" : "primary"}
                              disabled={full}
                            >
                              {going ? "You're going · change" : full ? "Full" : "I'll be there"}
                            </Button>
                            <Link
                              href={`/meetups/${m.id}`}
                              className={cn(
                                buttonVariants({ variant: "link", size: "sm" }),
                                "px-0",
                              )}
                            >
                              Details <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                            </Link>
                          </form>
                        </li>
                      );
                    })}
                </ul>
              </div>
            ))}
          </div>
        )}
        <p className="mt-10 text-sm text-muted-foreground">
          Signed out? Tapping &ldquo;I&rsquo;ll be there&rdquo; asks you to sign in first so we can
          keep a headcount for the bar.
        </p>
      </section>
      {meetups.map((m) => (
        <JsonLd
          key={m.id}
          data={meetupJsonLd({
            id: m.id,
            title: m.title,
            description: m.description,
            startsAt: m.starts_at,
            endsAt: m.ends_at,
            venueName: m.venue_name,
            address: m.address,
            city: m.city,
          })}
        />
      ))}
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "City evenings", path: "/meetups" },
        ])}
      />
    </>
  );
}
