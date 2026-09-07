import { toLocalDate, toLocalTime } from "@guideless/utils";
import type { Tables } from "@guideless/types";
import { SubmitButton } from "@/components/admin/submit-button";
import { inputClass, labelClass } from "@/components/admin/ui";

type Meetup = Tables<"meetups">;

/** Create/edit form for a city evening. Times are entered in the meetup's own zone. */
export function MeetupForm({
  action,
  meetup,
  submitLabel,
}: {
  action: (fd: FormData) => Promise<void>;
  meetup?: Meetup;
  submitLabel: string;
}) {
  const tz = meetup?.timezone ?? "America/New_York";
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {meetup && <input type="hidden" name="meetupId" value={meetup.id} />}
      <label className="sm:col-span-2">
        <span className={labelClass}>Title</span>
        <input
          name="title"
          defaultValue={meetup?.title ?? ""}
          className={inputClass}
          required
          minLength={2}
          maxLength={120}
        />
      </label>
      <label className="sm:col-span-2">
        <span className={labelClass}>Description</span>
        <textarea
          name="description"
          defaultValue={meetup?.description ?? ""}
          className={inputClass}
          rows={3}
          maxLength={2000}
        />
      </label>
      <label>
        <span className={labelClass}>City</span>
        <input
          name="city"
          defaultValue={meetup?.city ?? ""}
          className={inputClass}
          required
          maxLength={120}
        />
      </label>
      <label>
        <span className={labelClass}>Country code</span>
        <input
          name="countryCode"
          defaultValue={meetup?.country_code ?? ""}
          className={inputClass}
          maxLength={2}
          placeholder="US"
        />
      </label>
      <label>
        <span className={labelClass}>Venue</span>
        <input
          name="venueName"
          defaultValue={meetup?.venue_name ?? ""}
          className={inputClass}
          maxLength={200}
        />
      </label>
      <label>
        <span className={labelClass}>Address</span>
        <input
          name="address"
          defaultValue={meetup?.address ?? ""}
          className={inputClass}
          maxLength={300}
        />
      </label>
      <label>
        <span className={labelClass}>Date</span>
        <input
          type="date"
          name="date"
          defaultValue={meetup ? toLocalDate(meetup.starts_at, tz) : ""}
          className={inputClass}
          required
        />
      </label>
      <label>
        <span className={labelClass}>Time zone (IANA)</span>
        <input
          name="timezone"
          defaultValue={tz}
          className={inputClass}
          required
          placeholder="America/New_York"
        />
      </label>
      <label>
        <span className={labelClass}>Starts</span>
        <input
          type="time"
          name="startTime"
          defaultValue={meetup ? toLocalTime(meetup.starts_at, tz) : "19:00"}
          className={inputClass}
          required
        />
      </label>
      <label>
        <span className={labelClass}>Ends</span>
        <input
          type="time"
          name="endTime"
          defaultValue={meetup?.ends_at ? toLocalTime(meetup.ends_at, tz) : ""}
          className={inputClass}
        />
      </label>
      <label>
        <span className={labelClass}>Capacity</span>
        <input
          type="number"
          name="capacity"
          min={0}
          max={1000}
          defaultValue={meetup?.capacity ?? ""}
          className={inputClass}
        />
      </label>
      <label className="flex items-center gap-2 self-end text-sm">
        <input
          type="checkbox"
          name="isPublished"
          defaultChecked={meetup?.is_published ?? false}
          className="accent-ink"
        />
        Published (visible on /meetups)
      </label>
      <div className="sm:col-span-2">
        <SubmitButton size="sm">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
