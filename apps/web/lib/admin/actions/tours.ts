"use server";

import { revalidatePath } from "next/cache";
import {
  faqSchema,
  itineraryItemSchema,
  listItemSchema,
  routeStopSchema,
  tourDaySchema,
  tourFormSchema,
  tourVersionFormSchema,
  uuidSchema,
} from "@guideless/validation";
import { CONTENT_ROLES, requireStaff } from "@/lib/auth/staff";
import { dbErrorMessage, flash, parseForm, returnTo } from "@/lib/admin/form";
import { createClient } from "@/lib/supabase/server";

function id(fd: FormData, key: string): string {
  const v = fd.get(key);
  const parsed = uuidSchema.safeParse(v);
  if (!parsed.success) throw new Error(`Missing or invalid ${key}`);
  return parsed.data;
}

function revalidateTour(tourId: string, versionId?: string) {
  revalidatePath("/admin/tours");
  revalidatePath(`/admin/tours/${tourId}`);
  if (versionId) revalidatePath(`/admin/tours/${tourId}/versions/${versionId}`);
  revalidatePath("/tours");
  revalidatePath("/");
}

// ── Tour ──────────────────────────────────────────────────────────────────────
export async function createTourAction(fd: FormData): Promise<void> {
  const ctx = await requireStaff(CONTENT_ROLES);
  const parsed = parseForm(tourFormSchema, fd);
  if (!parsed.ok) flash("/admin/tours/new", "error", parsed.error);
  const t = parsed.data;
  const sb = await createClient();
  const { data: tour, error } = await sb
    .from("tours")
    .insert({
      name: t.name,
      slug: t.slug,
      duration_days: t.durationDays,
      group_size_min: t.groupSizeMin,
      group_size_max: t.groupSizeMax,
      activity_level: t.activityLevel,
      is_published: false,
    })
    .select("id")
    .single();
  if (error) flash("/admin/tours/new", "error", dbErrorMessage(error));
  const { error: vErr } = await sb
    .from("tour_versions")
    .insert({ tour_id: tour.id, version_number: 1, status: "draft", created_by: ctx.user.id });
  if (vErr) flash(`/admin/tours/${tour.id}`, "error", dbErrorMessage(vErr));
  revalidateTour(tour.id);
  flash(`/admin/tours/${tour.id}`, "ok", "Tour created with a draft version 1.");
}

export async function updateTourAction(fd: FormData): Promise<void> {
  await requireStaff(CONTENT_ROLES);
  const tourId = id(fd, "tourId");
  const back = returnTo(fd, `/admin/tours/${tourId}`);
  const parsed = parseForm(tourFormSchema, fd);
  if (!parsed.ok) flash(back, "error", parsed.error);
  const t = parsed.data;
  const sb = await createClient();
  if (t.isPublished) {
    const { data: tour } = await sb
      .from("tours")
      .select("current_version_id")
      .eq("id", tourId)
      .maybeSingle();
    if (!tour?.current_version_id)
      flash(back, "error", "Publish a version before publishing the tour.");
  }
  const { error } = await sb
    .from("tours")
    .update({
      name: t.name,
      slug: t.slug,
      duration_days: t.durationDays,
      group_size_min: t.groupSizeMin,
      group_size_max: t.groupSizeMax,
      activity_level: t.activityLevel,
      is_published: t.isPublished,
    })
    .eq("id", tourId);
  if (error) flash(back, "error", dbErrorMessage(error));
  revalidateTour(tourId);
  flash(back, "ok", "Tour saved.");
}

