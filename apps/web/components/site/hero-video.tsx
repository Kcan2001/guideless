"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A silent, looping video behind the home hero, with the hero photograph as its poster.
 *
 * The rules it has to respect, in order of how badly each one bites:
 *
 *   1. **The poster is the LCP, not the video.** The photograph is still rendered underneath by
 *      `PhotoBackdrop` with `priority`, so the largest paint happens on an image Next has already
 *      optimised and preloaded. The video fades in on top once it can actually play. Nobody waits
 *      on a download to see the headline.
 *   2. **`prefers-reduced-motion` means no motion.** Not "muted autoplay is fine because it has no
 *      sound" — a moving background is exactly what that setting is for. The photograph stays.
 *   3. **Failure is silent.** A 404, a codec the browser will not take, a blocked autoplay policy:
 *      all of them leave the photograph in place, which is a perfectly good hero.
 *   4. **No sound, ever.** `muted` plus no audio track at all in the encode.
 *
 * Deliberately not a `<source>`-only affair: `canplay` is what tells us the thing is really going
 * to render, and an `onError` that never fires is how a broken video turns into a black rectangle.
 */
export function HeroVideo({
  webm,
  mp4,
  className,
}: {
  webm: string;
  mp4: string;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Reduced motion is handled in CSS (`.hero-video` is display:none under that media query) and
    // here only by declining to start playback. Deliberately not `setFailed(true)`: setting state
    // synchronously inside an effect triggers a second render pass before paint, and React lints
    // against it for good reason. Nothing needs to re-render — the element is already hidden.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Autoplay can be refused (low power mode, a browser policy, a user setting). That is not an
    // error worth surfacing — it just means the poster stays, which is the designed fallback.
    // This one IS safe: the rejection lands in a microtask, not during the effect.
    void el.play().catch(() => setFailed(true));
  }, []);

  if (failed) return null;

  return (
    <video
      ref={ref}
      className={cn("hero-video", className)}
      // The poster is the same photograph rendered underneath, so there is no flash of a different
      // image between the two — the video simply resolves into focus over its own still.
      muted
      loop
      playsInline
      preload="metadata"
      aria-hidden
      tabIndex={-1}
      onCanPlay={() => setReady(true)}
      onError={() => setFailed(true)}
      style={{ opacity: ready ? 1 : 0, transition: "opacity 900ms ease" }}
    >
      <source src={webm} type="video/webm" />
      <source src={mp4} type="video/mp4" />
    </video>
  );
}
