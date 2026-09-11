import Link from "next/link";
import { notFound } from "next/navigation";
import { Flash } from "@/components/admin/flash";
import { ItineraryEditor } from "@/components/admin/itinerary-editor";
import { SubmitButton } from "@/components/admin/submit-button";
import { PageHeader, Section, inputClass, labelClass } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import {
  addDayAction,
  addItemAction,
  addListItemAction,
  addRouteStopAction,
  deleteDayAction,
  deleteItemAction,
  deleteListItemAction,
  publishVersionAction,
  removeRouteStopAction,
  updateDayAction,
  updateItemAction,
  updateVersionAction,
} from "@/lib/admin/actions/tours";
import { getVersionAdmin } from "@/lib/admin/queries";
import { CONTENT_ROLES, requireStaff } from "@/lib/auth/staff";
import { cn } from "@/lib/utils";

export default async function AdminVersionPage(
  props: PageProps<"/admin/tours/[id]/versions/[versionId]">,
) {
  const [{ id, versionId }, sp, ctx] = await Promise.all([
    props.params,
    props.searchParams,
    requireStaff(),
  ]);
  const data = await getVersionAdmin(versionId);
  if (!data || data.tour.id !== id) notFound();
  const { tour, version, route, included, excluded, faqs, days, destinations, isLocked } = data;
  const locked = isLocked || !ctx.can(CONTENT_ROLES);
  const hidden = { tourId: tour.id, versionId: version.id };
  const defaultTimezone = route[0]?.destination.timezone ?? "Europe/Paris";

  return (
    <>
      <PageHeader
        title={`${tour.name} — v${version.version_number}`}
        crumbs={
          <>
            <Link href="/admin/tours">Tours</Link> /{" "}
            <Link href={`/admin/tours/${tour.id}`}>{tour.name}</Link>
          </>
        }
        description={
          <>
            <Badge
              variant={
                version.status === "published"
                  ? "included"
                  : version.status === "draft"
                    ? "warning"
                    : "neutral"
              }
            >
              {version.status}
            </Badge>{" "}
            {isLocked
              ? "Published and archived versions are read-only — create a new draft to change content."
              : "Draft: edit freely, then publish."}
          </>
        }
        actions={
          !locked && (
            <form action={publishVersionAction}>
              <input type="hidden" name="tourId" value={tour.id} />
              <input type="hidden" name="versionId" value={version.id} />
              <SubmitButton
                size="sm"
                confirm="Publish this version? New departures will use it; existing ones keep theirs."
              >
                Publish v{version.version_number}
              </SubmitButton>
            </form>
          )
        }
      />
      <Flash searchParams={sp} />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Section title="Content" description="What the public tour page shows.">
          <form action={updateVersionAction} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="tourId" value={tour.id} />
            <input type="hidden" name="versionId" value={version.id} />
            <label className={cn(labelClass, "sm:col-span-2")}>
              Tagline
              <input
                name="tagline"
                defaultValue={version.tagline ?? ""}
                className={inputClass}
                disabled={locked}
              />
            </label>
            <label className={cn(labelClass, "sm:col-span-2")}>
              Summary
              <textarea
                name="summary"
                defaultValue={version.summary ?? ""}
                className={cn(inputClass, "h-20 py-1.5")}
                disabled={locked}
              />
            </label>
            <label className={cn(labelClass, "sm:col-span-2")}>
              Description
              <textarea
                name="description"
                defaultValue={version.description ?? ""}
                className={cn(inputClass, "h-28 py-1.5")}
                disabled={locked}
              />
            </label>
            <label className={cn(labelClass, "sm:col-span-2")}>
              Why this trip (pull quote)
              <input
                name="whyThisTrip"
                defaultValue={version.why_this_trip ?? ""}
                className={inputClass}
                disabled={locked}
              />
            </label>
            <label className={labelClass}>
              From price (major units)
              <input
                name="startingPrice"
                defaultValue={
                  version.starting_price_amount != null
                    ? (version.starting_price_amount / 100).toFixed(2)
                    : ""
                }
                className={inputClass}
                disabled={locked}
              />
            </label>
            <label className={labelClass}>
              Currency
              <select
                name="startingPriceCurrency"
                defaultValue={version.starting_price_currency ?? "USD"}
                className={inputClass}
                disabled={locked}
              >
                <option>USD</option>
                <option>EUR</option>
                <option>GBP</option>
              </select>
            </label>
            <label className={cn(labelClass, "sm:col-span-2")}>
              Hero image URL
              <input
                name="heroImageUrl"
                defaultValue={version.hero_image_url ?? ""}
                className={inputClass}
                disabled={locked}
              />
            </label>
            <label className={labelClass}>
              SEO title
              <input
                name="seoTitle"
                defaultValue={version.seo_title ?? ""}
                className={inputClass}
                disabled={locked}
              />
            </label>
            <label className={labelClass}>
              SEO description
              <input
                name="seoDescription"
                defaultValue={version.seo_description ?? ""}
                className={inputClass}
                disabled={locked}
              />
            </label>
            {!locked && (
              <div className="sm:col-span-2">
                <SubmitButton size="sm">Save content</SubmitButton>
              </div>
            )}
          </form>
        </Section>

        <div className="space-y-6">
          <Section id="route" title="Route" description="Ordered stops with nights.">
            <ol className="space-y-2 text-sm">
              {route.map((r, i) => (
                <li key={r.destination.id} className="flex items-center justify-between gap-3">
                  <span>
                    <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-aqua/30 text-xs font-bold">
                      {i + 1}
                    </span>
                    {r.destination.name} · {r.nights} nights
                  </span>
                  {!locked && (
                    <form action={removeRouteStopAction}>
                      <input type="hidden" name="tourId" value={tour.id} />
                      <input type="hidden" name="versionId" value={version.id} />
                      <input type="hidden" name="destinationId" value={r.destination.id} />
                      <SubmitButton size="sm" variant="ghost" className="h-7 text-danger">
                        Remove
                      </SubmitButton>
                    </form>
                  )}
                </li>
              ))}
              {route.length === 0 && <li className="text-muted-foreground">No stops yet.</li>}
            </ol>
            {!locked && (
              <form action={addRouteStopAction} className="mt-4 flex flex-wrap items-end gap-2">
                <input type="hidden" name="tourId" value={tour.id} />
                <input type="hidden" name="versionId" value={version.id} />
                <label className={labelClass}>
                  Destination
                  <select name="destinationId" className={inputClass} required defaultValue="">
                    <option value="" disabled>
                      Choose…
                    </option>
                    {destinations
                      .filter((d) => !route.some((r) => r.destination.id === d.id))
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Nights
                  <input
                    name="nights"
                    type="number"
                    min={0}
                    defaultValue={2}
                    className={cn(inputClass, "w-20")}
                  />
                </label>
                <SubmitButton size="sm">Add stop</SubmitButton>
              </form>
            )}
          </Section>

          <Section id="lists" title="Included · You book · FAQ">
            {(
              [
                ["included", "Guideless handles", included],
                ["excluded", "You book", excluded],
              ] as const
            ).map(([kind, label, items]) => (
              <div key={kind} className="mb-5">
                <h3 className="eyebrow mb-2 text-muted-foreground">{label}</h3>
                <ul className="space-y-1 text-sm">
                  {items.map((i) => (
                    <li key={i.id} className="flex items-start justify-between gap-3">
                      <span>
                        <span className="font-medium">{i.title}</span>
                        {i.description && (
                          <span className="block text-muted-foreground">{i.description}</span>
                        )}
                      </span>
                      {!locked && (
                        <form action={deleteListItemAction}>
                          <input type="hidden" name="tourId" value={tour.id} />
                          <input type="hidden" name="versionId" value={version.id} />
                          <input type="hidden" name="kind" value={kind} />
                          <input type="hidden" name="itemId" value={i.id} />
                          <SubmitButton size="sm" variant="ghost" className="h-7 text-danger">
                            ×
                          </SubmitButton>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
                {!locked && (
                  <form action={addListItemAction} className="mt-2 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="tourId" value={tour.id} />
                    <input type="hidden" name="versionId" value={version.id} />
                    <input type="hidden" name="kind" value={kind} />
                    <input
                      name="title"
                      placeholder="Title"
                      className={cn(inputClass, "w-44")}
                      required
                    />
                    <input
                      name="description"
                      placeholder="Description (optional)"
                      className={cn(inputClass, "flex-1 min-w-40")}
                    />
                    <SubmitButton size="sm" variant="secondary">
                      Add
                    </SubmitButton>
                  </form>
                )}
              </div>
            ))}
            <div>
              <h3 className="eyebrow mb-2 text-muted-foreground">FAQ</h3>
              <ul className="space-y-2 text-sm">
                {faqs.map((f) => (
                  <li key={f.id} className="flex items-start justify-between gap-3">
                    <span>
                      <span className="font-medium">{f.question}</span>
                      <span className="block text-muted-foreground">{f.answer}</span>
                    </span>
                    {!locked && (
                      <form action={deleteListItemAction}>
                        <input type="hidden" name="tourId" value={tour.id} />
                        <input type="hidden" name="versionId" value={version.id} />
                        <input type="hidden" name="kind" value="faq" />
                        <input type="hidden" name="itemId" value={f.id} />
                        <SubmitButton size="sm" variant="ghost" className="h-7 text-danger">
                          ×
                        </SubmitButton>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
              {!locked && (
                <form action={addListItemAction} className="mt-2 grid gap-2">
                  <input type="hidden" name="tourId" value={tour.id} />
                  <input type="hidden" name="versionId" value={version.id} />
                  <input type="hidden" name="kind" value="faq" />
                  <input name="question" placeholder="Question" className={inputClass} required />
                  <textarea
                    name="answer"
                    placeholder="Answer"
                    className={cn(inputClass, "h-16 py-1.5")}
                    required
                  />
                  <div>
                    <SubmitButton size="sm" variant="secondary">
                      Add FAQ
                    </SubmitButton>
                  </div>
                </form>
              )}
            </div>
          </Section>
        </div>
      </div>

      <div className="mt-6">
        <Section
          id="itinerary"
          title="Itinerary template"
          description="Copied into each trip when a departure is activated. Free time is a first-class item."
        >
          <ItineraryEditor
            scope="tour"
            hidden={hidden}
            days={days.map((d) => ({
              ...d,
              destination: d.destination
                ? { id: d.destination.id, name: d.destination.name }
                : null,
            }))}
            destinations={destinations}
            defaultTimezone={defaultTimezone}
            locked={locked}
            actions={{
              addDay: addDayAction,
              updateDay: updateDayAction,
              deleteDay: deleteDayAction,
              addItem: addItemAction,
              updateItem: updateItemAction,
              deleteItem: deleteItemAction,
            }}
          />
        </Section>
      </div>
    </>
  );
}
