"use client";

import { useSearchParams } from "next/navigation";
import { FormError, FormMessage } from "@/components/ui/field";

/**
 * The thank-you after the form redirects back. Read on the client so the page itself stays static
 * — the same reason /whats-coming does it this way.
 */
export function ShareFlash() {
  const params = useSearchParams();
  const notice = params.get("notice");
  const error = params.get("error_msg");
  if (!notice && !error) return null;
  return (
    <div className="mt-8">
      <FormMessage message={notice ?? undefined} />
      <FormError message={error ?? undefined} />
    </div>
  );
}
