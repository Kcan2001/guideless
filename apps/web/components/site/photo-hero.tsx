import Image from "next/image";
import { RouteArt } from "@/components/site/route-art";
import { photoAlt, photoPosition } from "@/lib/photos";
import { cn } from "@/lib/utils";

/**
 * Full-bleed photo behind a hero or card. Falls back to the route artwork when no photo is set,
 * so pages authored before photography exist still render. Alt text comes from the photo manifest
 * for library photos and from `fallbackAlt` (usually the tour or place name) for uploads.
 */
export function PhotoBackdrop({
  src,
  fallbackAlt,
  stops = 3,
  tone,
  priority = false,
  sizes = "100vw",
  className,
  imgClassName,
  position,
}: {
  src: string | null | undefined;
  fallbackAlt: string;
  stops?: number;
  tone?: "ink" | "sand";
  priority?: boolean;
  sizes?: string;
  className?: string;
  imgClassName?: string;
  /** CSS object-position override; defaults to the photo's focal point from the manifest. */
  position?: string;
}) {
  if (!src) {
    return (
      <div className={cn("absolute inset-0", className)}>
        <RouteArt stops={stops} tone={tone} className={imgClassName} />
      </div>
    );
  }
  return (
    <div className={cn("absolute inset-0", className)}>
      <Image
        src={src}
        alt={photoAlt(src, fallbackAlt)}
        fill
        priority={priority}
        sizes={sizes}
        quality={78}
        className={cn("object-cover", imgClassName)}
        style={{ objectPosition: position ?? photoPosition(src) }}
      />
    </div>
  );
}
