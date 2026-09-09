import { SCORE_ENDS } from "@guideless/validation";

/**
 * One scored question: five radio buttons and nothing clever. Radios are keyboard- and
 * screen-reader-navigable, they cannot be half-set, and — unlike a star widget — leaving them
 * alone is a legible answer, which matters because every score here is optional.
 */
export function ScoreScale({
  name,
  legend,
  defaultValue,
}: {
  name: string;
  legend: string;
  defaultValue?: number | null;
}) {
  return (
    <fieldset className="border-t border-border pt-4 first:border-t-0 first:pt-0">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
        <span aria-hidden className="text-xs text-muted-foreground">
          {SCORE_ENDS.low}
        </span>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="flex cursor-pointer items-center gap-1.5 text-sm">
            <input
              type="radio"
              name={name}
              value={n}
              defaultChecked={defaultValue === n}
              className="h-4 w-4 accent-teal"
              aria-label={`${legend}: ${n} out of 5`}
            />
            {n}
          </label>
        ))}
        <span aria-hidden className="text-xs text-muted-foreground">
          {SCORE_ENDS.high}
        </span>
      </div>
    </fieldset>
  );
}

/** A single-choice question whose values are stored in the survey's `answers` jsonb. */
export function ChoiceQuestion({
  name,
  legend,
  options,
  defaultValue,
}: {
  name: string;
  legend: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  defaultValue?: string | null;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="mt-2 grid gap-2">
        {options.map((o) => (
          <label key={o.value} className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="radio"
              name={name}
              value={o.value}
              defaultChecked={defaultValue === o.value}
              className="mt-0.5 h-4 w-4 accent-teal"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
