"use server";

import { revalidatePath } from "next/cache";
import { hostApplicationDecisionSchema, meetupFormSchema, uuidSchema } from "@guideless/validation";
import { zonedToUtc } from "@guideless/utils";
import { CONTENT_ROLES, OPS_ROLES, requireStaff } from "@/lib/auth/staff";
import { dbErrorMessage, flash, parseForm } from "@/lib/admin/form";
import { createClient } from "@/lib/supabase/server";

const MEETUP_ROLES = [...new Set([...CONTENT_ROLES, ...OPS_ROLES])];

function id(fd: FormData, key: string): string {
  const parsed = uuidSchema.safeParse(fd.get(key));
  if (!parsed.success) throw new Error(`Missing or invalid ${key}`);
  return parsed.data;
}

// ── Host applications ─────────────────────────────────────────────────────────
export async function decideHostApplicationAction(fd: FormData): Promise<void> {
  await requireStaff();
  const applicationId = id(fd, "applicationId");
  const to = `/admin/hosts/${applicationId}`;
  const parsed = parseForm(hostApplicationDecisionSchema, fd);
  if (!parsed.ok) flash(to, "error", parsed.error);
  const sb = await createClient();
  const { error } = await sb
    .from("host_applications")
    .update({ status: parsed.data.status, staff_notes: parsed.data.staffNotes ?? null })
    .eq("id", applicationId);
  if (error) flash(to, "error", dbErrorMessage(error));
  revalidatePath("/admin/hosts");
  revalidatePath(to);
  flash(to, "ok", `Application marked ${parsed.data.status}.`);
}

// ── Meetups ───────────────────────────────────────────────────────────────────
function meetupRow(m: ReturnType<typeof meetupFormSchema.parse>) {
  const startsAt = zonedToUtc(m.date, m.startTime, m.timezone);
  const endsAt = m.endTime ? zonedToUtc(m.date, m.endTime, m.timezone) : null;
  return {
    title: m.title,
    description: m.description ?? null,
    city: m.city,
    country_code: m.countryCode ?? null,
    venue_name: m.venueName ?? null,
    address: m.address ?? null,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt ? endsAt.toISOString() : null,
    timezone: m.timezone,
    capacity: m.capacity ?? null,
    is_published: m.isPublished,
  };
}

export async function createMeetupAction(fd: FormData): Promise<void> {
  const ctx = await requireStaff(MEETUP_ROLES);
  const parsed = parseForm(meetupFormSchema, fd);
  if (!parsed.ok) flash("/admin/meetups/new", "error", parsed.error);
  const sb = await createClient();
  const { data, error } = await sb
    .from("meetups")
    .insert({ ...meetupRow(parsed.data), created_by: ctx.user.id })
    .select("id")
    .single();
  if (error) flash("/admin/meetups/new", "error", dbErrorMessage(error));
  revalidatePath("/admin/meetups");
  revalidatePath("/meetups");
  flash(`/admin/meetups/${data.id}`, "ok", "Evening created.");
}

export async function updateMeetupAction(fd: FormData): Promise<void> {
  await requireStaff(MEETUP_ROLES);
  const meetupId = id(fd, "meetupId");
  const to = `/admin/meetups/${meetupId}`;
  const parsed = parseForm(meetupFormSchema, fd);
  if (!parsed.ok) flash(to, "error", parsed.error);
  const sb = await createClient();
  const { error } = await sb.from("meetups").update(meetupRow(parsed.data)).eq("id", meetupId);
  if (error) flash(to, "error", dbErrorMessage(error));
  revalidatePath("/admin/meetups");
  revalidatePath(to);
  revalidatePath("/meetups");
  revalidatePath(`/meetups/${meetupId}`);
  flash(to, "ok", "Evening saved.");
}

export async function setMeetupPublishedAction(fd: FormData): Promise<void> {
  await requireStaff(MEETUP_ROLES);
  const meetupId = id(fd, "meetupId");
  const publish = fd.get("publish") === "true";
  const to = `/admin/meetups/${meetupId}`;
  const sb = await createClient();
  const { error } = await sb.from("meetups").update({ is_published: publish }).eq("id", meetupId);
  if (error) flash(to, "error", dbErrorMessage(error));
  revalidatePath("/admin/meetups");
  revalidatePath(to);
  revalidatePath("/meetups");
  flash(to, "ok", publish ? "Evening published." : "Evening unpublished.");
}

export async function deleteMeetupAction(fd: FormData): Promise<void> {
  await requireStaff(MEETUP_ROLES);
  const meetupId = id(fd, "meetupId");
  const sb = await createClient();
  const { error } = await sb.from("meetups").delete().eq("id", meetupId);
  if (error) flash(`/admin/meetups/${meetupId}`, "error", dbErrorMessage(error));
  revalidatePath("/admin/meetups");
  revalidatePath("/meetups");
  flash("/admin/meetups", "ok", "Evening deleted.");
}
