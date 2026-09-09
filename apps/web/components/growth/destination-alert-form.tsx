import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { createDestinationAlertAction } from "@/lib/growth/saved-actions";

/**
 * "Tell me when you go there" — and, more usefully, "please go here".
 *
 * No account required, on purpose: the person worth reaching is the one who read a tour page, liked
 * the idea and left. Asking them to sign up first is asking them to do the hard thing before the
 * easy one.
 *
 * The free-text field is not a fallback for a missing dropdown option. It is the point: a company
 * running two trips and deciding on a third should be reading what people asked for rather than
 * guessing, and this is the only place that gets written down.
 */
export function DestinationAlertForm({
  destinations,
  returnTo,
  source,
  defaultDestinationId,
}: {
  destinations: Array<{ id: string; name: string; country_name: string }>;
  returnTo: string;
  source: string;
  defaultDestinationId?: string;
}) {
  return (
    <form action={createDestinationAlertAction} className="grid gap-4">
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="source" value={source} />

      <Field id="alert-email" label="Your email">
        <Input
          id="alert-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
        />
      </Field>

      {destinations.length > 0 && (
        <Field id="alert-destination" label="Somewhere we already go">
          <Select
            id="alert-destination"
            name="destinationId"
            defaultValue={defaultDestinationId ?? ""}
          >
            <option value="">Choose a destination…</option>
            {destinations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}, {d.country_name}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Field
        id="alert-wanted"
        label="Or somewhere you wish we went"
        hint="One or the other, not both. This is genuinely how we pick where to go next."
      >
        <Input
          id="alert-wanted"
          name="wantedPlace"
          maxLength={120}
          placeholder="Lisbon, Japan, the Dolomites…"
        />
      </Field>

      <Field id="alert-note" label="Anything else (optional)">
        <Textarea
          id="alert-note"
          name="note"
          rows={2}
          maxLength={500}
          placeholder="Would come for a long weekend, ideally spring."
        />
      </Field>

      <div>
        <Button type="submit">Tell me when</Button>
        <p className="mt-2 text-xs text-muted-foreground">
          One email when there&rsquo;s something to say, and nothing else. Stop any time.
        </p>
      </div>
    </form>
  );
}
