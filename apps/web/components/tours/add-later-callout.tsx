import { Sparkles } from "lucide-react";

/** The reassurance that turns "not sure yet" into a booking. Same text on the trip page and later in the builder. */
export function AddLaterCallout() {
  return (
    <aside
      className="rounded-2xl border border-aqua bg-aqua/10 p-6 md:p-8"
      aria-labelledby="add-later-heading"
      data-testid="add-later"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Not sure yet?
      </p>
      <h3
        id="add-later-heading"
        className="mt-1 flex items-center gap-2 font-heading text-2xl font-semibold"
      >
        <Sparkles className="h-5 w-5 text-teal" aria-hidden /> That&rsquo;s fine.
      </h3>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Reserve your trip now and add experiences later from your account or the Guideless app,
        subject to availability. Each add-on shows its own booking deadline and cancellation window.
      </p>
    </aside>
  );
}
