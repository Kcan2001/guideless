import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CalendarDays } from "lucide-react";
import { emptyStates } from "@guideless/config";
import { formatDate, formatDateRange, formatMoney } from "@guideless/utils";
import type { BookingStatus, CancellationTier, Currency, PaymentStatus } from "@guideless/types";
import { CancelBooking } from "@/components/account/cancel-booking";
import { OnboardingChecklist } from "@/components/account/onboarding-checklist";
import { ReferralCard } from "@/components/account/referral-card";
import { TravelerDetails } from "@/components/account/traveler-details";
import { previewRefund } from "@/lib/bookings/cancellations";
import {
  listEmergencyContacts,
  listMyCancellationRequests,
  listRefundableAddOns,
} from "@/lib/bookings/self-service-data";
import { getMyReferral, listMyBookingAddOns, type BookingAddOn } from "@/lib/data/add-on-purchases";
import { signOut } from "@/lib/auth/actions";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { payBalance } from "@/lib/bookings/actions";
import { daysBetweenDates, onboardingSteps, travelersComplete } from "@/lib/bookings/onboarding";
import { listMyBookings } from "@/lib/data/bookings";
import { listMyTrips } from "@/lib/data/trips";
import { isStripeConfigured } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};

const STATUS: Record<
  BookingStatus,
  { label: string; variant: "included" | "info" | "warning" | "danger" | "neutral" }
> = {
  draft: { label: "Not finished", variant: "neutral" },
  pending_payment: { label: "Awaiting payment", variant: "warning" },
  confirmed: { label: "Confirmed", variant: "included" },
  completed: { label: "Completed", variant: "neutral" },
  cancelled: { label: "Cancelled", variant: "danger" },
  refunded: { label: "Refunded", variant: "danger" },
};

const PAYMENT: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  deposit_paid: "Deposit paid",
  partially_paid: "Partially paid",
  paid: "Paid in full",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
  failed: "Payment failed",
};

const ERRORS: Record<string, string> = {
  invalid: "That booking link didn't look right. Please try again from this page.",
  payments_unavailable: "Online payment isn't switched on yet. We'll email you when it is.",
  not_payable: "That booking can't take a payment right now. Contact us if that seems wrong.",
  nothing_due: "There's nothing left to pay on that booking.",
  unknown: "We couldn't open the payment page. Nothing was charged. Please try again.",
};

