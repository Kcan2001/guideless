import { NextResponse, type NextRequest } from "next/server";
import { getAddOnManifest } from "@/lib/admin/queries";
import { requireStaff } from "@/lib/auth/staff";

export const dynamic = "force-dynamic";

function cell(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Manifest as CSV for the supplier. Staff only; RLS scopes the rows either way. */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/admin/departures/[id]/add-ons/[addOnId]/csv">,
) {
  await requireStaff();
  const { id, addOnId } = await ctx.params;
  const data = await getAddOnManifest(id, addOnId);
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });

  const head = [
    "Traveler",
    "Booking",
    "Quantity",
    "Status",
    "Dietary",
    "Accessibility",
    "Email",
    "Paid",
    "Currency",
    "Added",
  ];
  const lines = [
    head.join(","),
    ...data.manifest.map((m) =>
      [
        m.traveler_name ?? "Whole booking",
        m.confirmation_number,
        m.quantity,
        m.status,
        m.dietary_requirements,
        m.accessibility_notes,
        m.customer_email,
        (m.total_amount / 100).toFixed(2),
        m.currency,
        m.created_at.slice(0, 10),
      ]
        .map(cell)
        .join(","),
    ),
  ];
  const slug = data.addOn.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return new NextResponse(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="manifest-${slug}-${data.departure.start_date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
