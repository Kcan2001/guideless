import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CalendarDays } from "lucide-react";
import { emptyStates } from "@guideless/config";
import { formatDate, formatDateRange, formatMoney } from "@guideless/utils";
import type { BookingStatus, PaymentStatus } from "@guideless/types";
import { signOut } from "@/lib/auth/actions";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { listMyBookings } from "@/lib/data/bookings";
import { listMyTrips } from "@/lib/data/trips";
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

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account");

  const [bookings, trips] = await Promise.all([listMyBookings(), listMyTrips()]);
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
          <BookingList title="Upcoming" items={upcoming} />
          {other.length > 0 && <BookingList title="Past and cancelled" items={other} />}
        </>
      )}
    </div>
  );
}

function BookingList({
  title,
  items,
}: {
  title: string;
  items: Awaited<ReturnType<typeof listMyBookings>>;
}) {
  if (items.length === 0) return null;
  return (
    <section className="mt-12">
      <h2 className="text-xl font-semibold">{title}</h2>
      <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-surface">
        {items.map(({ booking: b, departure, tour, travelers }) => {
          const currency = b.currency as Parameters<typeof formatMoney>[0]["currency"];
          const balance = Math.max(b.total_amount - b.amount_paid, 0);
          const status = STATUS[b.status];
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
              {b.status === "pending_payment" || b.status === "draft" ? (
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
