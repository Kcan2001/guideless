import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { submitReviewAction } from "@/lib/reviews/actions";
import type { ReviewableBooking } from "@/lib/reviews/queries";

/**
 * "How was it?" — shown on the account page once a trip has ended, for that trip only. There is
 * no rating widget cleverness here: five radio buttons are keyboard- and screen-reader-friendly
 * and cannot be submitted half-set.
 */
export function ReviewForm({ booking }: { booking: ReviewableBooking }) {
  const id = booking.bookingId.slice(0, 8);
  return (
    <form
      action={submitReviewAction}
      className="rounded border border-border bg-surface p-6"
      id={`review-${id}`}
    >
      <input type="hidden" name="bookingId" value={booking.bookingId} />
      <h3 className="font-heading text-lg font-semibold">How was {booking.tourName}?</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Written by you, published once we have read it. It appears with your first name.
      </p>

      <fieldset className="mt-4">
        <legend className="mb-1.5 text-sm font-medium">Rating</legend>
        <div className="flex flex-wrap gap-4">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="flex cursor-pointer items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="rating"
                value={n}
                required
                className="h-4 w-4 accent-teal"
              />
              {n}
            </label>
          ))}
        </div>
      </fieldset>

      <Field id={`title-${id}`} label="Headline (optional)" className="mt-4">
        <Input
          id={`title-${id}`}
          name="title"
          maxLength={120}
          placeholder="What you would tell a friend in one line"
        />
      </Field>

      <Field
        id={`body-${id}`}
        label="Your review"
        hint="What worked, what did not, and who the trip would suit."
        className="mt-4"
      >
        <Textarea id={`body-${id}`} name="body" rows={5} required minLength={20} maxLength={4000} />
      </Field>

      <label className="mt-4 flex items-center gap-2 text-sm">
        <input type="checkbox" name="wouldRepeat" className="h-4 w-4 accent-teal" />I would travel
        Guideless again
      </label>

      <Button type="submit" className="mt-5">
        Send review
      </Button>
    </form>
  );
}
