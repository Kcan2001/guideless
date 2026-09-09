import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Bed, CalendarDays, Flag, MapPin, MessageCircle, Sparkles, Users } from "lucide-react";
import { emails } from "@guideless/config";
import {
  formatDate,
  formatDateRange,
  formatInZone,
  formatWallTime,
  toLocalDate,
} from "@guideless/utils";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getMyTrip } from "@/lib/data/trips";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your trip", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Web mirror of the mobile trip experience (spec §59). Read-only; chat and moments live in the app. */
export default async function TripPage(props: PageProps<"/trips/[tripId]">) {
  const { tripId } = await props.params;
  if (!UUID.test(tripId)) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/trips/${tripId}`)}`);

  const detail = await getMyTrip(tripId);
  if (!detail) notFound();
  const { trip, days, members, accommodations, moments } = detail;
  const now = new Date();
  const today = days.find((d) => toLocalDate(now, d.timezone) === d.date) ?? null;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Your trip
      </p>
      <h1 className="mt-3 text-4xl font-bold md:text-5xl">{trip.name}</h1>
      <p className="mt-2 text-muted-foreground">
        {formatDateRange(trip.start_date, trip.end_date)} · {days.length} days ·{" "}
        <Badge variant="info">{trip.status}</Badge>
      </p>
      <div className="mt-6 rounded-xl border border-aqua bg-aqua/10 p-5 text-sm">
        The Guideless app is the best place for this — live updates, your group&rsquo;s chat and
        Live Moments. This page keeps everything readable if you lose your phone.
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-12">
          {today && (
            <section>
              <h2 className="text-2xl font-bold">Today · Day {today.day_number}</h2>
              <p className="text-muted-foreground">
                {today.destination?.name} ·{" "}
                {formatDate(today.date, "en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </section>
          )}

          <section>
            <h2 className="text-2xl font-bold">Your route</h2>
            <ol className="mt-6 space-y-10">
              {days.map((day) => (
                <li
                  key={day.id}
                  className={cn(
                    today?.id === day.id && "rounded-xl border border-aqua bg-aqua/5 p-4",
                  )}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-link">
                    Day {day.day_number} ·{" "}
                    {formatDate(day.date, "en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                    {day.destination ? ` · ${day.destination.name}` : ""}
                  </p>
                  <h3 className="text-xl font-semibold">{day.title}</h3>
                  {day.summary && <p className="text-muted-foreground">{day.summary}</p>}
                  <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-surface">
                    {day.items.map((i) => (
                      <li
                        key={i.id}
                        className={cn(
                          "flex flex-wrap items-center gap-3 p-4",
                          i.type === "free_time" && "bg-aqua/10",
                          i.status === "cancelled" && "opacity-60",
                        )}
                      >
                        <span className="w-32 text-sm font-medium">
                          {i.start_time ? formatWallTime(i.start_time) : "—"}
                          {i.end_time ? ` – ${formatWallTime(i.end_time)}` : ""}
                        </span>
                        <span
                          className={cn(
                            "flex-1 font-semibold",
                            i.status === "cancelled" && "line-through",
                          )}
                        >
                          {i.title}
                        </span>
                        {i.is_optional && <Badge variant="optional">Optional</Badge>}
                        <Badge
                          variant={i.responsibility === "guideless" ? "guideless" : "traveler"}
                        >
                          {i.responsibility === "guideless" ? "Guideless handles" : "You book"}
                        </Badge>
                        {i.location_name && (
                          <span className="basis-full text-sm text-muted-foreground">
                            <MapPin className="mr-1 inline h-3.5 w-3.5" aria-hidden />{" "}
                            {i.location_name}
                            {i.address ? ` · ${i.address}` : ""}
                          </span>
                        )}
                        {i.instructions && (
                          <span className="basis-full text-sm">{i.instructions}</span>
                        )}
                      </li>
                    ))}
                    {day.items.length === 0 && (
                      <li className="p-4 text-sm text-muted-foreground">
                        Nothing scheduled. The day is yours.
                      </li>
                    )}
                  </ul>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-8">
          <section className="rounded-xl border border-border bg-surface p-5">
            <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
              <Bed className="h-4 w-4 text-link" aria-hidden /> Hotels
            </h2>
            <ul className="mt-4 space-y-4 text-sm">
              {accommodations.map((a) => (
                <li key={a.id}>
                  <p className="font-semibold">{a.name}</p>
                  {a.address && <p className="text-muted-foreground">{a.address}</p>}
                  <p className="text-muted-foreground">
                    {formatDate(a.check_in_date)} → {formatDate(a.check_out_date)}
                  </p>
                </li>
              ))}
              {accommodations.length === 0 && (
                <li className="text-muted-foreground">Hotel details arrive closer to departure.</li>
              )}
            </ul>
          </section>

          <section className="rounded-xl border border-border bg-surface p-5">
            <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
              <Sparkles className="h-4 w-4 text-link" aria-hidden /> Live Moments
            </h2>
            <ul className="mt-4 space-y-3 text-sm">
              {moments.map((m) => (
                <li key={m.id}>
                  <p className="font-semibold">
                    {m.title} {m.is_official && <Badge variant="guideless">Guideless</Badge>}
                  </p>
                  <p className="text-muted-foreground">
                    {formatInZone(m.start_at, m.timezone)}
                    {m.location_name ? ` · ${m.location_name}` : ""} · {m.joined} going
                  </p>
                </li>
              ))}
              {moments.length === 0 && (
                <li className="text-muted-foreground">
                  Nothing planned right now. Join or suggest one in the app.
                </li>
              )}
            </ul>
          </section>

          <section className="rounded-xl border border-border bg-surface p-5">
            <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
              <Users className="h-4 w-4 text-link" aria-hidden /> Your group · {members.length}
            </h2>
            <ul className="mt-4 flex flex-wrap gap-2 text-sm">
              {members.map((m) => (
                <li key={m.user_id} className="rounded-full bg-sand px-3 py-1">
                  {m.profile?.display_name || "Traveler"}
                </li>
              ))}
            </ul>
            <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
              <MessageCircle className="h-3.5 w-3.5" aria-hidden /> Group chat is in the app.
            </p>
          </section>

          <section className="rounded-xl bg-ink p-5 text-cloud">
            <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
              <Flag className="h-4 w-4 text-aqua" aria-hidden /> Need a hand?
            </h2>
            <p className="mt-2 text-sm text-cloud/80">
              In an emergency, call local services first (112 across the EU). Then tell us.
            </p>
            <a
              href={`mailto:${emails.support}?subject=${encodeURIComponent(`Trip ${trip.name}`)}`}
              className={cn(buttonVariants({ variant: "inverse", size: "sm" }), "mt-4")}
            >
              Email Guideless
            </a>
          </section>

          <section className="rounded-xl border border-border bg-surface p-5">
            <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
              <CalendarDays className="h-4 w-4 text-accent" aria-hidden /> Put it in your calendar
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Every day, train and group moment, with each one in the local time of the place it
              happens. Opens in Google Calendar, Apple Calendar or anything else that reads .ics.
            </p>
            <a
              href={`/trips/${tripId}/calendar.ics`}
              className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "mt-4")}
              download="guideless-trip.ics"
            >
              Download the trip calendar
            </a>
          </section>

          <Link href="/account" className="text-sm">
            ← Your account
          </Link>
        </aside>
      </div>
    </div>
  );
}