// ── Versions ──────────────────────────────────────────────────────────────────
export async function createDraftVersionAction(fd: FormData): Promise<void> {
  const ctx = await requireStaff(CONTENT_ROLES);
  const tourId = id(fd, "tourId");
  const back = `/admin/tours/${tourId}`;
  const sb = await createClient();
  const { data: versions } = await sb
    .from("tour_versions")
    .select("*")
    .eq("tour_id", tourId)
    .order("version_number", { ascending: false });
  if (versions?.some((v) => v.status === "draft"))
    flash(back, "error", "There is already a draft version. Edit or publish it first.");
  const source = versions?.[0];
  const next = (source?.version_number ?? 0) + 1;

  const { data: created, error } = await sb
    .from("tour_versions")
    .insert({
      tour_id: tourId,
      version_number: next,
      status: "draft",
      created_by: ctx.user.id,
      tagline: source?.tagline ?? null,
      summary: source?.summary ?? null,
      description: source?.description ?? null,
      why_this_trip: source?.why_this_trip ?? null,
      hero_image_url: source?.hero_image_url ?? null,
      gallery_image_urls: source?.gallery_image_urls ?? [],
      starting_price_amount: source?.starting_price_amount ?? null,
      starting_price_currency: source?.starting_price_currency ?? null,
      seo_title: source?.seo_title ?? null,
      seo_description: source?.seo_description ?? null,
    })
    .select("id")
    .single();
  if (error) flash(back, "error", dbErrorMessage(error));

  // Copy route, lists, FAQs, days and items from the source version.
  if (source) {
    const [{ data: route }, { data: inc }, { data: exc }, { data: faqs }, { data: days }] =
      await Promise.all([
        sb.from("tour_version_destinations").select("*").eq("tour_version_id", source.id),
        sb.from("tour_included_items").select("*").eq("tour_version_id", source.id),
        sb.from("tour_excluded_items").select("*").eq("tour_version_id", source.id),
        sb.from("tour_faqs").select("*").eq("tour_version_id", source.id),
        sb.from("tour_days").select("*, tour_itinerary_items(*)").eq("tour_version_id", source.id),
      ]);
    if (route?.length)
      await sb.from("tour_version_destinations").insert(
        route.map((r) => ({
          tour_version_id: created.id,
          destination_id: r.destination_id,
          position: r.position,
          nights: r.nights,
        })),
      );
    if (inc?.length)
      await sb.from("tour_included_items").insert(
        inc.map((i) => ({
          tour_version_id: created.id,
          position: i.position,
          title: i.title,
          description: i.description,
        })),
      );
    if (exc?.length)
      await sb.from("tour_excluded_items").insert(
        exc.map((i) => ({
          tour_version_id: created.id,
          position: i.position,
          title: i.title,
          description: i.description,
        })),
      );
    if (faqs?.length)
      await sb.from("tour_faqs").insert(
        faqs.map((f) => ({
          tour_version_id: created.id,
          position: f.position,
          question: f.question,
          answer: f.answer,
        })),
      );
    for (const day of days ?? []) {
      const { data: newDay } = await sb
        .from("tour_days")
        .insert({
          tour_version_id: created.id,
          day_number: day.day_number,
          destination_id: day.destination_id,
          title: day.title,
          summary: day.summary,
        })
        .select("id")
        .single();
      if (newDay && day.tour_itinerary_items.length) {
        await sb.from("tour_itinerary_items").insert(
          day.tour_itinerary_items.map((item) => ({
            tour_day_id: newDay.id,
            position: item.position,
            type: item.type,
            title: item.title,
            description: item.description,
            start_time: item.start_time,
            end_time: item.end_time,
            timezone: item.timezone,
            location_name: item.location_name,
            address: item.address,
            latitude: item.latitude,
            longitude: item.longitude,
            instructions: item.instructions,
            responsibility: item.responsibility,
            is_optional: item.is_optional,
            visibility: item.visibility,
          })),
        );
      }
    }
  }
  revalidateTour(tourId, created.id);
  flash(
    `/admin/tours/${tourId}/versions/${created.id}`,
    "ok",
    `Draft version ${next} created${source ? " from version " + source.version_number : ""}.`,
  );
}

