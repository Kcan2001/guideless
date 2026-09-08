"use client";

import { useActionState, useState } from "react";
import {
  sendMagicLink,
  signInWithGoogle,
  signInWithPassword,
  signUpWithPassword,
  type AuthState,
} from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Field, FormError, FormMessage, Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";

type Mode = "magic" | "password" | "signup";

const initial: AuthState = {};

/**
 * Sign in / create account. Magic link is the default (fewest fields); password and sign-up are
 * one tab away. `next` is where to land afterwards (e.g. back into checkout).
 */
export function LoginForm({
  next = "/account",
  compact = false,
  googleEnabled = false,
  initialMode = "magic",
}: {
  next?: string;
  /** Only render the Google button when the project actually has the provider switched on. */
  googleEnabled?: boolean;
  compact?: boolean;
  initialMode?: Mode;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [magicState, magicAction, magicPending] = useActionState(sendMagicLink, initial);
  const [pwState, pwAction, pwPending] = useActionState(signInWithPassword, initial);
  const [suState, suAction, suPending] = useActionState(signUpWithPassword, initial);

  const tabs: Array<[Mode, string]> = [
    ["magic", "Email link"],
    ["password", "Password"],
    ["signup", "Create account"],
  ];

  return (
    <div
      className={cn("space-y-6", compact ? "" : "rounded-2xl border border-border bg-surface p-8")}
    >
      <div
        role="tablist"
        aria-label="Sign-in method"
        className="flex gap-1 rounded-lg bg-sand/60 p-1"
      >
        {tabs.map(([value, label]) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={mode === value}
            onClick={() => setMode(value)}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              mode === value
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "magic" && (
        <form action={magicAction} className="space-y-4" role="tabpanel">
          <input type="hidden" name="next" value={next} />
          <Field id="magic-email" label="Email" error={magicState.fieldErrors?.email}>
            <Input
              id="magic-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
            />
          </Field>
          <FormError message={magicState.error} />
          <FormMessage message={magicState.message} />
          <Button type="submit" className="w-full" disabled={magicPending}>
            {magicPending ? "Sending…" : "Email me a sign-in link"}
          </Button>
          <p className="text-xs text-muted-foreground">
            No password to remember. The link signs you in on this device.
          </p>
        </form>
      )}

      {mode === "password" && (
        <form action={pwAction} className="space-y-4" role="tabpanel">
          <input type="hidden" name="next" value={next} />
          <Field id="pw-email" label="Email" error={pwState.fieldErrors?.email}>
            <Input id="pw-email" name="email" type="email" autoComplete="email" required />
          </Field>
          <Field id="pw-password" label="Password" error={pwState.fieldErrors?.password}>
            <Input
              id="pw-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>
          <FormError message={pwState.error} />
          <Button type="submit" className="w-full" disabled={pwPending}>
            {pwPending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      )}

      {mode === "signup" && (
        <form action={suAction} className="space-y-4" role="tabpanel">
          <input type="hidden" name="next" value={next} />
          <Field id="su-name" label="Your name" error={suState.fieldErrors?.fullName}>
            <Input id="su-name" name="fullName" autoComplete="name" required />
          </Field>
          <Field id="su-email" label="Email" error={suState.fieldErrors?.email}>
            <Input id="su-email" name="email" type="email" autoComplete="email" required />
          </Field>
          <Field
            id="su-password"
            label="Password"
            hint="At least 10 characters with letters and numbers."
            error={suState.fieldErrors?.password}
          >
            <Input
              id="su-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
            />
          </Field>
          <FormError message={suState.error} />
          <FormMessage message={suState.message} />
          <Button type="submit" className="w-full" disabled={suPending}>
            {suPending ? "Creating account…" : "Create account"}
          </Button>
        </form>
      )}

      {googleEnabled && (
        <>
          <div className="relative text-center text-xs text-muted-foreground">
            <span className="relative z-10 bg-surface px-2">or</span>
            <span aria-hidden className="absolute inset-x-0 top-1/2 -z-0 border-t border-border" />
          </div>

          <form action={signInWithGoogle}>
            <input type="hidden" name="next" value={next} />
            <Button type="submit" variant="secondary" className="w-full">
              <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4">
                <path
                  fill="#EA4335"
                  d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.1 14.6 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-1.7H12z"
                />
              </svg>
              Continue with Google
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
