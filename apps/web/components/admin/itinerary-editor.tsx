import { ITINERARY_ITEM_STATUSES, ITINERARY_ITEM_TYPES, VISIBILITIES } from "@guideless/types";
import type { Tables } from "@guideless/types";
import { formatWallTime } from "@guideless/utils";
import { SubmitButton } from "@/components/admin/submit-button";
import { inputClass, labelClass } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Fields shared by tour_itinerary_items (template) and trip_itinerary_items (live). */
export interface EditorItem {
  id: string;
  position: number;
  type: Tables<"tour_itinerary_items">["type"];
  title: string;
  description: string | null;
  start_time: string | null;
  end_time: string | null;
  timezone: string;
  location_name: string | null;
  address: string | null;
  instructions: string | null;
  responsibility: Tables<"tour_itinerary_items">["responsibility"];
  is_optional: boolean;
  visibility: Tables<"tour_itinerary_items">["visibility"];
  status?: Tables<"trip_itinerary_items">["status"];
}

export interface EditorDay {
  id: string;
  day_number: number;
  title: string;
  summary: string | null;
  destination: { id: string; name: string } | null;
  date?: string;
  items: EditorItem[];
}

type Action = (fd: FormData) => Promise<void>;

interface Props {
  scope: "tour" | "trip";
  /** Hidden ids every form posts back. */
  hidden: Record<string, string>;
  days: EditorDay[];
  destinations: Array<{ id: string; name: string; timezone: string }>;
  defaultTimezone: string;
  locked?: boolean;
  actions: {
    addDay?: Action;
    updateDay?: Action;
    deleteDay?: Action;
    addItem: Action;
    updateItem: Action;
    deleteItem: Action;
  };
}

