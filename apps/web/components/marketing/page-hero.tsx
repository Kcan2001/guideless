import type { ReactNode } from "react";
import { PhotoBackdrop } from "@/components/site/photo-hero";
import { HeroScrim, heroEyebrowClass } from "@/components/site/hero-scrim";
import { cn } from "@/lib/utils";

/**
 * Editorial page opener shared by the marketing pages: a full-bleed photo with an ink scrim,
 * an eyebrow, the h1 and a one-paragraph lede. Photography carries the page; no gradients beyond
 * the scrim that keeps the text readable.
 */
export function PageHero({
  photo,
  fallbackAlt,
  eyebrow,
  title,
  lede,
  children,
  compact = false,
  position,
}: {
  photo: string;
  fallbackAlt: string;
  eyebrow: string;
  title: ReactNode;
  lede?: ReactNode;
  children?: ReactNode;
  compact?: boolean;
  position?: string;
}) {
  return (
    <section className="relative overflow-hidden bg-ink text-cloud">
      <PhotoBackdrop src={photo} fallbackAlt={fallbackAlt} priority position={position} />
      <HeroScrim />
      <div
        className={cn(
          "relative mx-auto flex w-full max-w-6xl flex-col px-6",
          compact ? "py-20 md:py-24" : "py-24 md:py-32",
        )}
      >
        <p className={cn(heroEyebrowClass, "mb-4")}>{eyebrow}</p>
        <h1 className="max-w-3xl text-4xl font-bold leading-[1.05] md:text-6xl">{title}</h1>
        {lede && <p className="mt-6 max-w-2xl text-lg leading-relaxed text-cloud/85">{lede}</p>}
        {children && <div className="mt-8 flex flex-wrap gap-4">{children}</div>}
      </div>
    </section>
  );
}

/** Uppercase eyebrow + large heading used to open every section below a hero. */
export function SectionHeading({
  eyebrow,
  title,
  lede,
  className,
  inverse = false,
}: {
  eyebrow: string;
  title: ReactNode;
  lede?: ReactNode;
  className?: string;
  inverse?: boolean;
}) {
  return (
    <div className={cn("max-w-2xl", className)}>
      <p
        className={cn(
          "text-sm font-medium uppercase tracking-[0.2em]",
          inverse ? "text-aqua" : "text-muted-foreground",
        )}
      >
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-bold md:text-5xl">{title}</h2>
      {lede && (
        <p className={cn("mt-4 text-lg", inverse ? "text-cloud/80" : "text-muted-foreground")}>
          {lede}
        </p>
      )}
    </div>
  );
}
