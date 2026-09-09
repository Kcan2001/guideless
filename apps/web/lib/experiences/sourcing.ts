import "server-only";

import type { AddOnKind, Currency } from "@guideless/types";
import { getExperienceSupplier } from "@/lib/experiences";
import type { ExperienceOption, ExperienceProduct } from "@/lib/experiences/types";
import { createClient } from "@/lib/supabase/server";

/**
 * Searching a supplier, caching what it says, and turning one of its products into something we
 * sell. This is the half of item 7 that actually removes work: the extras catalog stops being
 * hand-typed per departure.
 *
 * Everything here runs as the signed-in staff user, so the staff-only policies on
 * `experience_products`, `experience_rates` and `add_on_sourcing` are the real boundary. A
 * non-staff caller gets empty results rather than a leak, and the customer-facing
 * `departure_add_ons` row it produces carries no supplier information at all.
 */

export interface StoredProduct {
  id: string;
  supplier: string;
  supplierProductId: string;
  title: string;
  description: string | null;
  durationMinutes: number | null;
  supplierCategories: string[];
  address: string | null;
  rating: number | null;
  ratingCount: number | null;
  fromAmount: number | null;
  currency: Currency | null;
  destinationId: string | null;
}

/**
 * Search the supplier and cache what comes back, so the admin screen can page through results
 * without a billed call per keystroke and so an import has a stable row to point at.
 */
export async function searchAndCacheProducts(input: {
  query?: string;
  destinationId?: string;
  latitude?: number;
  longitude?: number;
  limit?: number;
}): Promise<StoredProduct[]> {
  const sb = await createClient();
  const supplier = getExperienceSupplier();

  const found = await supplier.search({
    query: input.query,
    latitude: input.latitude,
    longitude: input.longitude,
    limit: input.limit ?? 20,
  });
  if (found.length === 0) return [];

  const rows = found.map((p: ExperienceProduct) => ({
    supplier: supplier.id,
    supplier_product_id: p.supplierProductId,
    destination_id: input.destinationId ?? null,
    title: p.title,
    description: p.description,
    duration_minutes: p.durationMinutes,
    supplier_categories: p.supplierCategories,
    image_url: p.imageUrl,
    address: p.address,
    latitude: p.latitude,
    longitude: p.longitude,
    rating: p.rating,
    rating_count: p.ratingCount,
    from_amount: p.fromAmount,
    currency: p.currency,
    fetched_at: new Date().toISOString(),
  }));

  const { data, error } = await sb
    .from("experience_products")
    .upsert(rows, { onConflict: "supplier,supplier_product_id" })
    .select(
      "id, supplier, supplier_product_id, title, description, duration_minutes, " +
        "supplier_categories, address, rating, rating_count, from_amount, currency, destination_id",
    );
  if (error) throw error;

  return ((data ?? []) as unknown as StoredRow[]).map(toStored);
}

/** Options for a product on a date, cached as rates so a price can be traced to a quote. */
export async function fetchAndCacheOptions(
  productId: string,
  travelDate: string,
): Promise<ExperienceOption[]> {
  const sb = await createClient();
  const supplier = getExperienceSupplier();

  const { data: product, error } = await sb
    .from("experience_products")
    .select("id, supplier_product_id")
    .eq("id", productId)
    .maybeSingle();
  if (error) throw error;
  if (!product) return [];

  const options = await supplier.getOptions(product.supplier_product_id, travelDate);
  if (options.length === 0) return [];

  const { error: insertError } = await sb.from("experience_rates").insert(
    options.map((o) => ({
      product_id: productId,
      supplier: supplier.id,
      supplier_option_id: o.supplierOptionId,
      option_name: o.name,
      travel_date: o.travelDate,
      start_time: o.startTime,
      currency: o.currency,
      net_amount: o.netAmount,
      total_amount: o.totalAmount,
      capacity: o.capacity,
      available: o.available,
      cancellation_policy: { ladder: o.cancellationPolicy },
      fetched_at: new Date().toISOString(),
    })),
  );
  if (insertError) throw insertError;

  return options;
}

export interface ImportResult {
  addOnId: string;
  title: string;
  priceAmount: number;
}

