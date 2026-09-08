"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Users } from "lucide-react";
import { groupCodeSchema } from "@guideless/validation";
import { Field, Input } from "@/components/ui/field";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/analytics";

interface CheckResult {
  valid: boolean;
  reason: "not_found" | "wrong_departure" | "expired" | "full" | null;
  owner_first_name: string | null;
  joined: number;
}

const REASON_COPY: Record<NonNullable<CheckResult["reason"]>, string> = {
  not_found: "We don’t recognise that code.",
  wrong_departure: "That code is for different dates. Pick your friend’s departure first.",
  expired: "That code has expired.",
  full: "That group is full.",
};

/**
 * "Traveling with friends?" — a friend's trip code puts this booking in their group on the same
 * departure, with its own money. Validated live through `check_group_code`.
 */
export function GroupCodeField({
  departureId,
  value,
  onChange,
}: {
  departureId: string;
  value: string | null;
  onChange: (code: string | null) => void;
}) {
  const [text, setText] = useState(value ?? "");
  const [result, setResult] = useState<CheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const seq = useRef(0);

  function handleChange(next: string) {
    const upper = next.toUpperCase();
    setText(upper);
    setResult(null);
    if (!upper.trim() && value) onChange(null);
  }

  useEffect(() => {
    const code = text.trim();
    if (!code || !groupCodeSchema.safeParse(code).success) return;
    const mine = ++seq.current;
    const timer = setTimeout(async () => {
      setChecking(true);
      const { data, error } = await createClient().rpc("check_group_code", {
        p_code: code,
        p_departure_id: departureId,
      });
      if (seq.current !== mine) return;
      setChecking(false);
      if (error) {
        console.error("check_group_code failed", { code: error.code, message: error.message });
        return;
      }
      const checked = data as unknown as CheckResult | null;
      setResult(checked);
      track("group_code_entered", { departure_id: departureId, valid: Boolean(checked?.valid) });
      onChange(checked?.valid ? code : null);
    }, 450);
    return () => clearTimeout(timer);
    // Only the typed code and the departure matter; `onChange` is applied inside the check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, departureId]);

  return (
    <fieldset className="rounded-xl border border-border bg-surface p-6">
      <legend className="px-2 font-heading text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Traveling with friends?
      </legend>
      <p className="text-sm text-muted-foreground">
        Enter their trip code to join their group. You still book and pay separately.
      </p>
      <div className="mt-4 max-w-sm">
        <Field id="group-code" label="Trip code">
          <Input
            id="group-code"
            value={text}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="KYLE-MONACO-27"
            autoComplete="off"
            spellCheck={false}
            aria-describedby="group-code-status"
          />
        </Field>
      </div>
      <p id="group-code-status" className="mt-2 min-h-5 text-sm" aria-live="polite">
        {checking ? (
          <span className="text-muted-foreground">Checking…</span>
        ) : result?.valid ? (
          <span className="inline-flex items-center gap-1.5 text-link">
            <Check className="h-4 w-4" aria-hidden />
            Joins {result.owner_first_name ? `${result.owner_first_name}’s` : "the"} group
            {result.joined > 0 && (
              <>
                {" "}
                · <Users className="h-3.5 w-3.5" aria-hidden /> {result.joined} already in
              </>
            )}
          </span>
        ) : result && result.reason ? (
          <span className="text-danger">{REASON_COPY[result.reason]}</span>
        ) : null}
      </p>
    </fieldset>
  );
}
