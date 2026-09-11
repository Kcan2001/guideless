"use client";

import { ChevronDown } from "lucide-react";
import { track } from "@/lib/analytics";
import type { FaqItem } from "@/content/faq";

/**
 * Same calm accordion as the tour FAQ, plus one `faq_expanded` event per open (the question id,
 * never free text). Progressive: <details> works without JavaScript.
 */
export function FaqAccordion({ items }: { items: FaqItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="divide-y divide-border rounded border border-border bg-surface">
      {items.map((f) => (
        <details
          key={f.id}
          id={f.id}
          className="group scroll-mt-24 p-5 open:bg-cloud/60"
          onToggle={(e) => {
            if (e.currentTarget.open) track("faq_expanded", { question: f.id });
          }}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
            {f.question}
            <ChevronDown
              className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">{f.answer}</p>
        </details>
      ))}
    </div>
  );
}