export async function updateVersionAction(fd: FormData): Promise<void> {
  await requireStaff(CONTENT_ROLES);
  const versionId = id(fd, "versionId");
  const tourId = id(fd, "tourId");
  const back = `/admin/tours/${tourId}/versions/${versionId}`;
  const parsed = parseForm(tourVersionFormSchema, fd);
  if (!parsed.ok) flash(back, "error", parsed.error);
  const v = parsed.data;
  const sb = await createClient();
  const { error } = await sb
    .from("tour_versions")
    .update({
      tagline: v.tagline ?? null,
      summary: v.summary ?? null,
      description: v.description ?? null,
      why_this_trip: v.whyThisTrip ?? null,
      hero_image_url: v.heroImageUrl ?? null,
      starting_price_amount: v.startingPrice ?? null,
      starting_price_currency: v.startingPrice != null ? (v.startingPriceCurrency ?? "USD") : null,
      seo_title: v.seoTitle ?? null,
      seo_description: v.seoDescription ?? null,
    })
    .eq("id", versionId)
    .eq("status", "draft");
  if (error) flash(back, "error", dbErrorMessage(error));
  revalidateTour(tourId, versionId);
  flash(back, "ok", "Version content saved.");
}

export async function publishVersionAction(fd: FormData): Promise<void> {
  await requireStaff(CONTENT_ROLES);
  const versionId = id(fd, "versionId");
  const tourId = id(fd, "tourId");
  const back = `/admin/tours/${tourId}`;
  const sb = await createClient();
  const { count: dayCount } = await sb
    .from("tour_days")
    .select("id", { count: "exact", head: true })
    .eq("tour_version_id", versionId);
  if (!dayCount) flash(back, "error", "Add at least one itinerary day before publishing.");
  // Archive the currently published version (departures keep their pinned version_id — ADR-008).
  await sb
    .from("tour_versions")
    .update({ status: "archived" })
    .eq("tour_id", tourId)
    .eq("status", "published");
  const { error } = await sb
    .from("tour_versions")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", versionId);
  if (error) flash(back, "error", dbErrorMessage(error));
  const { error: tErr } = await sb
    .from("tours")
    .update({ current_version_id: versionId })
    .eq("id", tourId);
  if (tErr) flash(back, "error", dbErrorMessage(tErr));
  revalidateTour(tourId, versionId);
  flash(
    back,
    "ok",
    "Version published. New departures will use it; existing departures keep theirs.",
  );
}

// ── Route / lists / FAQs ──────────────────────────────────────────────────────
export async function addRouteStopAction(fd: FormData): Promise<void> {
  await requireStaff(CONTENT_ROLES);
  const versionId = id(fd, "versionId");
  const tourId = id(fd, "tourId");
  const back = `/admin/tours/${tourId}/versions/${versionId}#route`;
  const parsed = parseForm(routeStopSchema, fd);
  if (!parsed.ok) flash(back, "error", parsed.error);
  const sb = await createClient();
  const { data: existing } = await sb
    .from("tour_version_destinations")
    .select("position")
    .eq("tour_version_id", versionId);
  const position = Math.max(0, ...(existing ?? []).map((r) => r.position)) + 1;
  const { error } = await sb.from("tour_version_destinations").insert({
    tour_version_id: versionId,
    destination_id: parsed.data.destinationId,
    nights: parsed.data.nights,
    position,
  });
  if (error) flash(back, "error", dbErrorMessage(error));
  revalidateTour(tourId, versionId);
  flash(back, "ok", "Stop added.");
}

export async function removeRouteStopAction(fd: FormData): Promise<void> {
  await requireStaff(CONTENT_ROLES);
  const versionId = id(fd, "versionId");
  const tourId = id(fd, "tourId");
  const destinationId = id(fd, "destinationId");
  const back = `/admin/tours/${tourId}/versions/${versionId}#route`;
  const sb = await createClient();
  const { error } = await sb
    .from("tour_version_destinations")
    .delete()
    .eq("tour_version_id", versionId)
    .eq("destination_id", destinationId);
  if (error) flash(back, "error", dbErrorMessage(error));
  revalidateTour(tourId, versionId);
  flash(back, "ok", "Stop removed.");
}

