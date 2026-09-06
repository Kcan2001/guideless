"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Plus, Trash2 } from "lucide-react";
import { brand } from "@guideless/config";
import type { PaymentOption } from "@guideless/utils";
import { formatMoney } from "@guideless/utils";
import {
  bookingPreferencesSchema,
  emergencyContactSchema,
  travelerInputSchema,
  type BookingPreferencesInput,
  type EmergencyContactInput,
  type TravelerInput,
} from "@guideless/validation";
import { LoginForm } from "@/components/auth/login-form";
import { OrderSummary } from "@/components/checkout/order-summary";
import { Stepper } from "@/components/checkout/stepper";
import type { CheckoutDeparture, CheckoutUser } from "@/components/checkout/types";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { startCheckout } from "@/lib/bookings/actions";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

// ── Draft persisted in sessionStorage so signing in mid-flow never loses the form ──
interface Draft {
  travelers: TravelerInput[];
  emergencyContact: EmergencyContactInput | null;
  preferences: BookingPreferencesInput | null;
  paymentOption: PaymentOption;
}

const emptyTraveler = (email = ""): TravelerInput => ({
  firstName: "",
  lastName: "",
  preferredName: undefined,
  email,
  phone: undefined,
  dateOfBirth: "",
  nationality: "",
});

function loadDraft(key: string, fallback: Draft): Draft {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<Draft>) } : fallback;
  } catch {
    return fallback;
  }
}

const travelersStepSchema = z.object({
  travelers: z.array(travelerInputSchema).min(1).max(8),
  emergencyContact: emergencyContactSchema,
});
type TravelersStepInput = z.input<typeof travelersStepSchema>;
type TravelersStepOutput = z.output<typeof travelersStepSchema>;

type PreferencesInput = z.input<typeof bookingPreferencesSchema>;

const TERMS = [
  ["terms", "I accept the Terms of Service."],
  ["cancellationPolicy", "I understand the cancellation policy for this departure."],
  [
    "travelResponsibility",
    "I understand I am responsible for my own flights, insurance and documents.",
  ],
  ["privacyPolicy", "I accept the Privacy Policy."],
] as const;

export function CheckoutWizard({
  departure,
  user,
  initialStep = 1,
  cancelled = false,
}: {
  departure: CheckoutDeparture;
  user: CheckoutUser | null;
  initialStep?: number;
  cancelled?: boolean;
}) {
  const storageKey = `guideless:checkout:${departure.id}`;
  const [step, setStep] = useState(() => Math.min(Math.max(initialStep, 1), 5));
  // false on the server and during hydration, true afterwards — without a setState-in-effect.
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  // The wizard body only renders once hydrated, so reading storage in the initializer is safe:
  // server HTML and the first client render are the same skeleton regardless of the draft.
  const [draft, setDraft] = useState<Draft>(() =>
    loadDraft(storageKey, {
      travelers: [emptyTraveler(user?.email ?? "")],
      emergencyContact: null,
      preferences: null,
      paymentOption: departure.depositAmount > 0 ? "deposit" : "full",
    }),
  );

  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {
      /* storage unavailable */
    }
  }, [draft, hydrated, storageKey]);

  const soldOut = departure.available <= 0;

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-10 px-6 py-10 lg:grid-cols-[1fr_360px]">
      <div>
        <Stepper current={step} />
        {cancelled && step === 1 && (
          <p
            role="status"
            className="mt-6 rounded-lg border border-border bg-sand/60 px-4 py-3 text-sm"
          >
            Payment was cancelled. Nothing was charged — your details are still here.
          </p>
        )}
        {soldOut ? (
          <div className="mt-10 rounded-xl border border-dashed border-border p-8">
            <h1 className="text-2xl font-bold">This departure just sold out.</h1>
            <p className="mt-2 text-muted-foreground">
              Other dates for {departure.tourName} may still be open.
            </p>
          </div>
        ) : (
          <div className="mt-8">
            {!hydrated ? (
              <div className="h-64 animate-pulse rounded-xl bg-sand/60" aria-busy="true" />
            ) : step === 1 ? (
              <TravelersStep
                draft={draft}
                userEmail={user?.email ?? ""}
                onNext={(v) => {
                  setDraft((d) => ({
                    ...d,
                    travelers: v.travelers,
                    emergencyContact: v.emergencyContact,
                  }));
                  track("add_traveler", { count: v.travelers.length });
                  setStep(2);
                }}
              />
            ) : step === 2 ? (
              <PreferencesStep
                draft={draft}
                onBack={() => setStep(1)}
                onNext={(v) => {
                  setDraft((d) => ({ ...d, preferences: v }));
                  setStep(3);
                }}
              />
            ) : step === 3 ? (
              <AccountStep
                departureId={departure.id}
                user={user}
                onBack={() => setStep(2)}
                onNext={() => setStep(4)}
              />
            ) : step === 4 ? (
              <TermsStep onBack={() => setStep(3)} onNext={() => setStep(5)} />
            ) : (
              <PaymentStep
                departure={departure}
                draft={draft}
                userSignedIn={Boolean(user)}
                onBack={() => setStep(4)}
                onPaymentOption={(paymentOption) => setDraft((d) => ({ ...d, paymentOption }))}
              />
            )}
          </div>
        )}
      </div>
      <OrderSummary
        departure={departure}
        travelerCount={draft.travelers.length}
        paymentOption={draft.paymentOption}
      />
    </div>
  );
}

