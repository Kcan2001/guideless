"use client";

import { useEffect } from "react";
import { track, type AnalyticsEvent, type AnalyticsParams } from "@/lib/analytics";

/** Fires one GA4 event when the page mounts. Render inside a Server Component page. */
export function TrackView({ event, params }: { event: AnalyticsEvent; params?: AnalyticsParams }) {
  useEffect(() => {
    track(event, params);
    // Params are stable per page render; re-firing on object identity changes would double count.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);
  return null;
}
