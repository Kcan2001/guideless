import { ExternalLink, Ticket } from "lucide-react";
import { formatDate } from "@guideless/utils";
import { Badge } from "@/components/ui/badge";
import { fulfilmentMessage, type MyFulfilment } from "@/lib/experiences/fulfilments";

/**
 * Experiences we bought in on the traveler's behalf.
 *
 * The whole point of this block is that it does not pretend. A ticket run by somebody else says who
 * runs it, links their terms — because those are the terms that actually govern it — and offers the
 * operator's own page for anyone who would rather deal with them directly.
 *
 * That is a deliberate product choice rather than a disclosure minimum: a traveler who discovers on
 * the day that "their" Guideless experience is a Viator booking has been mildly misled, and the
 * cost of avoiding that is one sentence.
 */
export function BookedExperiences({ fulfilments }: { fulfilments: MyFulfilment[] }) {
  if (fulfilments.length === 0) return null;

  return (
    <section className="mt-12" id="booked-experiences">
      <h2 className="text-xl font-semibold">Experiences we booked for you</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Bought through our partners and run by them. You paid us; we booked it in your name.
      </p>

      <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-surface">
        {fulfilments.map((f) => (
          <li key={f.id} className="p-5">
            <div className="flex flex-wrap items-center gap-3">
              <Ticket className="h-4 w-4 text-teal" aria-hidden />
              <p className="font-medium">{f.title}</p>
              {f.operatedBy && <Badge variant="neutral">Operated by {f.operatedBy}</Badge>}
              {f.status === "pending" && <Badge variant="warning">booking it now</Badge>}
              {f.status === "booked" && <Badge variant="included">booked</Badge>}
              {f.status === "failed" && <Badge variant="danger">couldn&rsquo;t be booked</Badge>}
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              {formatDate(f.travelDate)} · {f.travelers} {f.travelers === 1 ? "person" : "people"}
            </p>

            <p className="mt-2 text-sm">{fulfilmentMessage(f)}</p>
            {f.instructions && (
              <p className="mt-1 text-sm text-muted-foreground">{f.instructions}</p>
            )}

            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
              {f.voucherUrl && (
                <a href={f.voucherUrl} className="text-link" target="_blank" rel="noreferrer">
                  Your voucher
                </a>
              )}
              {f.termsUrl && (
                <a href={f.termsUrl} className="text-link" target="_blank" rel="noreferrer">
                  {f.operatedBy ? `${f.operatedBy}'s terms` : "Operator terms"} — including
                  cancellation
                </a>
              )}
              {f.bookingUrl && (
                <a
                  href={f.bookingUrl}
                  className="inline-flex items-center gap-1 text-link"
                  target="_blank"
                  rel="noreferrer"
                >
                  See it on {f.operatedBy ?? "the operator"}
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-muted-foreground">
        Cancellations on these follow the operator&rsquo;s own terms rather than your trip&rsquo;s.
        Ask us and we&rsquo;ll handle it, or deal with them directly — whichever you prefer.
      </p>
    </section>
  );
}
