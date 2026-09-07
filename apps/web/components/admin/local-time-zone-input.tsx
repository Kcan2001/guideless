"use client";

import { useEffect, useRef } from "react";
import { inputClass } from "@/components/admin/ui";

/**
 * Time-zone field for scheduling forms. Server-renders a sensible default so the form works
 * without JavaScript; on the client it switches to the staff member's own zone once (DOM update,
 * uncontrolled input — no re-render).
 */
export function LocalTimeZoneInput({
  name = "timeZone",
  fallback = "America/New_York",
}: {
  name?: string;
  fallback?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz && ref.current && ref.current.value === fallback) ref.current.value = tz;
    } catch {
      // keep fallback
    }
  }, [fallback]);
  return (
    <input
      ref={ref}
      name={name}
      defaultValue={fallback}
      className={inputClass}
      aria-label="Time zone (IANA)"
      list="common-time-zones"
      required
    />
  );
}
