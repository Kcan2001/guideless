import Image from "next/image";
import { photoAlt, photoPosition } from "@/lib/photos";
import { cn } from "@/lib/utils";

/**
 * A calm grid of trip photographs: the first image large, the rest as tiles. Server component;
 * images are lazy and sized for their slot. Nothing to click yet (no lightbox) so keyboard users
 * lose nothing.
 */
export function PhotoGallery({
  images,
  subject,
  className,
}: {
  images: string[];
  /** Used in alt text for uploads without manifest entries, e.g. the tour name. */
  subject: string;
  className?: string;
}) {
  const urls = images.filter(Boolean).slice(0, 10);
  if (urls.length === 0) return null;
  const [lead, ...rest] = urls;
  return (
    <div className={cn("grid gap-3 sm:grid-cols-3", className)}>
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl sm:col-span-1 sm:row-span-2">
        <Image
          src={lead!}
          alt={photoAlt(lead, subject)}
          fill
          sizes="(min-width: 1024px) 380px, (min-width: 640px) 33vw, 100vw"
          className="object-cover"
          style={{ objectPosition: photoPosition(lead) }}
        />
      </div>
      <ul className="contents">
        {rest.map((src, i) => (
          <li key={src} className="relative aspect-[4/3] overflow-hidden rounded-xl">
            <Image
              src={src}
              alt={photoAlt(src, `${subject}, photo ${i + 2}`)}
              fill
              sizes="(min-width: 1024px) 380px, (min-width: 640px) 33vw, 100vw"
              className="object-cover"
              style={{ objectPosition: photoPosition(src) }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