export function ItineraryEditor({
  scope,
  hidden,
  days,
  destinations,
  defaultTimezone,
  locked = false,
  actions,
}: Props) {
  const hiddenInputs = Object.entries(hidden).map(([k, v]) => (
    <input key={k} type="hidden" name={k} value={v} />
  ));
  const nextDay = Math.max(0, ...days.map((d) => d.day_number)) + 1;

  return (
    <div className="space-y-6">
      {days.length === 0 && (
        <p className="text-sm text-muted-foreground">No days yet. Add the first day below.</p>
      )}

      {days.map((day) => (
        <article
          key={day.id}
          id={`day-${day.id}`}
          className="scroll-mt-6 rounded-xl border border-border"
        >
          <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-cloud/60 px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-link">
                Day {day.day_number}
                {day.date ? ` · ${day.date}` : ""}
                {day.destination ? ` · ${day.destination.name}` : ""}
              </p>
              <h3 className="text-lg font-semibold">{day.title}</h3>
              {day.summary && <p className="text-sm text-muted-foreground">{day.summary}</p>}
            </div>
            {!locked && actions.updateDay && actions.deleteDay && (
              <details className="text-sm">
                <summary className="cursor-pointer text-link">Edit day</summary>
                <form
                  action={actions.updateDay}
                  className="mt-3 grid w-72 gap-2 rounded-lg border border-border bg-surface p-3"
                >
                  {hiddenInputs}
                  <input type="hidden" name="dayId" value={day.id} />
                  <label className={labelClass}>
                    Day number
                    <input
                      name="dayNumber"
                      type="number"
                      min={1}
                      defaultValue={day.day_number}
                      className={inputClass}
                      required
                    />
                  </label>
                  <label className={labelClass}>
                    Title
                    <input name="title" defaultValue={day.title} className={inputClass} required />
                  </label>
                  <label className={labelClass}>
                    Summary
                    <textarea
                      name="summary"
                      defaultValue={day.summary ?? ""}
                      className={cn(inputClass, "h-16 py-1.5")}
                    />
                  </label>
                  <label className={labelClass}>
                    Destination
                    <select
                      name="destinationId"
                      defaultValue={day.destination?.id ?? ""}
                      className={inputClass}
                    >
                      <option value="">—</option>
                      {destinations.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex justify-between gap-2">
                    <SubmitButton size="sm">Save day</SubmitButton>
                  </div>
                </form>
                <form action={actions.deleteDay} className="mt-2">
                  {hiddenInputs}
                  <input type="hidden" name="dayId" value={day.id} />
                  <SubmitButton
                    size="sm"
                    variant="ghost"
                    className="text-danger"
                    confirm={`Delete day ${day.day_number} and all its items?`}
                  >
                    Delete day
                  </SubmitButton>
                </form>
              </details>
            )}
          </header>

          <ol className="divide-y divide-border">
            {day.items.map((item) => (
              <li key={item.id} id={`item-${item.id}`} className="scroll-mt-6 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="w-28 font-medium">
                    {item.start_time ? formatWallTime(item.start_time) : "—"}
                    {item.end_time ? ` – ${formatWallTime(item.end_time)}` : ""}
                  </span>
                  <Badge variant={item.type === "free_time" ? "included" : "neutral"}>
                    {item.type.replace("_", " ")}
                  </Badge>
                  <span className="font-semibold">{item.title}</span>
                  {item.is_optional && <Badge variant="optional">optional</Badge>}
                  <Badge variant={item.responsibility === "guideless" ? "guideless" : "traveler"}>
                    {item.responsibility === "guideless" ? "Guideless" : "traveler"}
                  </Badge>
                  {item.visibility !== "public_preview" && item.visibility !== "trip_member" && (
                    <Badge variant="warning">{item.visibility.replace("_", " ")}</Badge>
                  )}
                  {scope === "trip" && item.status && item.status !== "planned" && (
                    <Badge variant={item.status === "cancelled" ? "danger" : "info"}>
                      {item.status.replace("_", " ")}
                    </Badge>
                  )}
                </div>
                {!locked && (
                  <details className="mt-1 text-sm">
                    <summary className="cursor-pointer text-link">Edit</summary>
                    <ItemForm
                      scope={scope}
                      action={actions.updateItem}
                      hidden={{ ...hidden, itemId: item.id }}
                      item={item}
                      defaultTimezone={defaultTimezone}
                      submitLabel="Save item"
                    />
                    <form action={actions.deleteItem} className="mt-2">
                      {hiddenInputs}
                      <input type="hidden" name="itemId" value={item.id} />
                      <SubmitButton
                        size="sm"
                        variant="ghost"
                        className="text-danger"
                        confirm="Delete this item?"
                      >
                        Delete item
                      </SubmitButton>
                    </form>
                  </details>
                )}
              </li>
            ))}
          </ol>

          {!locked && (
            <details className="border-t border-border px-4 py-3 text-sm">
              <summary className="cursor-pointer font-medium text-link">
                + Add item to day {day.day_number}
              </summary>
              <ItemForm
                scope={scope}
                action={actions.addItem}
                hidden={{ ...hidden, dayId: day.id }}
                defaultTimezone={
                  destinations.find((d) => d.id === day.destination?.id)?.timezone ??
                  defaultTimezone
                }
                defaultPosition={Math.max(0, ...day.items.map((i) => i.position)) + 1}
                submitLabel="Add item"
              />
            </details>
          )}
        </article>
      ))}

      {!locked && actions.addDay && (
        <details className="rounded-xl border border-dashed border-border px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium text-link">+ Add day {nextDay}</summary>
          <form action={actions.addDay} className="mt-3 grid gap-3 sm:grid-cols-4">
            {hiddenInputs}
            <label className={labelClass}>
              Day number
              <input
                name="dayNumber"
                type="number"
                min={1}
                defaultValue={nextDay}
                className={inputClass}
                required
              />
            </label>
            <label className={cn(labelClass, "sm:col-span-2")}>
              Title
              <input name="title" className={inputClass} required placeholder="Arrive in Nice" />
            </label>
            <label className={labelClass}>
              Destination
              <select name="destinationId" className={inputClass} defaultValue="">
                <option value="">—</option>
                {destinations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={cn(labelClass, "sm:col-span-3")}>
              Summary
              <input
                name="summary"
                className={inputClass}
                placeholder="Land, meet the group, settle in."
              />
            </label>
            <div className="flex items-end">
              <SubmitButton size="sm">Add day</SubmitButton>
            </div>
          </form>
        </details>
      )}
    </div>
  );
}

function ItemForm({
  scope,
  action,
  hidden,
  item,
  defaultTimezone,
  defaultPosition = 0,
  submitLabel,
}: {
  scope: "tour" | "trip";
  action: Action;
  hidden: Record<string, string>;
  item?: EditorItem;
  defaultTimezone: string;
  defaultPosition?: number;
  submitLabel: string;
}) {
  return (
    <form
      action={action}
      className="mt-3 grid gap-3 rounded-lg border border-border bg-surface p-3 sm:grid-cols-6"
    >
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label className={labelClass}>
        Type
        <select name="type" defaultValue={item?.type ?? "free_time"} className={inputClass}>
          {ITINERARY_ITEM_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <label className={cn(labelClass, "sm:col-span-3")}>
        Title
        <input name="title" defaultValue={item?.title ?? ""} className={inputClass} required />
      </label>
      <label className={labelClass}>
        Start
        <input
          name="startTime"
          type="time"
          defaultValue={item?.start_time?.slice(0, 5) ?? ""}
          className={inputClass}
        />
      </label>
      <label className={labelClass}>
        End
        <input
          name="endTime"
          type="time"
          defaultValue={item?.end_time?.slice(0, 5) ?? ""}
          className={inputClass}
        />
      </label>
      <label className={cn(labelClass, "sm:col-span-6")}>
        Description
        <textarea
          name="description"
          defaultValue={item?.description ?? ""}
          className={cn(inputClass, "h-16 py-1.5")}
        />
      </label>
      <label className={cn(labelClass, "sm:col-span-2")}>
        Location name
        <input
          name="locationName"
          defaultValue={item?.location_name ?? ""}
          className={inputClass}
        />
      </label>
      <label className={cn(labelClass, "sm:col-span-2")}>
        Address
        <input name="address" defaultValue={item?.address ?? ""} className={inputClass} />
      </label>
      <label className={cn(labelClass, "sm:col-span-2")}>
        Time zone (IANA)
        <input
          name="timezone"
          defaultValue={item?.timezone ?? defaultTimezone}
          className={inputClass}
          required
        />
      </label>
      <label className={cn(labelClass, "sm:col-span-6")}>
        Instructions (shown to travelers)
        <input name="instructions" defaultValue={item?.instructions ?? ""} className={inputClass} />
      </label>
      <label className={labelClass}>
        Arranged by
        <select
          name="responsibility"
          defaultValue={item?.responsibility ?? "guideless"}
          className={inputClass}
        >
          <option value="guideless">Guideless</option>
          <option value="traveler">Traveler</option>
        </select>
      </label>
      <label className={labelClass}>
        Visibility
        <select
          name="visibility"
          defaultValue={item?.visibility ?? (scope === "trip" ? "trip_member" : "public_preview")}
          className={inputClass}
        >
          {VISIBILITIES.map((v) => (
            <option key={v} value={v}>
              {v.replace("_", " ")}
            </option>
          ))}
        </select>
      </label>
      {scope === "trip" && (
        <label className={labelClass}>
          Status
          <select name="status" defaultValue={item?.status ?? "planned"} className={inputClass}>
            {ITINERARY_ITEM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className={labelClass}>
        Position
        <input
          name="position"
          type="number"
          min={0}
          defaultValue={item?.position ?? defaultPosition}
          className={inputClass}
        />
      </label>
      <label className="flex items-end gap-2 pb-2 text-xs font-medium text-muted-foreground">
        <input
          type="checkbox"
          name="isOptional"
          defaultChecked={item?.is_optional ?? false}
          className="accent-ink"
        />{" "}
        Optional
      </label>
      <div className="flex items-end sm:col-span-6">
        <SubmitButton size="sm">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
