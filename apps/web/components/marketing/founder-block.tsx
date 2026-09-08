import { Check } from "lucide-react";
import { founder, operatingPrinciples } from "@/content/founder";
import { PhotoBackdrop } from "@/components/site/photo-hero";
import { sitePhotos } from "@/lib/photos";

/**
 * Trust without testimonials: who runs Guideless and how it operates. Pairs the founder's words
 * with a destination photo because no portrait exists yet; never a placeholder avatar.
 */
export function FounderBlock({ showPrinciples = true }: { showPrinciples?: boolean }) {
  return (
    <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-start">
      <figure className="relative aspect-[4/5] overflow-hidden rounded-2xl lg:aspect-auto lg:min-h-[520px]">
        <PhotoBackdrop
          src={sitePhotos.founder}
          fallbackAlt="Oak barrels in a stone cellar at Châteauneuf-du-Pape"
          sizes="(min-width: 1024px) 50vw, 100vw"
        />
        <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/80 to-transparent p-6 text-sm text-cloud/90">
          Châteauneuf-du-Pape, on the Avignon wine day.
        </figcaption>
      </figure>
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          From the founder
        </p>
        <div className="mt-4 space-y-4 text-lg leading-relaxed text-foreground/90">
          {founder.paragraphs.map((p) => (
            <p key={p.slice(0, 24)}>{p}</p>
          ))}
        </div>
        <p className="mt-6 font-heading text-lg font-semibold">
          {founder.name}
          <span className="block text-sm font-normal text-muted-foreground">
            {founder.role} · {founder.location}
          </span>
        </p>
        {showPrinciples && (
          <ul className="mt-10 grid gap-4 sm:grid-cols-2">
            {operatingPrinciples.map((p) => (
              <li key={p.title} className="flex gap-3">
                <Check className="mt-1 h-4 w-4 shrink-0 text-teal" aria-hidden />
                <span>
                  <span className="font-semibold">{p.title}</span>{" "}
                  <span className="text-muted-foreground">{p.body}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
