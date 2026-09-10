"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The property's own photographs, one at a time.
 *
 * These come from the supplier's image host, not our repo — they are the hotel's current
 * photography and change when the hotel changes it. Before this existed every tier card showed the
 * same stock street scene, so Explorer and Classic were identical pictures of somewhere neither
 * hotel is.
 *
 * Deliberately simple: no autoplay, no library. A carousel that moves on its own is a carousel
 * people fight. Arrows and dots only, both keyboard reachable, and the whole thing is inert when
 * there is a single frame.
 */
export function HotelCarousel({
  images,
  alt,
  className,
  sizes = "(min-width: 1024px) 33vw, 100vw",
  priority = false,
}: {
  images: readonly string[];
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const [i, setI] = useState(0);
  if (images.length === 0) return null;

  const count = images.length;
  const go = (next: number) => setI((next + count) % count);

  return (
    <div className={cn("group/car relative overflow-hidden bg-muted", className)}>
      {/* Only the active frame is rendered: ten hotels' worth of eager images would be the heaviest
          thing on the page, and the ones behind it are never seen. */}
      <Image
        key={images[i]}
        src={images[i]!}
        alt={count > 1 ? `${alt} — photo ${i + 1} of ${count}` : alt}
        fill
        sizes={sizes}
        priority={priority && i === 0}
        className="object-cover"
      />

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(i - 1)}
            aria-label="Previous photo"
            className="absolute left-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-surface/85 text-ink opacity-0 shadow transition-opacity focus-visible:opacity-100 group-hover/car:opacity-100"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => go(i + 1)}
            aria-label="Next photo"
            className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-surface/85 text-ink opacity-0 shadow transition-opacity focus-visible:opacity-100 group-hover/car:opacity-100"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center gap-1.5 bg-gradient-to-t from-black/45 to-transparent p-2.5">
            {images.map((src, n) => (
              <span
                key={src}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  n === i ? "w-4 bg-white" : "w-1.5 bg-white/55",
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
