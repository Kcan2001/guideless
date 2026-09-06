import { ImageResponse } from "next/og";
import { brand } from "@guideless/config";

export const alt = `${brand.name} — ${brand.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Default social card: ink ground, aqua route line, the tagline. */
export default function OpenGraphImage() {
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
          d="M 80 380 C 320 380, 320 220, 560 220 S 800 420, 1120 300"
          fill="none"
          stroke="#60E1BB"
          strokeWidth="6"
          strokeDasharray="2 22"
          strokeLinecap="round"
        />
        <circle cx="80" cy="380" r="14" fill="#60E1BB" />
        <circle cx="560" cy="220" r="14" fill="#60E1BB" />
        <circle cx="1120" cy="300" r="14" fill="#17B1DF" />
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
        Minimal intervention travel
      </div>
      <div
        style={{
          fontSize: 84,
          fontWeight: 800,
          lineHeight: 1.02,
          letterSpacing: -2,
          maxWidth: 1000,
        }}
      >
        {brand.tagline}
      </div>
      <div style={{ fontSize: 32, marginTop: 28, color: "rgba(245,246,242,0.8)" }}>
        {brand.name}
      </div>
    </div>,
    size,
  );
}
