"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isoDateSchema, uuidSchema } from "@guideless/validation";
import { dbErrorMessage, flash, parseForm } from "@/lib/admin/form";
import { OPS_ROLES, requireStaff } from "@/lib/auth/staff";
import {
  fetchAndCacheOptions,
  importOptionAsAddOn,
  searchAndCacheProducts,
} from "@/lib/experiences/sourcing";

/**
 * Sourcing extras from a supplier instead of typing them out.
 *
 * Ops roles, because importing creates something sellable on a public page. Everything writes
 * through the service modules, which run as the staff user — the staff-only policies on the
 * sourcing tables are the boundary, not these functions.
 */

const BACK = "/admin/experiences";

const searchSchema = z.object({
  query: z.string().trim().max(120).optional(),
  destinationId: uuidSchema.optional(),
});

const optionsSchema = z.object({
  productId: uuidSchema,
  travelDate: isoDateSchema,
});

const importSchema = z.object({
  departureId: uuidSchema,
  productId: uuidSchema,
  supplierOptionId: z.string().trim().min(1).max(200),
  travelDate: isoDateSchema,
  /** Major units in the form, minor units in the database — never a float anywhere near money. */
  price: z.coerce.number().min(0).max(100000),
  title: z.string().trim().max(120).optional(),
  dayNumber: z.coerce.number().int().min(1).max(60).optional(),
});

export async function searchExperiencesAction(fd: FormData): Promise<void> {
  await requireStaff(OPS_ROLES);
  const parsed = parseForm(searchSchema, fd);
  if (!parsed.ok) flash(BACK, "error", parsed.error);

  try {
    const results = await searchAndCacheProducts({
      query: parsed.data.query,
      destinationId: parsed.data.destinationId,
    });
    revalidatePath(BACK);
    const params = new URLSearchParams();
    if (parsed.data.query) params.set("q", parsed.data.query);
    if (parsed.data.destinationId) params.set("destination", parsed.data.destinationId);
    params.set("ok", `${results.length} experience${results.length === 1 ? "" : "s"} found.`);
    flash(`${BACK}?${params.toString()}`, "ok", "");
  } catch (err) {
    flash(BACK, "error", err instanceof Error ? err.message : "The supplier search failed.");
  }
}

export async function refreshOptionsAction(fd: FormData): Promise<void> {
  await requireStaff(OPS_ROLES);
  const parsed = parseForm(optionsSchema, fd);
  if (!parsed.ok) flash(BACK, "error", parsed.error);

  try {
    const options = await fetchAndCacheOptions(parsed.data.productId, parsed.data.travelDate);
    revalidatePath(BACK);
    flash(
      `${BACK}?product=${parsed.data.productId}&date=${parsed.data.travelDate}`,
      "ok",
      options.length === 0
        ? "The supplier has nothing bookable on that date."
        : `${options.length} option${options.length === 1 ? "" : "s"} priced for ${parsed.data.travelDate}.`,
    );
  } catch (err) {
    flash(BACK, "error", err instanceof Error ? err.message : "Could not price that experience.");
  }
}

export async function importExperienceAction(fd: FormData): Promise<void> {
  await requireStaff(OPS_ROLES);
  const parsed = parseForm(importSchema, fd);
  if (!parsed.ok) flash(BACK, "error", parsed.error);
  const data = parsed.data;

  try {
    const result = await importOptionAsAddOn({
      departureId: data.departureId,
      productId: data.productId,
      supplierOptionId: data.supplierOptionId,
      travelDate: data.travelDate,
      priceAmount: Math.round(data.price * 100),
      title: data.title,
      dayNumber: data.dayNumber ?? null,
    });
    revalidatePath(BACK);
    revalidatePath(`/admin/departures/${data.departureId}`);
    // Imported off, on purpose: the description is the supplier's marketing copy and it is about to
    // sit on a public tour page. Somebody reads it first.
    flash(
      `/admin/departures/${data.departureId}`,
      "ok",
      `Added “${result.title}” as a hidden add-on. Read the copy, then switch it on.`,
    );
  } catch (err) {
    flash(BACK, "error", err instanceof Error ? err.message : dbErrorMessage(null));
  }
}
