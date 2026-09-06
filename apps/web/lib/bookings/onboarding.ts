/**
 * Pre-trip onboarding (spec §85) with progressive disclosure (spec §86).
 *
 * Booking confirmed → complete traveler details → pay the balance → get the app → meet your group
 * → final trip details. Steps appear as they become relevant so a booking six months out shows
 * three quiet items, not a wall of tasks. Pure and unit-tested; the account page supplies facts.
 */

export type OnboardingKey = "booked" | "travelers" | "balance" | "app" | "group" | "final";

export interface OnboardingStep {
  key: OnboardingKey;
  label: string;
  hint: string;
  done: boolean;
  /** Where the customer goes to complete the step (undefined when done or not actionable here). */
  href?: string;
}

export interface OnboardingFacts {
  /** Whole days from today to the departure start date (negative once it has started). */
  daysUntilStart: number;
  /** Minor units still owed; 0 when paid in full. */
  balanceDue: number;
  balanceDueDate: string | null;
  /** Every traveler on the booking has date of birth, nationality and an emergency contact. */
  travelersComplete: boolean;
  /** The account has registered at least one push token (the app has been signed into). */
  appConnected: boolean;
  /** The trip id once the departure has been activated into a trip the customer belongs to. */
  tripId: string | null;
}

export const APP_STORE_HINT = "Free on iOS and Android. Sign in with this account.";

export function onboardingSteps(f: OnboardingFacts): OnboardingStep[] {
  const steps: OnboardingStep[] = [
    {
      key: "booked",
      label: "Booking confirmed",
      hint: "Your place is held. Nothing else is needed today.",
      done: true,
    },
    {
      key: "travelers",
      label: "Complete traveler details",
      hint: "Date of birth, nationality and an emergency contact for each traveler.",
      done: f.travelersComplete,
      href: f.travelersComplete ? undefined : "#travelers",
    },
  ];

  if (f.balanceDue > 0 || f.daysUntilStart <= 90) {
    steps.push({
      key: "balance",
      label: f.balanceDue > 0 ? "Pay the balance" : "Paid in full",
      hint:
        f.balanceDue > 0
          ? f.balanceDueDate
            ? `Due ${f.balanceDueDate}. Pay any time before then.`
            : "Due before departure. Pay any time."
          : "Nothing more to pay.",
      done: f.balanceDue <= 0,
      href: f.balanceDue > 0 ? "#pay" : undefined,
    });
  }

  if (f.daysUntilStart <= 90) {
    steps.push({
      key: "app",
      label: "Get the Guideless app",
      hint: APP_STORE_HINT,
      done: f.appConnected,
      href: f.appConnected ? undefined : "/how-it-works#app",
    });
  }

  if (f.daysUntilStart <= 30 || f.tripId) {
    steps.push({
      key: "group",
      label: "Meet your group",
      hint: f.tripId
        ? "Your route and group are open. Say hello, or don't."
        : "Your group opens about a month before departure.",
      done: !!f.tripId,
      href: f.tripId ? `/trips/${f.tripId}` : undefined,
    });
  }

  if (f.daysUntilStart <= 7) {
    steps.push({
      key: "final",
      label: "Final trip details",
      hint: f.tripId
        ? "Arrival time, first hotel and where to meet are in your trip."
        : "Arrival instructions arrive a week before departure.",
      done: !!f.tripId,
      href: f.tripId ? `/trips/${f.tripId}` : undefined,
    });
  }

  return steps;
}

/** Whole days between two ISO dates (YYYY-MM-DD), ignoring time zones on purpose. */
export function daysBetweenDates(fromISO: string, toISO: string): number {
  const from = Date.UTC(
    Number(fromISO.slice(0, 4)),
    Number(fromISO.slice(5, 7)) - 1,
    Number(fromISO.slice(8, 10)),
  );
  const to = Date.UTC(
    Number(toISO.slice(0, 4)),
    Number(toISO.slice(5, 7)) - 1,
    Number(toISO.slice(8, 10)),
  );
  return Math.round((to - from) / 86_400_000);
}

export interface TravelerCompleteness {
  date_of_birth: string | null;
  nationality: string | null;
  hasEmergencyContact: boolean;
}

export function travelersComplete(travelers: TravelerCompleteness[]): boolean {
  return (
    travelers.length > 0 &&
    travelers.every((t) => !!t.date_of_birth && !!t.nationality && t.hasEmergencyContact)
  );
}
