import { usePathname } from "expo-router";
import { useEffect, useRef } from "react";

import { screen } from "@/lib/analytics";

/**
 * Sends one screen view per route change to PostHog (and Firebase when built in).
 * Dynamic segments stay as-is in the pathname (e.g. /trips/abc…) — ids are not PII.
 */
export function ScreenTracker() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (!pathname || last.current === pathname) return;
    last.current = pathname;
    screen(pathname);
  }, [pathname]);
  return null;
}