// ── Step 2: Travelers ─────────────────────────────────────────────────────────
function TravelersStep({
  draft,
  userEmail,
  onNext,
}: {
  draft: Draft;
  userEmail: string;
  onNext: (v: TravelersStepOutput) => void;
}) {
  const form = useForm<TravelersStepInput, unknown, TravelersStepOutput>({
    resolver: zodResolver(travelersStepSchema),
    defaultValues: {
      travelers: draft.travelers.length ? draft.travelers : [emptyTraveler(userEmail)],
      emergencyContact: draft.emergencyContact ?? {
        name: "",
        relationship: "",
        phone: "",
        email: undefined,
      },
    },
    mode: "onBlur",
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "travelers" });
  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onNext)} className="space-y-10" noValidate>
      <header>
        <h1 className="text-3xl font-bold">Who&rsquo;s traveling?</h1>
        <p className="mt-2 text-muted-foreground">
          Names as they appear on passports. We only ask for what hotels and rail operators need.
        </p>
      </header>

      {fields.map((f, i) => {
        const e = errors.travelers?.[i];
        return (
          <fieldset key={f.id} className="rounded-xl border border-border bg-surface p-6">
            <legend className="px-2 font-heading text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {i === 0 ? "Lead traveler (you)" : `Traveler ${i + 1}`}
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={`t${i}-first`} label="First name" error={e?.firstName?.message}>
                <Input
                  id={`t${i}-first`}
                  autoComplete="given-name"
                  aria-invalid={!!e?.firstName}
                  {...form.register(`travelers.${i}.firstName`)}
                />
              </Field>
              <Field id={`t${i}-last`} label="Last name" error={e?.lastName?.message}>
                <Input
                  id={`t${i}-last`}
                  autoComplete="family-name"
                  aria-invalid={!!e?.lastName}
                  {...form.register(`travelers.${i}.lastName`)}
                />
              </Field>
              <Field
                id={`t${i}-preferred`}
                label="Preferred name"
                hint="What the group should call you."
                error={e?.preferredName?.message}
              >
                <Input
                  id={`t${i}-preferred`}
                  {...form.register(`travelers.${i}.preferredName`, {
                    setValueAs: (v) => (v === "" ? undefined : v),
                  })}
                />
              </Field>
              <Field id={`t${i}-email`} label="Email" error={e?.email?.message}>
                <Input
                  id={`t${i}-email`}
                  type="email"
                  autoComplete="email"
                  aria-invalid={!!e?.email}
                  {...form.register(`travelers.${i}.email`)}
                />
              </Field>
              <Field
                id={`t${i}-phone`}
                label="Mobile (optional)"
                hint="With country code, e.g. +1 415 555 0123"
                error={e?.phone?.message}
              >
                <Input
                  id={`t${i}-phone`}
                  type="tel"
                  autoComplete="tel"
                  aria-invalid={!!e?.phone}
                  {...form.register(`travelers.${i}.phone`, {
                    setValueAs: (v) => (v === "" ? undefined : String(v).replace(/[\s()-]/g, "")),
                  })}
                />
              </Field>
              <Field id={`t${i}-dob`} label="Date of birth" error={e?.dateOfBirth?.message}>
                <Input
                  id={`t${i}-dob`}
                  type="date"
                  autoComplete="bday"
                  aria-invalid={!!e?.dateOfBirth}
                  {...form.register(`travelers.${i}.dateOfBirth`)}
                />
              </Field>
              <Field
                id={`t${i}-nat`}
                label="Nationality"
                hint="Two-letter country code, e.g. US, GB, CA."
                error={e?.nationality?.message}
              >
                <Input
                  id={`t${i}-nat`}
                  maxLength={2}
                  className="uppercase"
                  aria-invalid={!!e?.nationality}
                  {...form.register(`travelers.${i}.nationality`, {
                    setValueAs: (v) => String(v).trim().toUpperCase(),
                  })}
                />
              </Field>
            </div>
            {i > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-4 text-danger"
                onClick={() => remove(i)}
              >
                <Trash2 className="h-4 w-4" aria-hidden /> Remove traveler
              </Button>
            )}
          </fieldset>
        );
      })}

      {fields.length < 8 && (
        <Button type="button" variant="secondary" onClick={() => append(emptyTraveler())}>
          <Plus className="h-4 w-4" aria-hidden /> Add another traveler
        </Button>
      )}

      <fieldset className="rounded-xl border border-border bg-surface p-6">
        <legend className="px-2 font-heading text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Emergency contact
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="ec-name" label="Name" error={errors.emergencyContact?.name?.message}>
            <Input
              id="ec-name"
              aria-invalid={!!errors.emergencyContact?.name}
              {...form.register("emergencyContact.name")}
            />
          </Field>
          <Field
            id="ec-rel"
            label="Relationship"
            error={errors.emergencyContact?.relationship?.message}
          >
            <Input
              id="ec-rel"
              placeholder="Partner, parent, friend…"
              aria-invalid={!!errors.emergencyContact?.relationship}
              {...form.register("emergencyContact.relationship")}
            />
          </Field>
          <Field
            id="ec-phone"
            label="Phone"
            hint="With country code."
            error={errors.emergencyContact?.phone?.message}
          >
            <Input
              id="ec-phone"
              type="tel"
              aria-invalid={!!errors.emergencyContact?.phone}
              {...form.register("emergencyContact.phone", {
                setValueAs: (v) => String(v).replace(/[\s()-]/g, ""),
              })}
            />
          </Field>
          <Field
            id="ec-email"
            label="Email (optional)"
            error={errors.emergencyContact?.email?.message}
          >
            <Input
              id="ec-email"
              type="email"
              {...form.register("emergencyContact.email", {
                setValueAs: (v) => (v === "" ? undefined : v),
              })}
            />
          </Field>
        </div>
      </fieldset>

      <div className="flex justify-end">
        <Button type="submit" size="lg">
          Continue <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </form>
  );
}

