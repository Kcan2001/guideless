import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/nav";
import { requireStaff } from "@/lib/auth/staff";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { default: "Operations", template: "%s · Guideless Ops" },
  robots: { index: false, follow: false },
};

/**
 * Every /admin route passes through here: signed in AND holds at least one staff role.
 * Page-level actions narrow further (content vs ops vs finance). RLS is the real boundary.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const ctx = await requireStaff();
  return (
    <div className="flex min-h-screen flex-col bg-cloud lg:flex-row">
      <AdminNav email={ctx.user.email ?? null} roles={ctx.roles} />
      <main className="flex-1 px-6 py-8 lg:px-10">{children}</main>
    </div>
  );
}
