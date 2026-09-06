import { ChevronDown } from "lucide-react";

export function Faq({ items }: { items: Array<{ id: string; question: string; answer: string }> }) {
  if (items.length === 0) return null;
  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-surface">
      {items.map((f) => (
        <details key={f.id} className="group p-5 open:bg-cloud/60">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
            {f.question}
            <ChevronDown
              className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <p className="mt-3 max-w-3xl text-muted-foreground">{f.answer}</p>
        </details>
      ))}
    </div>
  );
}