// ── Step 3: Preferences ──────────────────────────────────────────────────────
function PreferencesStep({
  draft,
  onBack,
  onNext,
}: {
  draft: Draft;
  onBack: () => void;
  onNext: (v: BookingPreferencesInput) => void;
}) {
  const form = useForm<PreferencesInput, unknown, BookingPreferencesInput>({
    resolver: zodResolver(bookingPreferencesSchema),
    defaultValues: draft.preferences ?? {
      roomPreference: draft.travelers.length > 1 ? "shared_double" : "single",
      airportTransfer: "group_welcome_transfer",
      optionalExperienceIds: [],
    },
  });
  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onNext)} className="space-y-8" noValidate>
      <header>
        <h1 className="text-3xl font-bold">A few preferences.</h1>
        <p className="mt-2 text-muted-foreground">
          All optional except rooms. You can change these later from your account.
        </p>
      </header>

      <div className="grid gap-5 rounded-xl border border-border bg-surface p-6 sm:grid-cols-2">
        <Field id="room" label="Room" error={errors.roomPreference?.message}>
          <Select id="room" {...form.register("roomPreference")}>
            <option value="single">Single room</option>
            <option value="shared_double">Shared — one bed</option>
            <option value="shared_twin">Shared — two beds</option>
            <option value="no_preference">No preference</option>
          </Select>
        </Field>
        <Field
          id="transfer"
          label="Arrival"
          hint="The welcome drive is included."
          error={errors.airportTransfer?.message}
        >
          <Select id="transfer" {...form.register("airportTransfer")}>
            <option value="group_welcome_transfer">Join the group welcome transfer</option>
            <option value="own_arrangement">I&rsquo;ll make my own way to the hotel</option>
          </Select>
        </Field>
        <Field
          id="diet"
          label="Dietary requirements"
          className="sm:col-span-2"
          error={errors.dietaryRequirements?.message}
        >
          <Textarea
            id="diet"
            placeholder="Vegetarian, allergies, anything a kitchen should know."
            {...form.register("dietaryRequirements", {
              setValueAs: (v) => (v === "" ? undefined : v),
            })}
          />
        </Field>
        <Field
          id="access"
          label="Accessibility"
          className="sm:col-span-2"
          hint="Stairs, walking distances, hearing or sight — tell us and we plan around it."
          error={errors.accessibilityNeeds?.message}
        >
          <Textarea
            id="access"
            {...form.register("accessibilityNeeds", {
              setValueAs: (v) => (v === "" ? undefined : v),
            })}
          />
        </Field>
      </div>

      <StepNav onBack={onBack} />
    </form>
  );
}

