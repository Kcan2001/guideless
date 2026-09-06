import "server-only";

import type { Route } from "next";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { Role } from "@guideless/types";
import { createClient } from "@/lib/supabase/server";

/** Role groups mirroring the SQL helpers (is_content_staff, is_ops_staff, …). */
export const CONTENT_ROLES: Role[] = ["content_editor", "admin", "super_admin"];
export const OPS_ROLES: Role[] = ["trip_staff", "finance", "admin", "super_admin"];
export const FINANCE_ROLES: Role[] = ["finance", "admin", "super_admin"];
export const SUPPORT_ROLES: Role[] = ["support", "trip_staff", "admin", "super_admin"];
export const ADMIN_ROLES: Role[] = ["admin", "super_admin"];

export interface StaffContext {
  user: User;
  roles: Role[];
  can: (allowed: Role[]) => boolean;
}

/** Signed-in user plus their staff roles (from user_roles, readable by the user under RLS). */
export async function getStaffContext(): Promise<StaffContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  if (error) throw error;
  const roles = data.map((r) => r.role as Role);
  if (roles.length === 0) return null;
  return { user, roles, can: (allowed) => allowed.some((r) => roles.includes(r)) };
}

/**
 * Gate for /admin pages and actions. Redirects visitors to sign in, and non-staff / under-privileged
 * staff to a clear "no access" page. Database RLS remains the real boundary; this is UX.
 */
export async function requireStaff(allowed?: Role[], nextPath = "/admin"): Promise<StaffContext> {
  const ctx = await getStaffContext();
  if (!ctx) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
    redirect("/no-access"); // outside /admin so the layout gate cannot loop
  }
  if (allowed && !ctx.can(allowed))
    redirect(
      ("/admin?error=" + encodeURIComponent("You don't have permission for that.")) as Route,
    );
  return ctx;
}