export default async function AccountPage(props: PageProps<"/account">) {
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    sp,
  ] = await Promise.all([supabase.auth.getUser(), props.searchParams]);
  if (!user) redirect("/login?next=/account");

  const [bookings, trips, referral] = await Promise.all([
    listMyBookings(),
    listMyTrips(),
    getMyReferral(),
  ]);
  const travelerIds = bookings.flatMap((b) => b.travelers.map((t) => t.id));
  const bookingIds = bookings.map((b) => b.booking.id);
  const [
    contactsByTraveler,
    { data: tokens },
    bookingAddOns,
    cancellationRequests,
    refundableAddOns,
  ] = await Promise.all([
    listEmergencyContacts(travelerIds),
    supabase.from("push_tokens").select("id").is("disabled_at", null).limit(1),
    listMyBookingAddOns(bookingIds),
    listMyCancellationRequests(bookingIds),
    listRefundableAddOns(bookingIds),
  ]);
  const { data: leads } = travelerIds.length
    ? await supabase
        .from("booking_travelers")
        .select("booking_id, traveler_id")
        .in("booking_id", bookingIds)
        .eq("is_lead", true)
    : { data: [] as { booking_id: string; traveler_id: string }[] };
  const leadByBooking = new Map((leads ?? []).map((l) => [l.booking_id, l.traveler_id]));
  const notice = typeof sp.notice === "string" ? sp.notice : null;
  const errorMsg = typeof sp.error_msg === "string" ? sp.error_msg : null;
  const addOnsByBooking = new Map<string, BookingAddOn[]>();
  for (const a of bookingAddOns) {
    addOnsByBooking.set(a.booking_id, [...(addOnsByBooking.get(a.booking_id) ?? []), a]);
  }
  const added = sp.added === "1";
  const contactTravelerIds = new Set(contactsByTraveler.keys());
  const appConnected = (tokens ?? []).length > 0;
  const todayISO = new Date().toISOString().slice(0, 10);
  const tripByDeparture = new Map(trips.map((t) => [t.departure_id, t.id]));
  const paid = typeof sp.paid === "string" ? sp.paid : null;
  const error = typeof sp.error === "string" ? ERRORS[sp.error] : null;
  const upcoming = bookings.filter((b) =>
    ["confirmed", "pending_payment"].includes(b.booking.status),
  );
  const other = bookings.filter(
    (b) => !["confirmed", "pending_payment"].includes(b.booking.status),
  );
  const liveTrips = trips.filter((t) => t.status !== "cancelled");

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Your account
          </p>
          <h1 className="mt-3 text-4xl font-bold md:text-5xl">Your trips.</h1>
          <p className="mt-2 text-muted-foreground">{user.email}</p>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="secondary" size="sm">
            Sign out
          </Button>
        </form>
      </div>

      {added && (
        <p role="status" className="mt-8 rounded-xl border border-aqua bg-aqua/10 p-4 text-sm">
          Added. Your new add-ons are being confirmed and will show under the booking within a
          minute. Your group can see who&rsquo;s in.
        </p>
      )}
      {paid && (
        <p role="status" className="mt-8 rounded-xl border border-aqua bg-aqua/10 p-4 text-sm">
          Thank you. Your payment for {paid} is being confirmed and will show below within a minute.
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-8 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm"
        >
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-8 rounded-xl border border-aqua bg-aqua/10 p-4 text-sm">
          {notice}
        </p>
      )}
      {errorMsg && (
        <p
          role="alert"
          className="mt-8 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm"
        >
          {errorMsg}
        </p>
      )}

      {liveTrips.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold">Open trip</h2>
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {liveTrips.map((t) => (
              <li key={t.id} className="rounded-xl border border-aqua bg-aqua/10 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {t.status}
                </p>
                <p className="mt-1 font-heading text-xl font-semibold">{t.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDateRange(t.start_date, t.end_date)}
                </p>
                <Link href={`/trips/${t.id}`} className={buttonVariants({ size: "sm" }) + " mt-4"}>
                  Open trip <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {bookings.length === 0 ? (
        <div className="mt-12 rounded-xl border border-dashed border-border p-10">
          <p className="font-heading text-xl font-semibold">{emptyStates.noTrips.title}</p>
          <p className="mt-1 text-muted-foreground">{emptyStates.noTrips.body}</p>
          <Link href="/tours" className={buttonVariants() + " mt-6"}>
            {emptyStates.noTrips.cta} <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      ) : (
        <>
          {upcoming
            .filter((b) => b.booking.status === "confirmed" && b.departure.start_date)
            .map((b) => {
              const balance = Math.max(b.booking.total_amount - b.booking.amount_paid, 0);
              const steps = onboardingSteps({
                daysUntilStart: daysBetweenDates(todayISO, b.departure.start_date!),
                balanceDue: balance,
                balanceDueDate: b.departure.balance_due_date
                  ? formatDate(b.departure.balance_due_date)
                  : null,
                travelersComplete: travelersComplete(
                  b.travelers.map((t) => ({
                    date_of_birth: t.date_of_birth,
                    nationality: t.nationality,
                    hasEmergencyContact: contactTravelerIds.has(t.id),
                  })),
                ),
                appConnected,
                tripId: tripByDeparture.get(b.booking.departure_id) ?? null,
              });
              return (
                <section key={b.booking.id} className="mt-12">
                  <h2 className="text-xl font-semibold">Getting ready</h2>
                  <div className="mt-4">
                    <OnboardingChecklist steps={steps} tourName={b.tour.name} />
                  </div>
                </section>
              );
            })}
          <BookingList
            title="Upcoming"
            items={upcoming}
            stripeReady={isStripeConfigured()}
            addOnsByBooking={addOnsByBooking}
          />
          {upcoming.length > 0 && (
            <section className="mt-12" id="travelers">
              <h2 className="text-xl font-semibold">Traveler details</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Hotels and rail operators need these. Names as on the passport are changed through
                support.
              </p>
              {upcoming.map((b) => (
                <div key={b.booking.id} id={`booking-${b.booking.id}`} className="mt-6">
                  <p className="font-heading font-semibold">
                    {b.tour.name} · {b.booking.confirmation_number}
                  </p>
                  <TravelerDetails
                    bookingId={b.booking.id}
                    travelers={b.travelers}
                    leadTravelerId={leadByBooking.get(b.booking.id) ?? null}
                    contacts={contactsByTraveler}
                  />
                  {b.booking.status === "confirmed" &&
                    b.departure.start_date &&
                    b.departure.end_date && (
                      <CancelBooking
                        bookingId={b.booking.id}
                        currency={b.booking.currency as Currency}
                        preview={previewRefund({
                          todayISO,
                          startDate: b.departure.start_date,
                          endDate: b.departure.end_date,
                          policy: (b.departure.cancellation_policy ??
                            []) as unknown as CancellationTier[],
                          amountPaid: b.booking.amount_paid,
                          addOns: refundableAddOns.filter((a) => a.bookingId === b.booking.id),
                        })}
                        pending={
                          cancellationRequests.find(
                            (r) => r.booking_id === b.booking.id && r.status === "pending",
                          ) ?? null
                        }
                        recent={
                          cancellationRequests.find((r) => r.booking_id === b.booking.id) ?? null
                        }
                      />
                    )}
                </div>
              ))}
            </section>
          )}
          <section className="mt-12">
            <h2 className="text-xl font-semibold">Bring a friend</h2>
            <div className="mt-4">
              <ReferralCard
                code={referral.code}
                balances={referral.balances}
                earnedCount={referral.earnedCount}
                pendingCount={referral.pendingCount}
              />
            </div>
          </section>
          {other.length > 0 && (
            <BookingList
              title="Past and cancelled"
              items={other}
              stripeReady={false}
              addOnsByBooking={addOnsByBooking}
            />
          )}
        </>
      )}
    </div>
  );
}

function BookingList({
  title,
  items,
  stripeReady,
  addOnsByBooking,
}: {
  title: string;
  items: Awaited<ReturnType<typeof listMyBookings>>;
  stripeReady: boolean;
  addOnsByBooking: Map<string, BookingAddOn[]>;
}) {
  if (items.length === 0) return null;
  const firstPayable = items.find(
    (x) => x.booking.status === "confirmed" && x.booking.total_amount > x.booking.amount_paid,
  );
  return (
    <section className="mt-12">
      <h2 className="text-xl font-semibold">{title}</h2>
      <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-surface">
        {items.map(({ booking: b, departure, tour, travelers }) => {
          const currency = b.currency as Parameters<typeof formatMoney>[0]["currency"];
          const balance = Math.max(b.total_amount - b.amount_paid, 0);
          const status = STATUS[b.status];
          const addOns = addOnsByBooking.get(b.id) ?? [];
          return (
            <li key={b.id} className="flex flex-wrap items-center gap-4 p-5">
              <div className="min-w-0 flex-1">
                <p className="font-heading text-lg font-semibold">{tour.name}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                    {departure.start_date && departure.end_date
                      ? formatDateRange(departure.start_date, departure.end_date)
                      : "—"}
                  </span>
                  <span>
                    {travelers.length} {travelers.length === 1 ? "traveler" : "travelers"}
                  </span>
                  <span>{b.confirmation_number}</span>
                </p>
                {b.status === "confirmed" && (
                  <div className="mt-3 text-sm">
                    {addOns.length > 0 && (
                      <ul className="flex flex-wrap gap-2" aria-label="Add-ons on this booking">
                        {addOns.map((a) => (
                          <li key={a.id}>
                            <Badge variant={a.status === "confirmed" ? "included" : "optional"}>
                              {a.add_on?.title ?? "Add-on"}
                              {a.traveler
                                ? ` · ${a.traveler.preferred_name || a.traveler.first_name}`
                                : a.quantity > 1
                                  ? ` × ${a.quantity}`
                                  : ""}
                              {a.status === "pending" ? " · confirming" : ""}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                    <Link
                      href={`/account/bookings/${b.id}/add-ons`}
                      className="mt-2 inline-block text-link no-underline hover:underline"
                    >
                      {addOns.length > 0 ? "Add more to your trip" : "Add to your trip"} →
                    </Link>
                  </div>
                )}
              </div>
              <div className="text-right text-sm">
                <Badge variant={status.variant}>{status.label}</Badge>
                <p className="mt-1 text-muted-foreground">{PAYMENT[b.payment_status]}</p>
                {balance > 0 && b.status === "confirmed" && (
                  <p className="text-muted-foreground">
                    {formatMoney({ amount: balance, currency }, { compact: true })} due{" "}
                    {departure.balance_due_date
                      ? formatDate(departure.balance_due_date)
                      : "before departure"}
                  </p>
                )}
              </div>
              {b.status === "confirmed" && balance > 0 ? (
                <form
                  action={payBalance}
                  id={firstPayable?.booking.id === b.id ? "pay" : undefined}
                >
                  <input type="hidden" name="bookingId" value={b.id} />
                  <Button type="submit" size="sm" disabled={!stripeReady}>
                    {stripeReady ? "Pay balance" : "Payment opens soon"}
                  </Button>
                </form>
              ) : b.status === "pending_payment" || b.status === "draft" ? (
                <Link
                  href={`/checkout/${b.departure_id}`}
                  className={buttonVariants({ size: "sm" })}
                >
                  Finish booking
                </Link>
              ) : (
                <Link
                  href={`/tours/${tour.slug}`}
                  className={buttonVariants({ variant: "secondary", size: "sm" })}
                >
                  Trip page
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
