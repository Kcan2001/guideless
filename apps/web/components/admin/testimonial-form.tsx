import type { Tables } from "@guideless/types";
import { SubmitButton } from "@/components/admin/submit-button";
import { inputClass, labelClass } from "@/components/admin/ui";

type Testimonial = Tables<"testimonials">;

/**
 * Add or edit a testimonial from a trip run before Guideless.
 *
 * The consent checkbox is not a formality and the copy says so. The database refuses to publish
 * without it, so the alternative to ticking it honestly is a save that fails, not a quiet lie.
 */
export function TestimonialForm({
  action,
  testimonial,
  tours,
  submitLabel,
}: {
  action: (fd: FormData) => Promise<void>;
  testimonial?: Testimonial;
  tours: Array<{ id: string; name: string }>;
  submitLabel: string;
}) {
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {testimonial && <input type="hidden" name="testimonialId" value={testimonial.id} />}

      <label className="sm:col-span-2">
        <span className={labelClass}>What they said</span>
        <textarea
          name="quote"
          defaultValue={testimonial?.quote ?? ""}
          className={inputClass}
          rows={4}
          required
          minLength={20}
          maxLength={1200}
        />
      </label>

      <label>
        <span className={labelClass}>First name</span>
        <input
          name="authorName"
          defaultValue={testimonial?.author_name ?? ""}
          className={inputClass}
          required
          maxLength={60}
          placeholder="Dan"
        />
      </label>

      <label>
        <span className={labelClass}>Trip and year, as shown</span>
        <input
          name="tripLabel"
          defaultValue={testimonial?.trip_label ?? ""}
          className={inputClass}
          required
          maxLength={80}
          placeholder="Monaco, 2025"
        />
      </label>

      <label>
        <span className={labelClass}>Show on which tour page</span>
        <select name="tourId" defaultValue={testimonial?.tour_id ?? ""} className={inputClass}>
          <option value="">
            Not tied to a tour — saved, but shown nowhere until you attach it
          </option>
          {tours.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span className={labelClass}>Year it happened (sorting only, never shown)</span>
        <input
          name="happenedIn"
          type="number"
          defaultValue={testimonial?.happened_in ?? ""}
          className={inputClass}
          min={2000}
          max={2100}
        />
      </label>

      <label className="sm:col-span-2">
        <span className={labelClass}>
          Photo URL (optional) — must be a file in the social-media bucket
        </span>
        <input
          name="imageUrl"
          type="url"
          defaultValue={testimonial?.image_url ?? ""}
          className={inputClass}
          placeholder="https://….supabase.co/storage/v1/object/public/social-media/monaco-2025.jpg"
        />
      </label>

      <label>
        <span className={labelClass}>Order (lower shows first)</span>
        <input
          name="position"
          type="number"
          defaultValue={testimonial?.position ?? 0}
          className={inputClass}
          min={0}
          max={9999}
        />
      </label>

      <label className="sm:col-span-2">
        <span className={labelClass}>
          Where this came from — staff only, never shown to anyone outside admin
        </span>
        <textarea
          name="sourceNote"
          defaultValue={testimonial?.source_note ?? ""}
          className={inputClass}
          rows={2}
          maxLength={1000}
          placeholder="WhatsApp message, 3 Sep 2026. Monaco weekend 2025. Said yes to being quoted by name."
        />
      </label>

      <label className="flex items-start gap-3 sm:col-span-2">
        <input
          type="checkbox"
          name="consentConfirmed"
          defaultChecked={testimonial?.consent_confirmed ?? false}
          className="mt-1"
        />
        <span className="text-sm">
          <span className="font-medium">They agreed to be quoted publicly.</span>{" "}
          <span className="text-muted-foreground">
            Required before this can be published, and the database enforces it.
          </span>
        </span>
      </label>

      <label className="flex items-start gap-3 sm:col-span-2">
        <input
          type="checkbox"
          name="publish"
          defaultChecked={testimonial?.status === "published"}
          className="mt-1"
        />
        <span className="text-sm">
          <span className="font-medium">Publish it.</span>{" "}
          <span className="text-muted-foreground">Leave unticked to save a draft.</span>
        </span>
      </label>

      <div className="sm:col-span-2">
        <SubmitButton pendingText="Saving…">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