// ── Step 4: Account ──────────────────────────────────────────────────────────
function AccountStep({
  departureId,
  user,
  onBack,
  onNext,
}: {
  departureId: string;
  user: CheckoutUser | null;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Your account.</h1>
        <p className="mt-2 text-muted-foreground">
          Your itinerary, group chat and documents live here and in the app.
        </p>
      </header>
      {user ? (
        <div className="rounded-xl border border-aqua bg-aqua/10 p-6">
          <p className="font-semibold">Signed in{user.email ? ` as ${user.email}` : ""}.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The booking will be attached to this account.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface p-6">
          <LoginForm compact next={`/checkout/${departureId}?step=4`} initialMode="signup" />
        </div>
      )}
      <StepNav onBack={onBack} onNext={user ? onNext : undefined} nextDisabled={!user} />
    </div>
  );
}

// ── Step 5: Terms ────────────────────────────────────────────────────────────
function TermsStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [touched, setTouched] = useState(false);
  const allChecked = TERMS.every(([key]) => checked[key]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (allChecked) onNext();
      }}
      className="space-y-8"
    >
      <header>
        <h1 className="text-3xl font-bold">The important bits.</h1>
        <p className="mt-2 text-muted-foreground">
          Short, and worth reading. Terms version {brand.termsVersion}.
        </p>
      </header>
      <ul className="space-y-3 rounded-xl border border-border bg-surface p-6">
        {TERMS.map(([key, label]) => (
          <li key={key}>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-ink"
                checked={Boolean(checked[key])}
                onChange={(e) => setChecked((c) => ({ ...c, [key]: e.target.checked }))}
              />
              <span>{label}</span>
            </label>
          </li>
        ))}
      </ul>
      {touched && !allChecked && <FormError message="Please accept each item to continue." />}
      <StepNav onBack={onBack} nextLabel="Continue to payment" />
    </form>
  );
}

