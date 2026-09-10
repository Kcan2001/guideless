"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";
import { brand } from "@guideless/config";
import { LoginForm } from "@/components/auth/login-form";
import { STEP_FORM_ID, StepNav } from "@/components/builder/step-nav";
import { TERMS } from "@/components/builder/terms";
import type { CheckoutUser } from "@/components/checkout/types";
import { FormError } from "@/components/ui/field";

function TermLabel({ label, link }: { label: string; link: readonly [string, string] | null }) {
  if (!link) return <span>{label}</span>;
  const [phrase, href] = link;
  const i = label.indexOf(phrase);
  if (i < 0) return <span>{label}</span>;
  return (
    <span>
      {label.slice(0, i)}
      <Link href={href as Route} target="_blank" rel="noopener" className="underline">
        {phrase}
      </Link>
      {label.slice(i + phrase.length)}
    </span>
  );
}

/** "Almost there." — sign in (or create the account the trip lives in) and accept the terms. */
export function ReviewStep({
  googleEnabled = false,
  title,
  user,
  loginNext,
  onBack,
  onNext,
}: {
  googleEnabled?: boolean;
  title: string;
  user: CheckoutUser | null;
  /** Where the sign-in form lands afterwards: this step of this builder. */
  loginNext: string;
  onBack: () => void;
  onNext: () => void;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [touched, setTouched] = useState(false);
  const allChecked = TERMS.every(([key]) => checked[key]);

  return (
    <form
      id={STEP_FORM_ID}
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (allChecked && user) onNext();
      }}
      className="space-y-8"
    >
      <header>
        <h2 className="text-3xl font-bold">{title}</h2>
        <p className="mt-2 text-muted-foreground">
          Your itinerary, group and documents live in your account and the app.
        </p>
      </header>

      {user ? (
        <div className="rounded-xl border border-aqua bg-aqua/10 p-6">
          <p className="font-semibold">Signed in{user.email ? ` as ${user.email}` : ""}.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The booking is attached to this account.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface p-6">
          <LoginForm compact next={loginNext} initialMode="signup" googleEnabled={googleEnabled} />
        </div>
      )}

      <ul className="space-y-3 rounded-xl border border-border bg-surface p-6">
        <li className="text-xs text-muted-foreground">Terms version {brand.termsVersion}.</li>
        {TERMS.map(([key, label, link]) => (
          <li key={key}>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-ink"
                checked={Boolean(checked[key])}
                onChange={(e) => setChecked((c) => ({ ...c, [key]: e.target.checked }))}
              />
              <TermLabel label={label} link={link} />
            </label>
          </li>
        ))}
      </ul>
      {touched && !allChecked && <FormError message="Please accept each item to continue." />}
      {touched && !user && <FormError message="Sign in or create an account to continue." />}

      <StepNav onBack={onBack} submit nextLabel="Continue to payment" nextDisabled={!user} />
    </form>
  );
}
