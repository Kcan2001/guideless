"use client";

import { useEffect } from "react";

/** Drops the sessionStorage draft once a booking exists so a later visit starts fresh. */
export function ClearDraft({ departureId }: { departureId: string }) {
  useEffect(() => {
    try {
      sessionStorage.removeItem(`guideless:checkout:${departureId}`);
    } catch {
      /* storage unavailable */
    }
  }, [departureId]);
  return null;
}
