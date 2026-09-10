"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A full-page detail sheet behind a trigger.
 *
 * Built on the native <dialog> rather than a library: `showModal()` gives us the focus trap, the
 * Escape key, inertness of the page behind and the top layer for nothing, which is most of what a
 * modal library sells. We add the two things it does not do — closing on a backdrop click, and
 * restoring page scroll — and stop there.
 *
 * Exists because the tier cards were carrying a hotel's whole profile inline: three paragraphs, two
 * lists and an amenity set per card, three across. The card should say enough to choose between
 * tiers; everything else belongs one click away.
 */
export function DetailModal({
  trigger,
  title,
  subtitle,
  children,
  className,
}: {
  /** Label for the button that opens it. */
  trigger: React.ReactNode;
  title: string;
  subtitle?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  // The page behind must not scroll under the sheet.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "text-sm font-medium underline underline-offset-4 transition-colors hover:text-ink",
          className,
        )}
      >
        {trigger}
      </button>

      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        // The backdrop is the dialog's own box outside its content, so a click that lands on the
        // element itself rather than a child is a backdrop click.
        onClick={(e) => {
          if (e.target === ref.current) setOpen(false);
        }}
        className="m-auto max-h-[88vh] w-[min(52rem,92vw)] overflow-hidden rounded-2xl border border-border bg-surface p-0 text-ink backdrop:bg-ink/50"
      >
        {open && (
          <div className="flex max-h-[88vh] flex-col">
            <header className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
              <div className="min-w-0">
                <h2 className="font-heading text-xl font-bold">{title}</h2>
                {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border transition-colors hover:bg-cloud"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </header>
            <div className="flex flex-col gap-5 overflow-y-auto px-6 py-5">{children}</div>
          </div>
        )}
      </dialog>
    </>
  );
}
