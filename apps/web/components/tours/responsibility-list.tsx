import { Check, Plane } from "lucide-react";
import { responsibilityLabels } from "@guideless/config";

interface Item {
  id: string;
  title: string;
  description: string | null;
}

/** The core promise, side by side: what Guideless handles vs what the traveler books. */
export function ResponsibilityList({ included, excluded }: { included: Item[]; excluded: Item[] }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="rounded-xl bg-ink p-7 text-cloud">
        <h3 className="font-heading text-lg font-semibold text-aqua">
          {responsibilityLabels.guideless}
        </h3>
        <ul className="mt-5 space-y-4">
          {included.map((i) => (
            <li key={i.id} className="flex gap-3">
              <Check className="mt-1 h-4 w-4 shrink-0 text-aqua" aria-hidden />
              <div>
                <p className="font-medium">{i.title}</p>
                {i.description && <p className="mt-0.5 text-sm text-cloud/70">{i.description}</p>}
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-xl border border-border bg-surface p-7">
        <h3 className="font-heading text-lg font-semibold">{responsibilityLabels.traveler}</h3>
        <ul className="mt-5 space-y-4">
          {excluded.map((i) => (
            <li key={i.id} className="flex gap-3">
              <Plane className="mt-1 h-4 w-4 shrink-0 text-link" aria-hidden />
              <div>
                <p className="font-medium">{i.title}</p>
                {i.description && (
                  <p className="mt-0.5 text-sm text-muted-foreground">{i.description}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