type ListKind = "included" | "excluded" | "faq";
const LIST_TABLE = {
  included: "tour_included_items",
  excluded: "tour_excluded_items",
  faq: "tour_faqs",
} as const;

export async function addListItemAction(fd: FormData): Promise<void> {
  await requireStaff(CONTENT_ROLES);
  const versionId = id(fd, "versionId");
  const tourId = id(fd, "tourId");
  const kind = fd.get("kind") as ListKind;
  const back = `/admin/tours/${tourId}/versions/${versionId}#lists`;
  if (!(kind in LIST_TABLE)) flash(back, "error", "Unknown list.");
  const sb = await createClient();
  const table = LIST_TABLE[kind];
  const { data: existing } = await sb
    .from(table)
    .select("position")
    .eq("tour_version_id", versionId);
  const position = Math.max(0, ...(existing ?? []).map((r) => r.position)) + 1;
  let error;
  if (kind === "faq") {
    const parsed = parseForm(faqSchema, fd);
    if (!parsed.ok) flash(back, "error", parsed.error);
    ({ error } = await sb.from("tour_faqs").insert({
      tour_version_id: versionId,
      position,
      question: parsed.data.question,
      answer: parsed.data.answer,
    }));
  } else {
    const parsed = parseForm(listItemSchema, fd);
    if (!parsed.ok) flash(back, "error", parsed.error);
    const row = {
      tour_version_id: versionId,
      position,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
    };
    // Branch explicitly: a union of table names collapses the insert row type to `never`.
    ({ error } =
      kind === "included"
        ? await sb.from("tour_included_items").insert(row)
        : await sb.from("tour_excluded_items").insert(row));
  }
  if (error) flash(back, "error", dbErrorMessage(error));
  revalidateTour(tourId, versionId);
  flash(back, "ok", "Added.");
}

export async function deleteListItemAction(fd: FormData): Promise<void> {
  await requireStaff(CONTENT_ROLES);
  const versionId = id(fd, "versionId");
  const tourId = id(fd, "tourId");
  const itemId = id(fd, "itemId");
  const kind = fd.get("kind") as ListKind;
  const back = `/admin/tours/${tourId}/versions/${versionId}#lists`;
  if (!(kind in LIST_TABLE)) flash(back, "error", "Unknown list.");
  const sb = await createClient();
  const { error } = await sb.from(LIST_TABLE[kind]).delete().eq("id", itemId);
  if (error) flash(back, "error", dbErrorMessage(error));
  revalidateTour(tourId, versionId);
  flash(back, "ok", "Removed.");
}

// ── Days & items (template) ───────────────────────────────────────────────────
export async function addDayAction(fd: FormData): Promise<void> {
  await requireStaff(CONTENT_ROLES);
  const versionId = id(fd, "versionId");
  const tourId = id(fd, "tourId");
  const back = `/admin/tours/${tourId}/versions/${versionId}#itinerary`;
  const parsed = parseForm(tourDaySchema, fd);
  if (!parsed.ok) flash(back, "error", parsed.error);
  const d = parsed.data;
  const sb = await createClient();
  const { error } = await sb.from("tour_days").insert({
    tour_version_id: versionId,
    day_number: d.dayNumber,
    title: d.title,
    summary: d.summary ?? null,
    destination_id: d.destinationId,
  });
  if (error) flash(back, "error", dbErrorMessage(error));
  revalidateTour(tourId, versionId);
  flash(back, "ok", `Day ${d.dayNumber} added.`);
}

export async function updateDayAction(fd: FormData): Promise<void> {
  await requireStaff(CONTENT_ROLES);
  const versionId = id(fd, "versionId");
  const tourId = id(fd, "tourId");
  const dayId = id(fd, "dayId");
  const back = `/admin/tours/${tourId}/versions/${versionId}#itinerary`;
  const parsed = parseForm(tourDaySchema, fd);
  if (!parsed.ok) flash(back, "error", parsed.error);
  const d = parsed.data;
  const sb = await createClient();
  const { error } = await sb
    .from("tour_days")
    .update({
      day_number: d.dayNumber,
      title: d.title,
      summary: d.summary ?? null,
      destination_id: d.destinationId,
    })
    .eq("id", dayId);
  if (error) flash(back, "error", dbErrorMessage(error));
  revalidateTour(tourId, versionId);
  flash(back, "ok", "Day saved.");
}

