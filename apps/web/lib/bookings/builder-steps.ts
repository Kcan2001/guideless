/**
 * Trip Builder steps (plan v2 §13–14). The list is derived from what a departure actually offers;
 * order is fixed, presence is data-driven, titles are questions in plain language.
 *
 * Race views, experiences and transfers used to be three consecutive steps. They are now one
 * "Your days" step laid out as the days of the trip, because splitting a five-day race weekend
 * across three menus asks the traveler to rebuild the diary in their head — and it hid the fact
 * that a Friday choice and a Sunday choice were never in competition. `partitionAddOns` is kept
 * because the tour page still groups the same way when it is selling rather than booking.
 */
export type BuilderStepKey = "dates" | "stay" | "days" | "travelers" | "review" | "payment";

export interface BuilderStep {
  key: BuilderStepKey;
  /** Question shown as the step heading. */
  title: string;
  /** Short label for the progress list. */
  short: string;
}

export interface BuilderStepInput {
  stayOptionCount: number;
  addOns: ReadonlyArray<{ tier_group: string | null; kind: string }>;
  /** Used to phrase the day step for an event departure. */
  eventName?: string | null;
}

export interface AddOnPartition<T> {
  /** Mutually exclusive tiers (race views): pick one per traveler. */
  race: T[];
  /** Everything optional that is not a transfer. */
  experiences: T[];
  /** Airport and local transfers. */
  transfers: T[];
}

export function partitionAddOns<T extends { tier_group: string | null; kind: string }>(
  addOns: ReadonlyArray<T>,
): AddOnPartition<T> {
  const race: T[] = [];
  const experiences: T[] = [];
  const transfers: T[] = [];
  for (const a of addOns) {
    if (a.tier_group) race.push(a);
    else if (a.kind === "transfer") transfers.push(a);
    else experiences.push(a);
  }
  return { race, experiences, transfers };
}

const ALL: BuilderStepKey[] = ["dates", "stay", "days", "travelers", "review", "payment"];

export function deriveBuilderSteps(input: BuilderStepInput): BuilderStep[] {
  const parts = partitionAddOns(input.addOns);
  const event = input.eventName?.replace(/^Formula 1 /, "").trim();
  const anyAddOns = parts.race.length + parts.experiences.length + parts.transfers.length > 0;
  const present: Record<BuilderStepKey, boolean> = {
    dates: true,
    stay: input.stayOptionCount > 0,
    days: anyAddOns,
    travelers: true,
    review: true,
    payment: true,
  };
  const copy: Record<BuilderStepKey, [title: string, short: string]> = {
    dates: ["When do you want to go?", "Dates"],
    stay: ["Where do you want to stay?", "Stay"],
    days: [
      event ? `How do you want to spend ${event}?` : "How do you want to spend your days?",
      "Your days",
    ],
    travelers: ["Who’s traveling?", "Travelers"],
    review: ["Almost there.", "Review"],
    payment: ["Review and pay.", "Payment"],
  };
  return ALL.filter((k) => present[k]).map((k) => ({
    key: k,
    title: copy[k][0],
    short: copy[k][1],
  }));
}

export function isBuilderStepKey(value: unknown): value is BuilderStepKey {
  return typeof value === "string" && (ALL as string[]).includes(value);
}

/** Resolve a `?step=` value against the derived list; unknown or absent steps start at the first. */
export function resolveStep(steps: BuilderStep[], requested: unknown): BuilderStepKey {
  if (isBuilderStepKey(requested) && steps.some((s) => s.key === requested)) return requested;
  return steps[0]?.key ?? "dates";
}

export function nextStep(steps: BuilderStep[], current: BuilderStepKey): BuilderStepKey | null {
  const i = steps.findIndex((s) => s.key === current);
  return i >= 0 && i < steps.length - 1 ? steps[i + 1]!.key : null;
}

export function previousStep(steps: BuilderStep[], current: BuilderStepKey): BuilderStepKey | null {
  const i = steps.findIndex((s) => s.key === current);
  return i > 0 ? steps[i - 1]!.key : null;
}
