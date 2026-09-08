import type { PaymentOption } from "@guideless/utils";
import type {
  AddOnSelection,
  BookingPreferencesInput,
  EmergencyContactInput,
  TravelerInput,
} from "@guideless/validation";
import type { CheckoutDeparture } from "@/components/checkout/types";
import type { BuilderStepKey } from "@/lib/bookings/builder-steps";
import { defaultRooms } from "@/lib/bookings/add-on-selection";

/**
 * Everything a traveler has chosen in the builder. Persisted in sessionStorage for everyone and
 * in `builder_drafts` for signed-in travelers. Never contains money: the quote is recomputed.
 */
export interface BuilderDraft {
  /** Chosen before names are known so per-traveler add-ons can be picked early. */
  travelerCount: number;
  travelers: TravelerInput[];
  /** One 1-based room per traveler; two travelers may share (lib/bookings/add-on-selection). */
  roomIndexes: number[];
  stayOptionId: string | null;
  addOns: AddOnSelection[];
  /** Coupon or referral code applied to the quote. */
  code: string | null;
  /** A friend's trip code: same departure, same group, separate booking. */
  groupCode: string | null;
  emergencyContact: EmergencyContactInput | null;
  preferences: BookingPreferencesInput | null;
  paymentOption: PaymentOption;
  /** Last step reached, for resume. */
  step: BuilderStepKey;
  /** Client clock when last changed; lets a server draft win over an older local one. */
  updatedAt: string;
}

export const emptyTraveler = (email = ""): TravelerInput => ({
  firstName: "",
  lastName: "",
  preferredName: undefined,
  email,
  phone: undefined,
  dateOfBirth: "",
  nationality: "",
});

export function defaultDraft(departure: CheckoutDeparture, email: string): BuilderDraft {
  return {
    travelerCount: 1,
    travelers: [emptyTraveler(email)],
    roomIndexes: defaultRooms(1),
    stayOptionId:
      departure.stayOptions.find((s) => s.is_default)?.id ?? departure.stayOptions[0]?.id ?? null,
    addOns: [],
    code: null,
    groupCode: null,
    emergencyContact: null,
    preferences: null,
    paymentOption: departure.depositAmount > 0 ? "deposit" : "full",
    step: "dates",
    updatedAt: new Date(0).toISOString(),
  };
}

export function storageKey(departureId: string): string {
  return `guideless:builder:${departureId}`;
}

export function loadSessionDraft(departureId: string): Partial<BuilderDraft> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(departureId));
    return raw ? (JSON.parse(raw) as Partial<BuilderDraft>) : null;
  } catch {
    return null;
  }
}

export function saveSessionDraft(departureId: string, draft: BuilderDraft): void {
  try {
    sessionStorage.setItem(storageKey(departureId), JSON.stringify(draft));
  } catch {
    /* storage unavailable */
  }
}

export function clearSessionDraft(departureId: string): void {
  try {
    sessionStorage.removeItem(storageKey(departureId));
    // The pre-builder checkout key, in case a visitor still has one.
    sessionStorage.removeItem(`guideless:checkout:${departureId}`);
  } catch {
    /* storage unavailable */
  }
}

/** Merge a stored partial draft over the defaults, repairing traveler count and rooms. */
export function mergeDraft(base: BuilderDraft, stored: Partial<BuilderDraft> | null): BuilderDraft {
  if (!stored) return base;
  const merged: BuilderDraft = { ...base, ...stored };
  const count = Math.min(8, Math.max(1, merged.travelerCount || merged.travelers.length || 1));
  const travelers = merged.travelers.slice(0, count);
  while (travelers.length < count)
    travelers.push(emptyTraveler(travelers.length === 0 ? (base.travelers[0]?.email ?? "") : ""));
  return { ...merged, travelerCount: count, travelers };
}

export function travelerNames(draft: BuilderDraft): string[] {
  return Array.from({ length: draft.travelerCount }, (_, i) => {
    const t = draft.travelers[i];
    return t?.preferredName?.trim() || t?.firstName.trim() || "";
  });
}