/**
 * Turn a supplier option into a sellable add-on on a departure.
 *
 * Two rows are written and the split between them is the point: the public `departure_add_ons`
 * row, which anon can read and which contains nothing about where it came from, and the
 * `add_on_sourcing` row, which holds the supplier, the option id and what it costs us.
 *
 * The price is passed in rather than computed. `suggest_experience_price` offers the supplier's own
 * public price — we match it and earn the partner commission, because a traveler can check the same
 * activity in one search and finding it cheaper elsewhere is corrosive. A person still confirms.
 *
 * Imports land `in_trip_only`: sourced activities belong in Explore and the assistant, where the
 * free time is, not in the pre-sale extras list next to the things we negotiated ourselves.
 */
export async function importOptionAsAddOn(input: {
  departureId: string;
  productId: string;
  supplierOptionId: string;
  travelDate: string;
  priceAmount: number;
  title?: string;
  kind?: AddOnKind;
  dayNumber?: number | null;
}): Promise<ImportResult> {
  const sb = await createClient();

  const [{ data: product }, { data: rate }] = await Promise.all([
    sb
      .from("experience_products")
      .select("id, supplier, title, description, address, latitude, longitude, duration_minutes")
      .eq("id", input.productId)
      .maybeSingle(),
    sb
      .from("experience_rates")
      .select("id, supplier_option_id, option_name, start_time, currency, net_amount, available")
      .eq("product_id", input.productId)
      .eq("supplier_option_id", input.supplierOptionId)
      .eq("travel_date", input.travelDate)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!product) throw new Error("That experience is not in the catalog any more.");
  if (!rate) throw new Error("No price for that option on that date. Refresh the options first.");
  // Importing something the supplier already says is unavailable would put a dead extra on a tour
  // page, which is worse than not importing it.
  if (!rate.available) throw new Error("The supplier says that option is not available.");
  if (input.priceAmount < rate.net_amount) {
    throw new Error(
      `That price is below what it costs us (${rate.net_amount}). Set a higher price or don't sell it.`,
    );
  }

  const { data: addOn, error: addOnError } = await sb
    .from("departure_add_ons")
    .insert({
      departure_id: input.departureId,
      title: input.title?.trim() || product.title,
      description: product.description,
      kind: input.kind ?? "activity",
      price_amount: input.priceAmount,
      currency: rate.currency,
      pricing_basis: "per_traveler",
      day_number: input.dayNumber ?? null,
      start_time: rate.start_time,
      location_name: product.address,
      latitude: product.latitude,
      longitude: product.longitude,
      // In the trip, not the shop: Explore and the assistant, never the public tour page.
      in_trip_only: true,
      // Off until a person has read it. An imported description is the supplier's marketing copy.
      is_active: false,
    })
    .select("id, title, price_amount")
    .single();
  if (addOnError) throw addOnError;

  const { error: sourcingError } = await sb.from("add_on_sourcing").insert({
    add_on_id: addOn.id,
    product_id: input.productId,
    supplier: product.supplier,
    supplier_option_id: input.supplierOptionId,
    net_amount: rate.net_amount,
    currency: rate.currency,
    source_rate_id: rate.id,
    last_checked_at: new Date().toISOString(),
  });
  if (sourcingError) {
    // An add-on with no sourcing row is an add-on nobody can trace or recheck. Undo rather than
    // leave that behind — there is no payment involved, so removing it is safe.
    await sb.from("departure_add_ons").delete().eq("id", addOn.id);
    throw sourcingError;
  }

  return { addOnId: addOn.id, title: addOn.title, priceAmount: addOn.price_amount };
}

/** A column list built by concatenation is opaque to the generated select types, so name it. */
interface StoredRow {
  id: string;
  supplier: string;
  supplier_product_id: string;
  title: string;
  description: string | null;
  duration_minutes: number | null;
  supplier_categories: string[];
  address: string | null;
  rating: number | null;
  rating_count: number | null;
  from_amount: number | null;
  currency: string | null;
  destination_id: string | null;
}

function toStored(row: StoredRow): StoredProduct {
  return {
    id: row.id,
    supplier: row.supplier,
    supplierProductId: row.supplier_product_id,
    title: row.title,
    description: row.description,
    durationMinutes: row.duration_minutes,
    supplierCategories: row.supplier_categories,
    address: row.address,
    rating: row.rating,
    ratingCount: row.rating_count,
    fromAmount: row.from_amount,
    currency: row.currency as Currency | null,
    destinationId: row.destination_id,
  };
}
