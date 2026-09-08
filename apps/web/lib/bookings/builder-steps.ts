/**
 * Trip Builder steps (plan v2 §13–14). The list is derived from what a departure actually offers,
 * so a tour without race tiers never shows a race step and a departure without transfers skips
 * that step. Order is fixed; presence is data-driven. Titles are questions in plain language.
 */
export type BuilderStepKey =
  "dates" | "stay" | "race" | "experiences" | "transfers" | "travelers" | "review" | "payment";

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
  /** Used to phrase the race step ("How do you want to watch Monaco?"). */
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

const ALL: BuilderStepKey[] = [
  "dates",
  "stay",
  "race",
  "experiences",
  "transfers",
  "travelers",
  "review",
  "payment",
];

export function deriveBuilderSteps(input: BuilderStepInput): BuilderStep[] {
  const parts = partitionAddOns(input.addOns);
  const event = input.eventName?.replace(/^Formula 1 /, "").trim();
  const present: Record<BuilderStepKey, boolean> = {
    dates: true,
    stay: input.stayOptionCount > 0,
    race: parts.race.length > 0,
    experiences: parts.experiences.length > 0,
    transfers: parts.transfers.length > 0,
    travelers: true,
    review: true,
    payment: true,
  };
  const copy: Record<BuilderStepKey, [title: string, short: string]> = {
    dates: ["When do you want to go?", "Dates"],
    stay: ["Where do you want to stay?", "Stay"],
    race: [event ? `How do you want to watch ${event}?` : "How do you want to watch?", "Race"],
    experiences: ["What do you want to add?", "Experiences"],
    transfers: ["How do you want to get from the airport?", "Transfers"],
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
