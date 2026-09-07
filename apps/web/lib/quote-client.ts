"use client";

import { useEffect, useRef, useState } from "react";
import type { BookingQuoteResult } from "@guideless/types";
import type { AddOnSelection } from "@guideless/validation";
import { createClient } from "@/lib/supabase/client";

export interface QuoteInput {
  departureId: string;
  roomIndexes: number[];
  stayOptionId: string | null;
  addOns: AddOnSelection[];
  code: string | null;
  paymentOption: "deposit" | "full";
  applyCredit: boolean;
}

export interface QuoteState {
  quote: BookingQuoteResult | null;
  /** True while a newer quote is in flight; the previous quote stays on screen. */
  pending: boolean;
  error: string | null;
}

/**
 * Asks the database for the price (`public.quote_booking`, anon-callable and read-only).
 * Debounced so a burst of toggles produces one request; stale responses are ignored.
 * The client never computes money itself — it renders whatever the quote says.
 */
export async function fetchQuote(input: QuoteInput): Promise<BookingQuoteResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("quote_booking", {
    p_departure_id: input.departureId,
    p_room_indexes: input.roomIndexes,
    p_stay_option_id: input.stayOptionId ?? undefined,
    p_add_ons: input.addOns as unknown as never,
    p_code: input.code ?? undefined,
    p_payment_option: input.paymentOption,
    p_apply_credit: input.applyCredit,
  });
  if (error) throw new Error(error.message);
  return data as unknown as BookingQuoteResult;
}

export function useBookingQuote(input: QuoteInput | null, debounceMs = 300): QuoteState {
  const [state, setState] = useState<QuoteState>({ quote: null, pending: false, error: null });
  const seq = useRef(0);
  const key = input ? JSON.stringify(input) : null;

  useEffect(() => {
    if (!key) return;
    const parsed = JSON.parse(key) as QuoteInput;
    const mine = ++seq.current;
    const timer = setTimeout(() => {
      setState((s) => ({ ...s, pending: true }));
      fetchQuote(parsed)
        .then((quote) => {
          if (seq.current === mine) setState({ quote, pending: false, error: null });
        })
        .catch((err: unknown) => {
          if (seq.current === mine)
            setState((s) => ({
              ...s,
              pending: false,
              error: err instanceof Error ? err.message : "Could not price this right now.",
            }));
        });
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [key, debounceMs]);

  return state;
}
