import { TIERS } from "@/content/tiers";
import { cn } from "@/lib/utils";

/**
 * The four public tiers explained once, as a compact strip. Shown under "Pick your base" on the
 * tour page; add-on sections refer back to it rather than repeating it.
 */
export function TierLegend({ className }: { className?: string }) {
  return (
    <dl
      className={cn(
        "grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4",
        className,
      )}
      data-testid="tier-legend"
      aria-label="What the tiers mean"
    >
      {TIERS.map((t) => (
        <div key={t.tier} className="bg-surface p-4">
          <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-ink">{t.name}</dt>
          <dd className="mt-1 text-sm text-muted-foreground">{t.definition}</dd>
        </div>
      ))}
    </dl>
  );
}
