import { NextResponse, type NextRequest } from "next/server";
import { getDepartureManifest } from "@/lib/admin/ops";
import { missingDetails, sharingWith } from "@/lib/admin/manifest";
import { requireStaff } from "@/lib/auth/staff";

export const dynamic = "force-dynamic";

function cell(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** The full departure manifest as CSV, for a hotel or a coach company. Staff only. */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/admin/departures/[id]/manifest/csv">,
) {
  await requireStaff();
  const { id } = await ctx.params;
  const data = await getDepartureManifest(id);
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });

  const head = [
    "Traveler",
    "Preferred name",
    "Booking",
    "Lead",
    "Room",
    "Sharing with",
    "Stay tier",
    "Email",
    "Phone",
    "Date of birth",
    "Nationality",
    "Dietary",
    "Accessibility",
    "Airport transfer",
    "Add-ons",
    "Documents",
    "Missing",
  ];
  const lines = [
    head.join(","),
    ...data.travelers.map((t) =>
      [
        t.name,
        t.preferredName,
        t.confirmationNumber,
        t.isLead ? "yes" : "",
        t.roomIndex,
        sharingWith(t, data.rooming.rooms),
        t.stayName,
        t.email,
        t.phone,
        t.dateOfBirth,
        t.nationality,
        t.dietary,
        t.accessibility,
        t.airportTransfer,
        t.addOns.join("; "),
        t.documentCount,
        missingDetails(t).join("; "),
      ]
        .map(cell)
        .join(","),
    ),
  ];
  const slug = data.tour.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  // Byte-order mark so Excel opens the accented names correctly.
  return new NextResponse(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="manifest-${slug}-${data.departure.start_date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
