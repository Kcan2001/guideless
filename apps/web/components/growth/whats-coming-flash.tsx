"use client";

import { useSearchParams } from "next/navigation";
import { FormError, FormMessage } from "@/components/ui/field";

/**
 * The "we'll tell you" confirmation after the alert form redirects back.
 *
 * Read on the client rather than from the page's searchParams on purpose: touching searchParams in
 * a server component opts the whole route out of static rendering, and /whats-coming is a public
 * page we want cached. The message only matters to the person who just submitted the form, so it
 * costs nothing to render it after hydration.
 */
export function WhatsComingFlash() {
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
