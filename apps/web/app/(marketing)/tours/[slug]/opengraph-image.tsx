import { ImageResponse } from "next/og";
import { brand } from "@guideless/config";
import { formatMoney } from "@guideless/utils";
import { getTourBySlug } from "@/lib/data/tours";
import { tourFromPrice } from "@/lib/data/tour-filters";

export const alt = "Guideless trip";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Per-tour social card: route, name, duration, from-price. Falls back to the brand card. */
export default async function TourOpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const detail = await getTourBySlug(slug);
  const title = detail?.tour.name ?? brand.name;
  const route = detail?.route.map((r) => r.destination.name).join("  →  ") ?? brand.tagline;
  const price = detail
    ? tourFromPrice({
        tour: detail.tour,
        version: detail.version,
        destinations: detail.route.map((r) => r.destination),
        departures: detail.departures,
      })
    : null;
  const meta = detail
    ? [
        `${detail.tour.duration_days} days`,
        `${detail.tour.group_size_min}–${detail.tour.group_size_max} travelers`,
        price ? `from ${formatMoney(price, { compact: true })}` : null,
      ]
        .filter(Boolean)
        .join("   ·   ")
    : "";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        padding: 72,
        background: "linear-gradient(135deg, #1B424B 0%, #0B2025 60%)",
        color: "#F5F6F2",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <svg
        width="1200"
        height="630"
        viewBox="0 0 1200 630"
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <path
          d="M 80 360 C 320 360, 320 200, 560 200 S 800 400, 1120 280"
          fill="none"
          stroke="#60E1BB"
          strokeWidth="6"
          strokeDasharray="2 22"
          strokeLinecap="round"
        />
        <circle cx="80" cy="360" r="14" fill="#60E1BB" />
        <circle cx="560" cy="200" r="14" fill="#60E1BB" />
        <circle cx="1120" cy="280" r="14" fill="#17B1DF" />
      </svg>
      <div
        style={{
          fontSize: 24,
          letterSpacing: 6,
          textTransform: "uppercase",
          color: "#60E1BB",
          marginBottom: 20,
        }}
      >
        {route}
      </div>
      <div style={{ fontSize: 96, fontWeight: 800, lineHeight: 1.0, letterSpacing: -3 }}>
        {title}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 32,
          fontSize: 30,
          color: "rgba(245,246,242,0.85)",
        }}
      >
        <span>{meta}</span>
        <span>{brand.name}</span>
      </div>
    </div>,
    size,
  );
}
