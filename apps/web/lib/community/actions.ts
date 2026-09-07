"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hostApplicationSchema, meetupRsvpSchema } from "@guideless/validation";
import { formToObject } from "@/lib/admin/form";
import { RATE_LIMITED_MESSAGE, withinRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

/**
 * "/host" application. Anonymous visitors may apply (RLS allows inserts with a null user id);
 * signed-in ones are linked to their account so staff can see their trips.
 */
export async function applyToHost(fd: FormData): Promise<void> {
  const parsed = hostApplicationSchema.safeParse(formToObject(fd));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    redirect(
      `/host?error=${encodeURIComponent(first?.message ?? "Please check the form.")}#apply` as Route,
    );
  }
  if (!(await withinRateLimit("host_application", 5, 3600))) {
    redirect(`/host?error=${encodeURIComponent(RATE_LIMITED_MESSAGE)}#apply` as Route);
  }
  const a = parsed.data;
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  const { error } = await sb.from("host_applications").insert({
    user_id: user?.id ?? null,
    name: a.name,
    email: a.email,
    community_description: a.communityDescription,
    community_size: a.communitySize ?? null,
    links: a.links ?? null,
    city: a.city ?? null,
    preferred_tour_id: a.preferredTourId ?? null,
    preferred_month: a.preferredMonth ?? null,
  });
  if (error) {
    console.error("host application failed", error);
    redirect(
      `/host?error=${encodeURIComponent("We couldn't save that. Please try again or email us.")}#apply` as Route,
    );
  }
  revalidatePath("/admin/hosts");
  redirect("/host?applied=1" as Route);
}

/** RSVP to a city meetup (signed-in only; RLS scopes rows to the user). */
export async function rsvpMeetup(fd: FormData): Promise<void> {
  const parsed = meetupRsvpSchema.safeParse({
    meetupId: fd.get("meetupId"),
    status: fd.get("status"),
  });
  const back = typeof fd.get("returnTo") === "string" ? String(fd.get("returnTo")) : "/meetups";
  const safeBack = back.startsWith("/meetups") ? back : "/meetups";
  if (!parsed.success) redirect(safeBack as Route);
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(safeBack)}` as Route);
  if (!(await withinRateLimit("meetup_rsvp", 30, 3600))) redirect(safeBack as Route);
  const { error } = await sb
    .from("meetup_rsvps")
    .upsert(
      { meetup_id: parsed.data.meetupId, user_id: user.id, status: parsed.data.status },
      { onConflict: "meetup_id,user_id" },
    );
  if (error) console.error("meetup rsvp failed", error);
  revalidatePath("/meetups");
  revalidatePath(`/meetups/${parsed.data.meetupId}`);
  redirect(safeBack as Route);
}
