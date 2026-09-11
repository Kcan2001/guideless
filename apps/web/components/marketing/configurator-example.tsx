import type { Route } from "next";
import { ArrowRight } from "lucide-react";
import { formatDateRange, formatMoney } from "@guideless/utils";
import { CtaLink } from "@/components/analytics/cta-link";
import { buttonVariants } from "@/components/ui/button";
import type { ConfiguratorExample } from "@/lib/data/configurator";
import { cn } from "@/lib/utils";

/**
 * A worked example of one traveler's configuration, priced by the database. Reads like the
 * builder's summary panel: what is included, what they chose, the total and the deposit.
 */
export function ConfiguratorExampleCard({ example }: { example: ConfiguratorExample }) {
  const money = (amount: number) =>
    formatMoney({ amount, currency: example.currency }, { compact: true });
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Show, don&rsquo;t tell
        </p>
        <h2 className="mt-3 text-3xl font-bold md:text-5xl">Start with a trip. Make it yours.</h2>
        <p className="mt-4 max-w-lg text-lg text-muted-foreground">
          Every trip starts with the essentials handled. Then you choose where you stay, how you
          watch, what you join. The price updates as you go, and these numbers are the real ones.
        </p>
        <CtaLink
          href={`/tours/${example.tourSlug}/build` as Route}
          pendingLabel="Opening…"
          placement="home_configurator"
          className={cn(buttonVariants({ size: "lg" }), "mt-8")}
        >
          Build this trip <ArrowRight className="h-4 w-4" aria-hidden />
        </CtaLink>
      </div>

      <div
        className="rounded border border-border bg-surface p-6 md:p-8"
        data-testid="configurator-example"
      >
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          {example.tourName}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatDateRange(example.startDate, example.endDate)} · one traveler
        </p>
        <dl className="mt-6 divide-y divide-border text-sm">
          <Row label={example.base.title} value={money(example.base.amount)} strong />
          {example.stay && (
            <Row
              label={example.stay.title}
              value={example.stay.included ? "Included" : `+${money(example.stay.amount)}`}
            />
          )}
          <Row label="Welcome drinks · train pass · app & support" value="Included" />
          {example.choices.map((c) => (
            <Row key={c.title} label={c.title} value={`+${money(c.amount)}`} />
          ))}
        </dl>
        <div className="mt-6 flex items-end justify-between border-t border-border-strong pt-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total</p>
            <p className="font-heading text-3xl font-bold">{money(example.total)}</p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p>
              Due today{" "}
              <span className="font-semibold text-foreground">{money(example.dueNow)}</span>
            </p>
            <p>
              {money(example.deposit)} deposit + extras · {money(example.balance)} before departure
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className={strong ? "font-semibold" : "text-foreground/90"}>{label}</dt>
      <dd className={cn("tabular-nums", strong ? "font-semibold" : "text-muted-foreground")}>
        {value}
      </dd>
    </div>
  );
}
