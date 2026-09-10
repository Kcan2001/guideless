"use client";

import type { Route } from "next";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DayPlanStep } from "@/components/builder/day-plan-step";
import type { TripDay } from "@/lib/bookings/add-on-days";
import { BuilderProgress } from "@/components/builder/builder-progress";
import { DepartureStep, type BuilderDepartureSummary } from "@/components/builder/departure-step";
import {
  clearSessionDraft,
  defaultDraft,
  loadSessionDraft,
  mergeDraft,
  saveSessionDraft,
  travelerNames,
  type BuilderDraft,
} from "@/components/builder/draft";
import { PaymentStep } from "@/components/builder/payment-step";
import { QuotePanel } from "@/components/builder/quote-panel";
import { ReviewStep } from "@/components/builder/review-step";
import { StayStep } from "@/components/builder/stay-step";
import { SummaryBar } from "@/components/builder/summary-bar";
import { TravelersStep } from "@/components/builder/travelers-step";
import type { CheckoutDeparture, CheckoutUser } from "@/components/checkout/types";
import { defaultRooms, fitRooms, fitSelection } from "@/lib/bookings/add-on-selection";
import {
  nextStep,
  previousStep,
  type BuilderStep,
  type BuilderStepKey,
} from "@/lib/bookings/builder-steps";
import { saveBuilderDraft, type SavedBuilderDraft } from "@/lib/bookings/drafts";
import { track } from "@/lib/analytics";
import { useBookingQuote } from "@/lib/quote-client";

export { clearSessionDraft };

/**
 * The Trip Builder (plan v2 §13–18): the checkout state machine reorganised around choices.
 * One draft, one quote (from `quote_booking()`), steps derived from what the departure offers.
 * The draft lives in sessionStorage for everyone and in `builder_drafts` when signed in.
 */