export async function deleteDayAction(fd: FormData): Promise<void> {
  await requireStaff(CONTENT_ROLES);
  const versionId = id(fd, "versionId");
  const tourId = id(fd, "tourId");
  const dayId = id(fd, "dayId");
  const back = `/admin/tours/${tourId}/versions/${versionId}#itinerary`;
  const sb = await createClient();
  const { error } = await sb.from("tour_days").delete().eq("id", dayId);
  if (error) flash(back, "error", dbErrorMessage(error));
  revalidateTour(tourId, versionId);
  flash(back, "ok", "Day removed.");
}

export async function addItemAction(fd: FormData): Promise<void> {
  await requireStaff(CONTENT_ROLES);
  const versionId = id(fd, "versionId");
  const tourId = id(fd, "tourId");
  const dayId = id(fd, "dayId");
  const back = `/admin/tours/${tourId}/versions/${versionId}#day-${dayId}`;
  const parsed = parseForm(itineraryItemSchema, fd);
  if (!parsed.ok) flash(back, "error", parsed.error);
  const i = parsed.data;
  const sb = await createClient();
  const { error } = await sb.from("tour_itinerary_items").insert({
    tour_day_id: dayId,
    position: i.position,
    type: i.type,
    title: i.title,
    description: i.description ?? null,
    start_time: i.startTime,
    end_time: i.endTime,
    timezone: i.timezone,
    location_name: i.locationName ?? null,
    address: i.address ?? null,
    instructions: i.instructions ?? null,
    responsibility: i.responsibility,
    is_optional: i.isOptional,
    visibility: i.visibility,
  });
  if (error) flash(back, "error", dbErrorMessage(error));
  revalidateTour(tourId, versionId);
  flash(back, "ok", "Item added.");
}

export async function updateItemAction(fd: FormData): Promise<void> {
  await requireStaff(CONTENT_ROLES);
  const versionId = id(fd, "versionId");
  const tourId = id(fd, "tourId");
  const itemId = id(fd, "itemId");
  const back = `/admin/tours/${tourId}/versions/${versionId}#item-${itemId}`;
  const parsed = parseForm(itineraryItemSchema, fd);
  if (!parsed.ok) flash(back, "error", parsed.error);
  const i = parsed.data;
  const sb = await createClient();
  const { error } = await sb
    .from("tour_itinerary_items")
    .update({
      position: i.position,
      type: i.type,
      title: i.title,
      description: i.description ?? null,
      start_time: i.startTime,
      end_time: i.endTime,
      timezone: i.timezone,
      location_name: i.locationName ?? null,
      address: i.address ?? null,
      instructions: i.instructions ?? null,
      responsibility: i.responsibility,
      is_optional: i.isOptional,
      visibility: i.visibility,
    })
    .eq("id", itemId);
  if (error) flash(back, "error", dbErrorMessage(error));
  revalidateTour(tourId, versionId);
  flash(back, "ok", "Item saved.");
}

export async function deleteItemAction(fd: FormData): Promise<void> {
  await requireStaff(CONTENT_ROLES);
  const versionId = id(fd, "versionId");
  const tourId = id(fd, "tourId");
  const itemId = id(fd, "itemId");
  const back = `/admin/tours/${tourId}/versions/${versionId}#itinerary`;
  const sb = await createClient();
  const { error } = await sb.from("tour_itinerary_items").delete().eq("id", itemId);
  if (error) flash(back, "error", dbErrorMessage(error));
  revalidateTour(tourId, versionId);
  flash(back, "ok", "Item removed.");
}
