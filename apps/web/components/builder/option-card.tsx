"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { Check, Minus } from "lucide-react";
import type { OptionLabel, OptionTier } from "@guideless/types";
import { OptionLabelBadge, TierBadge } from "@/components/tours/option-label";
import { photoAlt, photoPosition } from "@/lib/photos";
import { cn } from "@/lib/utils";

/**
 * A selectable option (stay tier, race view, experience, transfer). Same information as the
 * tour-page cards, but it is a control: navy border and an aqua check when chosen. The `control`
 * slot carries the actual input(s) so the card stays accessible whatever the selection model.
 */
export function OptionCard({
  id,
  title,
  eyebrow,
  tier,
  label,
  image,
  imageAlt,
  price,
  priceNote,
  status,
  facts,
  description,
  includes,
  excludes,
  whyPriceNote,
  footnote,
  selected,
  disabled = false,
  control,
  children,
}: {
  id: string;
  title: string;
  eyebrow?: string | null;
  tier?: OptionTier | null;
  label?: OptionLabel | null;
  image?: string | null;
  imageAlt?: string;
  price: string;
  priceNote?: string | null;
  /** Small right-aligned status: "3 left", "Sold out", "Sales closed". */
  status?: ReactNode;
  facts?: Array<{
    icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
    text: string;
  }>;
  description?: string | null;
  includes?: readonly string[];
  excludes?: readonly string[];
  whyPriceNote?: string | null;
  footnote?: ReactNode;
  selected: boolean;
  disabled?: boolean;
  /** The input(s): a radio, a checkbox, traveler chips or a quantity select. */
  control: ReactNode;
  children?: ReactNode;
}) {
  const titleId = `opt-${id}-title`;
  return (
    <article
      aria-labelledby={titleId}
      data-selected={selected || undefined}
      className={cn(
        "relative flex flex-col overflow-hidden rounded-xl border bg-surface transition-colors",
        selected ? "border-ink ring-1 ring-ink" : "border-border",
        disabled && "opacity-60",
      )}
    >
      {selected && (
        <span
          aria-hidden
          className="absolute right-4 top-4 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full bg-aqua text-ink shadow-sm"
        >
          <Check className="h-4 w-4" strokeWidth={3} />
        </span>
      )}
      {image && (
        <div className="relative aspect-[16/9] overflow-hidden bg-sand">
          <Image
            src={image}
            alt={photoAlt(image, imageAlt ?? title)}
            fill
            sizes="(min-width: 1024px) 440px, 100vw"
            className="object-cover"
            style={{ objectPosition: photoPosition(image) }}
          />
          {(tier || label) && (
            <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2">
              <TierBadge tier={tier ?? null} />
              <OptionLabelBadge label={label ?? null} />
            </div>
          )}
        </div>
      )}
      <div className="flex flex-1 flex-col gap-4 p-5 md:p-6">
        <div className={cn(selected && !image && "pr-9")}>
          <p className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {!image && <TierBadge tier={tier ?? null} />}
            {eyebrow}
            {!image && <OptionLabelBadge label={label ?? null} />}
          </p>
          <h3 id={titleId} className="mt-1.5 font-heading text-xl font-bold">
            {title}
          </h3>
        </div>

        <p className="flex flex-wrap items-baseline justify-between gap-2 border-y border-border py-3">
          <span className="font-heading text-lg font-bold">
            {price}
            {priceNote && (
              <span className="ml-1 text-sm font-normal text-muted-foreground">{priceNote}</span>
            )}
          </span>
          {status}
        </p>

        {facts && facts.length > 0 && (
          <ul className="space-y-1.5 text-sm">
            {facts.map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                <f.icon className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
                <span>{f.text}</span>
              </li>
            ))}
          </ul>
        )}

        {description && <p className="text-sm text-muted-foreground">{description}</p>}

        {((includes?.length ?? 0) > 0 || (excludes?.length ?? 0) > 0) && (
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            {includes && includes.length > 0 && (
              <ul className="space-y-1">
                {includes.map((line) => (
                  <li key={line} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            )}
            {excludes && excludes.length > 0 && (
              <ul className="space-y-1 text-muted-foreground">
                {excludes.map((line) => (
                  <li key={line} className="flex gap-2">
                    <Minus className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {whyPriceNote && (
          <p className="rounded-lg bg-cloud p-3 text-sm">
            <span className="font-semibold">Why this price. </span>
            {whyPriceNote}
          </p>
        )}

        {children}

        <div className="mt-auto border-t border-border pt-4">{control}</div>
        {footnote && <p className="text-xs text-muted-foreground">{footnote}</p>}
      </div>
    </article>
  );
}
