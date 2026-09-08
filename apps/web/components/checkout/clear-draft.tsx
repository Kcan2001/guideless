"use client";

import { useEffect } from "react";
import { clearSessionDraft } from "@/components/builder/draft";
import { clearBuilderDraft } from "@/lib/bookings/drafts";

/** Once a booking exists, drop the local and saved builder drafts so a later visit starts fresh. */
export function ClearDraft({ departureId }: { departureId: string }) {
  useEffect(() => {
    clearSessionDraft(departureId);
    void clearBuilderDraft(departureId);
  }, [departureId]);
  return null;
}
