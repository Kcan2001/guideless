import Image from "next/image";
import type { Testimonial } from "@/lib/testimonials/queries";

/**
 * Quotes from earlier trips, kept visually distinct from reviews and never carrying a star.
 *
 * The heading says "past Monaco weekends" rather than "Guideless travelers" on purpose: nothing
 * here should read as a review of a trip booked through us, because none of them were. The quotes
 * themselves are unattributed beyond a first name and a year, which is Kyle's call — so the
 * heading is where the honesty lives, and it should not be softened into implying otherwise.
 *
 * Renders nothing when there is nothing, like every other empty state on the marketing pages.
 */
export function TestimonialStrip({
  testimonials,
  heading,
  title,
}: {
  testimonials: Testimonial[];
  heading: string;
  title: string;
}) {
  if (testimonials.length === 0) return null;

  return (
    <section id="testimonials" className="border-t border-border">
      <div className="mx-auto w-full max-w-6xl px-6 py-20">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {heading}
        </p>
        <h2 className="mt-3 max-w-2xl font-heading text-3xl font-bold">{title}</h2>

        <ul className="mt-10 grid gap-6 md:grid-cols-2">
          {testimonials.map((t) => (
            <li
              key={t.id}
              className="flex flex-col gap-4 rounded border border-border bg-surface p-6"
            >
              {t.imageUrl && (
                <Image
                  src={t.imageUrl}
                  alt=""
                  width={640}
                  height={360}
                  className="h-44 w-full rounded object-cover"
                />
              )}
              <blockquote className="text-lg leading-relaxed">&ldquo;{t.quote}&rdquo;</blockquote>
              <p className="mt-auto text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{t.authorName}</span> · {t.tripLabel}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
