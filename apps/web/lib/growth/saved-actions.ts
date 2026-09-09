"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { z } from "zod";
import { emailSchema, uuidSchema } from "@guideless/validation";
import { formToObject } from "@/lib/admin/form";
import { RATE_LIMITED_MESSAGE, withinRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

/**
 * Keeping a tour for later, and asking to be told when we go somewhere.
 *
 * The alert form is public — no account needed — which makes it a public write, so it goes through
 * the same rate limit as every other public form here. An unauthenticated insert endpoint without
 * one is a mailing list somebody else fills in for you.
 */

const saveSchema = z.object({
  tourId: uuidSchema,
  slug: z.string().trim().max(80).optional(),
  note: z.string().trim().max(500).optional(),
});

const alertSchema = z
  .object({
    email: emailSchema,
    name: z.string().trim().max(120).optional(),
    destinationId: uuidSchema.optional(),
    wantedPlace: z.string().trim().min(2).max(120).optional(),
    note: z.string().trim().max(500).optional(),
    source: z
      .string()
      .trim()
      .regex(/^[a-z0-9_-]{1,40}$/)
      .default("site"),
  })
  .refine((v) => Boolean(v.destinationId) !== Boolean(v.wantedPlace), {
    message: "Pick a destination or tell us where you'd like to go",
    path: ["wantedPlace"],
  });

export async function toggleSavedTourAction(fd: FormData): Promise<void> {
  const parsed = saveSchema.safeParse(formToObject(fd));
  if (!parsed.success) redirect("/tours" as Route);
  const { tourId, slug } = parsed.data;
  const back = (slug ? `/tours/${slug}` : "/tours") as Route;

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  // Saving needs somewhere to save it to. Send them to sign in and back to what they were reading.
  if (!user) redirect(`/login?next=${encodeURIComponent(back)}` as Route);

  const { data: existing } = await sb
    .from("saved_tours")
    .select("tour_id")
    .eq("tour_id", tourId)
    .maybeSingle();

  if (existing) {
    await sb.from("saved_tours").delete().eq("tour_id", tourId);
  } else {
    await sb
      .from("saved_tours")
      .insert({ user_id: user.id, tour_id: tourId, note: parsed.data.note ?? null });
  }

  revalidatePath(back);
  revalidatePath("/account");
  redirect(back);
}

export async function createDestinationAlertAction(fd: FormData): Promise<void> {
  const raw = formToObject(fd);
  const parsed = alertSchema.safeParse(raw);
  const back = (
    typeof raw.returnTo === "string" && raw.returnTo.startsWith("/")
      ? raw.returnTo
      : "/whats-coming"
  ) as Route;

  if (!parsed.success) {
    redirect(
      `${back}?error_msg=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Check the form.")}` as Route,
    );
  }
  const data = parsed.data;

  // Ten an hour per connection: generous for a person, useless for a script filling our list.
  if (!(await withinRateLimit("destination-alert", 10, 3600))) {
    redirect(`${back}?error_msg=${encodeURIComponent(RATE_LIMITED_MESSAGE)}` as Route);
  }

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  const { error } = await sb.from("destination_alerts").insert({
    user_id: user?.id ?? null,
    email: data.email,
    name: data.name ?? null,
    destination_id: data.destinationId ?? null,
    wanted_place: data.wantedPlace ?? null,
    note: data.note ?? null,
    source: data.source,
  });
  // A duplicate is somebody asking twice, which is not an error worth showing them.
  if (error && error.code !== "23505") {
    redirect(`${back}?error_msg=${encodeURIComponent("That didn't save. Try again.")}` as Route);
  }

  revalidatePath(back);
  redirect(
    `${back}?notice=${encodeURIComponent(
      data.wantedPlace
        ? `Noted — we'll tell you if we run something in ${data.wantedPlace}.`
        : "Noted — we'll email you when there's something to say.",
    )}` as Route,
  );
}

export async function stopAlertAction(fd: FormData): Promise<void> {
  const parsed = z.object({ alertId: uuidSchema }).safeParse(formToObject(fd));
  if (!parsed.success) redirect("/account" as Route);

  const sb = await createClient();
  // The row stays: somebody wanting to stop the email does not make it untrue that they asked, and
  // deleting it would quietly erase the demand signal along with the subscription.
  await sb
    .from("destination_alerts")
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq("id", parsed.data.alertId);

  revalidatePath("/account");
  redirect("/account?notice=Stopped.#saved" as Route);
}
