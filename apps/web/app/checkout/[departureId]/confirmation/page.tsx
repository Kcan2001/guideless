import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Check, Clock } from "lucide-react";
import { emails } from "@guideless/config";
import { formatDate, formatDateRange, formatMoney } from "@guideless/utils";
import { TrackView } from "@/components/analytics/track-view";
import { ClearDraft } from "@/components/checkout/clear-draft";
import { buttonVariants } from "@/components/ui/button";
import { getMyBooking } from "@/lib/data/bookings";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Booking confirmation",
  robots: { index: false, follow: false },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Step 7. Stripe redirects here after payment. The webhook, not this page, confirms the booking —
 * so if it has not landed yet we show "processing" and let the customer refresh.
 */
export default async function ConfirmationPage(
  props: PageProps<"/checkout/[departureId]/confirmation">,
) {
  const [{ departureId }, sp] = await Promise.all([props.params, props.searchParams]);
  const bookingId = typeof sp.booking === "string" ? sp.booking : "";
  if (!UUID.test(departureId) || !UUID.test(bookingId)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    redirect(
      `/login?next=${encodeURIComponent(`/checkout/${departureId}/confirmation?booking=${bookingId}`)}`,
    );

  const ctx = await getMyBooking(bookingId);
  if (!ctx || ctx.booking.departure_id !== departureId) notFound();
  const { booking: b, departure, tour, travelers } = ctx;
  const currency = b.currency as Parameters<typeof formatMoney>[0]["currency"];
  const money = (amount: number) => formatMoney({ amount, currency });
  const confirmed = b.status === "confirmed" || b.status === "completed";
  const balance = Math.max(b.total_amount - b.amount_paid, 0);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <section className="mt-10 rounded border border-border bg-surface p-8">
        {confirmed ? (
          <>
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-aqua/30">
              <Check className="h-6 w-6 text-ink" aria-hidden />
            </span>
            <h1 className="mt-5 text-3xl ">You&rsquo;re booked.</h1>
            <p className="mt-2 text-muted-foreground">
              A confirmation is on its way to your inbox. Nothing else to do right now.
            </p>
          </>
        ) : (
          <>
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-sand">
              <Clock className="h-6 w-6 text-ink" aria-hidden />
            </span>
            <h1 className="mt-5 text-3xl ">Finishing up your payment…</h1>
            <p className="mt-2 text-muted-foreground">
              Stripe is confirming the charge. This usually takes a few seconds — refresh this page,
              or check your bookings in a moment. Your seats are held.
            </p>
            <Link
              href={`/checkout/${departureId}/confirmation?booking=${b.id}`}
              className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "mt-4")}
            >
              Refresh
            </Link>
          </>
        )}

        <dl className="mt-8 grid gap-4 border-t border-border pt-6 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Confirmation number</dt>
            <dd className="num text-xl">{b.confirmation_number}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Trip</dt>
            <dd className="font-semibold">{tour.name}</dd>
            <dd className="text-muted-foreground">
              {departure.start_date && departure.end_date
                ? formatDateRange(departure.start_date, departure.end_date)
                : ""}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Travelers</dt>
            <dd>{travelers.map((t) => `${t.first_name} ${t.last_name}`).join(", ") || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Paid</dt>
            <dd className="font-semibold">{money(b.amount_paid)}</dd>
            {balance > 0 && (
              <dd className="text-muted-foreground">
                {money(balance)} due{" "}
                {departure.balance_due_date
                  ? formatDate(departure.balance_due_date)
                  : "before departure"}
              </dd>
            )}
          </div>
        </dl>

        <div className="mt-8 rounded bg-cloud p-5 text-sm">
          <p className="font-semibold">What happens next</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>90 days out: trip overview and where to fly into.</li>
            <li>30 days out: detailed itinerary, hotels and your group.</li>
            <li>7 days out: exact pickup instructions and documents in the app.</li>
          </ul>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/account" className={buttonVariants()}>
            Your bookings <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link href={`/tours/${tour.slug}`} className={buttonVariants({ variant: "secondary" })}>
            Back to the trip
          </Link>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          Questions? <a href={`mailto:${emails.support}`}>{emails.support}</a>
        </p>
      </section>

      <ClearDraft departureId={departureId} />
      {confirmed && (
        <TrackView
          event="purchase"
          params={{
            transaction_id: b.confirmation_number,
            tour_id: tour.id,
            departure_id: departureId,
            currency: b.currency,
            value: b.amount_paid / 100,
          }}
        />
      )}
    </div>
  );
}