// ── Step 6: Payment ──────────────────────────────────────────────────────────
function PaymentStep({
  departure,
  draft,
  userSignedIn,
  onBack,
  onPaymentOption,
}: {
  departure: CheckoutDeparture;
  draft: Draft;
  userSignedIn: boolean;
  onBack: () => void;
  onPaymentOption: (o: PaymentOption) => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const money = (amount: number) =>
    formatMoney({ amount, currency: departure.currency }, { compact: true });
  const canDeposit = departure.depositAmount > 0;
  const n = draft.travelers.length;

  const options = useMemo(
    () =>
      [
        canDeposit && {
          value: "deposit" as const,
          title: `Pay the deposit — ${money(departure.depositAmount * n)}`,
          body: "Balance due before departure.",
        },
        {
          value: "full" as const,
          title: `Pay in full — ${money(departure.priceAmount * n)}`,
          body: "Nothing more to pay.",
        },
      ].filter(Boolean) as Array<{ value: PaymentOption; title: string; body: string }>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canDeposit, departure.depositAmount, departure.priceAmount, n],
  );

  function submit() {
    setError(null);
    if (!draft.emergencyContact || !draft.preferences) {
      setError("Please complete the traveler and preference steps first.");
      return;
    }
    track("begin_payment", {
      departure_id: departure.id,
      currency: departure.currency,
      travelers: n,
    });
    start(async () => {
      const result = await startCheckout({
        departureId: departure.id,
        travelers: draft.travelers,
        emergencyContact: draft.emergencyContact!,
        preferences: draft.preferences!,
        terms: {
          terms: true,
          cancellationPolicy: true,
          travelResponsibility: true,
          privacyPolicy: true,
        },
        paymentOption: draft.paymentOption,
      });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Review and pay.</h1>
        <p className="mt-2 text-muted-foreground">
          You&rsquo;ll enter card details on Stripe&rsquo;s secure page. We never see your card.
        </p>
      </header>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-medium">How would you like to pay?</legend>
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border p-4",
              draft.paymentOption === o.value
                ? "border-ink bg-surface"
                : "border-border bg-surface/60",
            )}
          >
            <input
              type="radio"
              name="paymentOption"
              className="mt-1 accent-ink"
              checked={draft.paymentOption === o.value}
              onChange={() => onPaymentOption(o.value)}
            />
            <span>
              <span className="block font-semibold">{o.title}</span>
              <span className="block text-sm text-muted-foreground">{o.body}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="rounded-xl border border-border bg-surface p-6 text-sm">
        <h2 className="font-heading text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Travelers
        </h2>
        <ul className="mt-3 space-y-1">
          {draft.travelers.map((t, i) => (
            <li key={i}>
              {t.firstName} {t.lastName}
              {t.preferredName ? ` (${t.preferredName})` : ""} · {t.email}
            </li>
          ))}
        </ul>
      </div>

      {!userSignedIn && (
        <FormError message="You need to be signed in to pay. Go back to the account step." />
      )}
      <FormError message={error ?? undefined} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back
        </Button>
        <Button type="button" size="lg" onClick={submit} disabled={pending || !userSignedIn}>
          {pending ? "Opening secure payment…" : "Continue to secure payment"}{" "}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

function StepNav({
  onBack,
  onNext,
  nextLabel = "Continue",
  nextDisabled = false,
}: {
  onBack: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Button type="button" variant="ghost" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back
      </Button>
      <Button
        type={onNext ? "button" : "submit"}
        size="lg"
        onClick={onNext}
        disabled={nextDisabled}
      >
        {nextLabel} <ArrowRight className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  );
}
