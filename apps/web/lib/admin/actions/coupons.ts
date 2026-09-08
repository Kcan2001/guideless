"use server";

import { revalidatePath } from "next/cache";
import { couponFormSchema, uuidSchema, type CouponForm } from "@guideless/validation";
import { dbErrorMessage, flash, parseForm, returnTo } from "@/lib/admin/form";
import { FINANCE_ROLES, requireStaff } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";

/**
 * Coupon administration (finance roles). Editing a coupon never changes an existing booking:
 * bookings snapshot their discount at purchase, so these actions only affect future redemptions.
 */

const LIST = "/admin/coupons";

function id(fd: FormData, key: string): string {
  const parsed = uuidSchema.safeParse(fd.get(key));
  if (!parsed.success) throw new Error(`Missing or invalid ${key}`);
  return parsed.data;
}

/** Form fields → the column shape, honouring the database's one-kind-only rule. */
function rowFromForm(c: CouponForm) {
  const isPercent = c.kind === "percent";
  return {
    code: c.code,
    description: c.description,
    percent_off: isPercent ? (c.percentOff ?? null) : null,
    amount_off: isPercent ? null : (c.amountOff ?? null),
    currency: isPercent ? null : (c.currency ?? null),
    valid_from: c.validFrom,
    valid_until: c.validUntil,
    max_redemptions: c.maxRedemptions,
    is_active: c.isActive,
  };
}

/** Friendlier than the generic duplicate message, since the code is the thing people retype. */
function couponError(err: { code?: string; message?: string; hint?: string } | null): string {
  if (err?.code === "23505") return "That code is already in use (codes ignore capitalisation).";
  return dbErrorMessage(err);
}

export async function createCouponAction(fd: FormData): Promise<void> {
  await requireStaff(FINANCE_ROLES);
  const parsed = parseForm(couponFormSchema, fd);
  if (!parsed.ok) flash(LIST, "error", parsed.error);
  const sb = await createClient();
  const { error } = await sb.from("coupons").insert(rowFromForm(parsed.data));
  if (error) flash(LIST, "error", couponError(error));
  revalidatePath(LIST);
  flash(LIST, "ok", `${parsed.data.code} created.`);
}

export async function updateCouponAction(fd: FormData): Promise<void> {
  await requireStaff(FINANCE_ROLES);
  const couponId = id(fd, "couponId");
  const to = returnTo(fd, LIST);
  const parsed = parseForm(couponFormSchema, fd);
  if (!parsed.ok) flash(to, "error", parsed.error);

  const sb = await createClient();
  const { data: current, error: readErr } = await sb
    .from("coupons")
    .select("redemptions")
    .eq("id", couponId)
    .maybeSingle();
  if (readErr) flash(to, "error", dbErrorMessage(readErr));
  if (!current) flash(to, "error", "That coupon no longer exists.");
  const max = parsed.data.maxRedemptions;
  if (max !== null && max < current.redemptions)
    flash(
      to,
      "error",
      `It has been redeemed ${current.redemptions} times, so the maximum cannot be lower than that.`,
    );

  const { error } = await sb.from("coupons").update(rowFromForm(parsed.data)).eq("id", couponId);
  if (error) flash(to, "error", couponError(error));
  revalidatePath(LIST);
  flash(to, "ok", `${parsed.data.code} saved. Existing bookings keep the discount they were sold.`);
}

/** Stop a coupon working without touching the bookings that used it. */
export async function setCouponActiveAction(fd: FormData): Promise<void> {
  await requireStaff(FINANCE_ROLES);
  const couponId = id(fd, "couponId");
  const to = returnTo(fd, LIST);
  const active = fd.get("isActive") === "true";
  const sb = await createClient();
  const { error } = await sb.from("coupons").update({ is_active: active }).eq("id", couponId);
  if (error) flash(to, "error", dbErrorMessage(error));
  revalidatePath(LIST);
  flash(
    to,
    "ok",
    active ? "Coupon reactivated." : "Coupon deactivated. Existing bookings keep their discount.",
  );
}

/** Only ever allowed for a coupon nobody has used; otherwise deactivate it. */
export async function deleteCouponAction(fd: FormData): Promise<void> {
  await requireStaff(FINANCE_ROLES);
  const couponId = id(fd, "couponId");
  const to = returnTo(fd, LIST);
  const sb = await createClient();

  const [{ data: coupon, error: readErr }, { count, error: usedErr }] = await Promise.all([
    sb.from("coupons").select("code, redemptions").eq("id", couponId).maybeSingle(),
    sb.from("bookings").select("id", { count: "exact", head: true }).eq("coupon_id", couponId),
  ]);
  if (readErr) flash(to, "error", dbErrorMessage(readErr));
  if (usedErr) flash(to, "error", dbErrorMessage(usedErr));
  if (!coupon) flash(to, "error", "That coupon no longer exists.");
  if (coupon.redemptions > 0 || (count ?? 0) > 0)
    flash(
      to,
      "error",
      "It has been used, so it can only be deactivated — that keeps the history intact.",
    );

  const { error } = await sb.from("coupons").delete().eq("id", couponId);
  if (error) flash(to, "error", dbErrorMessage(error));
  revalidatePath(LIST);
  flash(LIST, "ok", `${coupon.code} deleted.`);
}
