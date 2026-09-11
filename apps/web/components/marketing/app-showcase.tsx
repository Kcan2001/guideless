import Image from "next/image";
import type { AppScreen } from "@/lib/app-screens";

/**
 * "Your entire trip. In your pocket." Six slots. A slot with a real screenshot shows it at the
 * device's aspect ratio inside a plain bordered frame; a slot without one is a text card. There is
 * deliberately no drawn phone.
 */
export function AppShowcase({ screens }: { screens: AppScreen[] }) {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {screens.map((s) => (
        <li
          key={s.id}
          className="flex flex-col overflow-hidden rounded border border-cloud/15 bg-cloud/5"
        >
          {s.src && (
            <div className="relative aspect-[9/19] w-full bg-ink">
              <Image
                src={s.src}
                alt={s.alt}
                fill
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                className="object-cover object-top"
              />
            </div>
          )}
          <div className="p-5">
            <h3 className="font-heading text-lg font-semibold text-cloud">{s.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-cloud/75">{s.body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