export function TripBuilder({
  tourSlug,
  departure,
  departures,
  tripDays,
  steps,
  user,
  googleEnabled = false,
  initialStep,
  cancelled = false,
  serverDraft,
}: {
  tourSlug: string;
  departure: CheckoutDeparture;
  departures: BuilderDepartureSummary[];
  /** The itinerary's days, so the add-on step can lay itself out as the trip's diary. */
  tripDays: TripDay[];
  steps: BuilderStep[];
  user: CheckoutUser | null;
  /** Whether the project has Google sign-in switched on; the button is hidden when it does not. */
  googleEnabled?: boolean;
  initialStep: BuilderStepKey;
  cancelled?: boolean;
  serverDraft: SavedBuilderDraft | null;
}) {
  const router = useRouter();
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [step, setStep] = useState<BuilderStepKey>(initialStep);
  const [draft, setDraft] = useState<BuilderDraft>(() => {
    const base = defaultDraft(departure, user?.email ?? "");
    const local = loadSessionDraft(departure.id);
    const remote = serverDraft?.draft as Partial<BuilderDraft> | undefined;
    // The newer of the two stores wins; the server copy is what makes cross-device resume work.
    const remoteNewer =
      remote &&
      (!local?.updatedAt ||
        !remote.updatedAt ||
        new Date(remote.updatedAt) >= new Date(local.updatedAt));
    return mergeDraft(base, remoteNewer ? (remote ?? null) : local);
  });

  const update = useCallback(
    (patch: Partial<BuilderDraft> | ((d: BuilderDraft) => Partial<BuilderDraft>)) => {
      setDraft((d) => ({
        ...d,
        ...(typeof patch === "function" ? patch(d) : patch),
        updatedAt: new Date().toISOString(),
      }));
    },
    [],
  );

  // Persist: sessionStorage immediately, the server (signed in) debounced.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serverUnavailable = useRef(false);
  useEffect(() => {
    if (!hydrated) return;
    saveSessionDraft(departure.id, { ...draft, step });
    if (!user || serverUnavailable.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const stepIndex = Math.max(
        0,
        steps.findIndex((s) => s.key === step),
      );
      void saveBuilderDraft({
        departureId: departure.id,
        draft: { ...draft, step },
        stepIndex,
      }).then((r) => {
        if (r.unavailable) serverUnavailable.current = true;
      });
    }, 1500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [draft, step, hydrated, user, departure.id, steps]);

  // Analytics: one "started" per mount, one "step viewed" per step.
  const started = useRef(false);
  useEffect(() => {
    if (!hydrated || started.current) return;
    started.current = true;
    track("builder_started", { departure_id: departure.id });
  }, [hydrated, departure.id]);
  useEffect(() => {
    if (hydrated) track("builder_step_viewed", { departure_id: departure.id, step });
  }, [step, hydrated, departure.id]);

  const names = travelerNames(draft);
  const rooms = draft.roomIndexes.slice(0, draft.travelerCount);
  const quoteState = useBookingQuote({
    departureId: departure.id,
    roomIndexes: rooms.length ? rooms : defaultRooms(draft.travelerCount),
    stayOptionId: draft.stayOptionId,
    addOns: draft.addOns,
    code: draft.code,
    paymentOption: draft.paymentOption,
    applyCredit: Boolean(user),
  });
  const lastTotal = useRef<number | null>(null);
  useEffect(() => {
    const q = quoteState.quote;
    if (!q || q.total_amount === lastTotal.current) return;
    lastTotal.current = q.total_amount;
    track("quote_updated", {
      departure_id: departure.id,
      total: q.total_amount / 100,
      due_now: q.due_now_amount / 100,
      currency: q.currency,
    });
  }, [quoteState.quote, departure.id]);

  const current = steps.find((s) => s.key === step) ?? steps[0]!;
  const go = (key: BuilderStepKey | null) => {
    if (!key) return;
    setStep(key);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const back = () => go(previousStep(steps, step));
  const forward = () => go(nextStep(steps, step));

  function setTravelerCount(n: number) {
    update((d) => {
      const travelers = d.travelers.slice(0, n);
      return {
        travelerCount: n,
        travelers,
        roomIndexes: fitRooms(d.roomIndexes, n),
        addOns: fitSelection(d.addOns, departure.addOns, n),
      };
    });
  }

  const soldOut = departure.available <= 0;
  const builderPath = `/tours/${tourSlug}/build?departure=${departure.id}`;

  const stepView = !hydrated ? (
    <div className="h-64 animate-pulse rounded-xl bg-sand/60" aria-busy="true" />
  ) : step === "dates" ? (
    <DepartureStep
      title={current.title}
      departures={departures}
      selectedId={departure.id}
      travelerCount={draft.travelerCount}
      onSelect={(id) => {
        if (id === departure.id) return;
        track("departure_selected", { departure_id: id });
        router.push(`/tours/${tourSlug}/build?departure=${id}` as Route);
      }}
      onTravelerCount={setTravelerCount}
      onNext={forward}
    />
  ) : step === "stay" ? (
    <StayStep
      title={current.title}
      departure={departure}
      stayOptionId={draft.stayOptionId}
      onStay={(id) => {
        update({ stayOptionId: id });
        const tier = departure.stayOptions.find((s) => s.id === id)?.tier ?? undefined;
        track("stay_selected", { departure_id: departure.id, stay_option_id: id, tier });
      }}
      onBack={back}
      onNext={forward}
    />
  ) : step === "days" ? (
    <DayPlanStep
      title={current.title}
      departure={departure}
      addOns={departure.addOns}
      tripDays={tripDays}
      travelerNames={names}
      selection={draft.addOns}
      onChange={(addOns) => update({ addOns })}
      onBack={back}
      onNext={forward}
    />
  ) : step === "travelers" ? (
    <TravelersStep
      title={current.title}
      departure={departure}
      draft={draft}
      userEmail={user?.email ?? ""}
      onRooms={(roomIndexes) => update({ roomIndexes })}
      onGroupCode={(groupCode) => update({ groupCode })}
      onTravelerCountChange={setTravelerCount}
      onBack={back}
      onNext={(v) => {
        update({
          travelers: v.travelers,
          travelerCount: v.travelers.length,
          emergencyContact: v.emergencyContact,
          preferences: v.preferences,
          roomIndexes: fitRooms(draft.roomIndexes, v.travelers.length),
          addOns: fitSelection(draft.addOns, departure.addOns, v.travelers.length),
        });
        track("add_traveler", { count: v.travelers.length });
        forward();
      }}
    />
  ) : step === "review" ? (
    <ReviewStep
      title={current.title}
      user={user}
      googleEnabled={googleEnabled}
      loginNext={`${builderPath}&step=review`}
      onBack={back}
      onNext={forward}
    />
  ) : (
    <PaymentStep
      title={current.title}
      departure={departure}
      draft={draft}
      quote={quoteState.quote ?? null}
      userSignedIn={Boolean(user)}
      onBack={back}
      onPaymentOption={(paymentOption) => update({ paymentOption })}
    />
  );

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-10 pb-28 lg:grid-cols-[1fr_360px] lg:pb-10">
      <div>
        <BuilderProgress steps={steps} current={step} onSelect={go} />
        {cancelled && step === "dates" && (
          <p
            role="status"
            className="mt-6 rounded-lg border border-border bg-sand/60 px-4 py-3 text-sm"
          >
            Payment was cancelled. Nothing was charged; your choices are still here.
          </p>
        )}
        {soldOut ? (
          <div className="mt-10 rounded-xl border border-dashed border-border p-8">
            <h2 className="text-2xl font-bold">This departure just sold out.</h2>
            <p className="mt-2 text-muted-foreground">Other dates may still be open.</p>
          </div>
        ) : (
          <div className="mt-8">{stepView}</div>
        )}
      </div>
      <div className="hidden lg:block">
        <QuotePanel
          departure={departure}
          travelerCount={draft.travelerCount}
          roomIndexes={rooms}
          state={quoteState}
          code={draft.code}
          onCode={(code) => update({ code })}
        />
      </div>
      {hydrated && !soldOut && step !== "payment" && (
        <SummaryBar
          departure={departure}
          travelerCount={draft.travelerCount}
          roomIndexes={rooms}
          state={quoteState}
          code={draft.code}
          onCode={(code) => update({ code })}
          onNext={forward}
          nextLabel={step === "review" ? "Continue to payment" : "Continue"}
          nextDisabled={(step === "review" && !user) || (step === "stay" && !draft.stayOptionId)}
        />
      )}
    </div>
  );
}
