import "server-only";

import type { BookingQuoteResult } from "@guideless/types";
import { listDepartureExtras } from "@/lib/data/extras";
import { getTourBySlug } from "@/lib/data/tours";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * The homepage "Start with a trip. Make it yours." example (plan v2 §5). Nothing here is typed by
 * hand: the numbers come from `quote_booking` for the next departure of one tour, so the homepage
 * can never disagree with the builder. Returns null when any ingredient is missing.
 */
export interface ConfiguratorExample {
  tourSlug: string;
  tourName: string;
  startDate: string;
  endDate: string;
  currency: BookingQuoteResult["currency"];
  base: { title: string; amount: number };
  stay: { title: string; included: boolean; amount: number } | null;
  choices: Array<{ title: string; amount: number }>;
  total: number;
  deposit: number;
  /** Deposit plus add-ons, which are always paid in full when chosen (docs/pricing.md). */
  dueNow: number;
  balance: number;
}

const EXAMPLE_ADD_ONS = ["Grandstand K", "Friday coast boat", "Private airport transfer"] as const;

export async function getConfiguratorExample(
  tourSlug = "monaco-grand-prix",
): Promise<ConfiguratorExample | null> {
  const detail = await getTourBySlug(tourSlug);
  const departure = detail?.departures[0];
  if (!detail || !departure) return null;

  const extras = await listDepartureExtras(departure.id);
  const stay = extras.stayOptions.find((s) => s.is_default) ?? extras.stayOptions[0] ?? null;
  const picks = EXAMPLE_ADD_ONS.flatMap((prefix) => {
    const hit = extras.addOns.find((a) => a.title.toLowerCase().startsWith(prefix.toLowerCase()));
    return hit ? [hit] : [];
  });
  if (picks.length !== EXAMPLE_ADD_ONS.length) return null;

  const sb = createPublicClient();
  const { data, error } = await sb.rpc("quote_booking", {
    p_departure_id: departure.id,
    p_room_indexes: [1],
    p_stay_option_id: stay?.id ?? undefined,
    p_add_ons: picks.map((a) =>
      a.pricing_basis === "per_booking"
        ? { addOnId: a.id, quantity: 1 }
        : { addOnId: a.id, travelerIndexes: [1] },
    ) as unknown as never,
    p_payment_option: "deposit",
    p_apply_credit: false,
  });
  if (error || !data) return null;
  const quote = data as unknown as BookingQuoteResult;
  if (quote.problems.length > 0) return null;

  const baseLine = quote.lines.find((l) => l.kind === "base");
  if (!baseLine) return null;
  return {
    tourSlug: detail.tour.slug,
    tourName: detail.tour.name,
    startDate: departure.startDate,
    endDate: departure.endDate,
    currency: quote.currency,
    base: { title: "Base trip", amount: departure.priceAmount },
    stay: stay
      ? {
          title: stay.name,
          included: stay.price_delta_amount === 0,
          amount: stay.price_delta_amount,
        }
      : null,
    choices: quote.lines
      .filter((l) => l.kind === "add_on")
      .map((l) => ({ title: l.title, amount: l.total_amount })),
    total: quote.total_amount,
    deposit: quote.deposit_amount,
    dueNow: quote.due_now_amount,
    balance: quote.balance_amount,
  };
}
