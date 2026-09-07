import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, MapPin, Users } from "lucide-react";
import { formatInZone } from "@guideless/utils";
import { JsonLd } from "@/components/site/json-ld";
import { Button } from "@/components/ui/button";
import { rsvpMeetup } from "@/lib/community/actions";
import { meetupJsonLd } from "@/lib/community/seo";
import { getMeetup, getMyMeetupRsvps } from "@/lib/data/community";
import { breadcrumbJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata(props: PageProps<"/meetups/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  if (!UUID.test(id)) return { title: "Evening not found" };
  const m = await getMeetup(id);
  if (!m) return { title: "Evening not found" };
  return {
    title: m.title,
    description: m.description ?? `A Guideless evening in ${m.city}.`,
    alternates: { canonical: `/meetups/${m.id}` },
  };
}

export default async function MeetupPage(props: PageProps<"/meetups/[id]">) {
  const { id } = await props.params;
  if (!UUID.test(id)) notFound();
  const m = await getMeetup(id);
  if (!m) notFound();
  const mine = await getMyMeetupRsvps([m.id]);
  const going = mine.has(m.id);
  const full = m.capacity != null && m.going >= m.capacity && !going;

  return (
    <>
      <section className="mx-auto w-full max-w-3xl px-6 pt-16 pb-24">
        <Link
          href="/meetups"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground no-underline hover:text-link"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> All evenings
        </Link>
        <p className="mt-6 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          {m.city}
        </p>
        <h1 className="mt-3 text-4xl font-bold md:text-5xl">{m.title}</h1>
        <dl className="mt-6 space-y-2 text-lg">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-muted-foreground" aria-hidden />
            <dt className="sr-only">When</dt>
            <dd>
              {formatInZone(m.starts_at, m.timezone, { includeZone: true })}
              {m.ends_at ? ` – ${formatInZone(m.ends_at, m.timezone, { includeDate: false })}` : ""}
            </dd>
          </div>
          {(m.venue_name || m.address) && (
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-muted-foreground" aria-hidden />
              <dt className="sr-only">Where</dt>
              <dd>
                {m.venue_name}
                {m.address ? <span className="text-muted-foreground"> · {m.address}</span> : null}
              </dd>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" aria-hidden />
            <dt className="sr-only">Going</dt>
            <dd>
              {m.going} going{m.capacity ? ` · ${m.capacity} places` : ""}
            </dd>
          </div>
        </dl>
        {m.description && <p className="mt-8 text-lg leading-relaxed">{m.description}</p>}
        <form action={rsvpMeetup} className="mt-10 flex flex-wrap items-center gap-4">
          <input type="hidden" name="meetupId" value={m.id} />
          <input type="hidden" name="returnTo" value={`/meetups/${m.id}`} />
          <input type="hidden" name="status" value={going ? "cancelled" : "going"} />
          <Button type="submit" size="lg" variant={going ? "secondary" : "primary"} disabled={full}>
            {going ? "You're going · change my mind" : full ? "Full" : "I'll be there"}
          </Button>
          <span className="text-sm text-muted-foreground">
            Free. Come alone or bring someone curious.
          </span>
        </form>
      </section>
      <JsonLd
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
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "City evenings", path: "/meetups" },
          { name: m.title, path: `/meetups/${m.id}` },
        ])}
      />
    </>
  );
}
