import { cn } from "@/lib/utils";

/**
 * Decorative "the road is there, nobody is forcing you down it" artwork. Stands in for destination
 * photography until real imagery lands; also used as a card placeholder. Purely presentational.
 */
export function RouteArt({
  className,
  stops = 3,
  tone = "ink",
}: {
  className?: string;
  stops?: number;
  tone?: "ink" | "sand";
}) {
  const count = Math.max(2, Math.min(stops, 6));
  const xs = Array.from({ length: count }, (_, i) => 60 + (i * 680) / (count - 1));
  const ys = xs.map((_, i) => 200 + Math.sin(i * 1.7) * 60);
  const path = xs
    .map((x, i) => {
      if (i === 0) return `M ${x} ${ys[0]}`;
      const px = xs[i - 1]!;
      const py = ys[i - 1]!;
      const cx = (px + x) / 2;
      return `C ${cx} ${py}, ${cx} ${ys[i]}, ${x} ${ys[i]}`;
    })
    .join(" ");

  const isInk = tone === "ink";
  return (
    <svg
      viewBox="0 0 800 400"
      role="presentation"
      aria-hidden="true"
      className={cn("h-full w-full", isInk ? "bg-ink" : "bg-sand", className)}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <radialGradient id="ra-glow" cx="30%" cy="20%" r="80%">
          <stop offset="0%" stopColor={isInk ? "#1B424B" : "#F5F6F2"} />
          <stop offset="100%" stopColor={isInk ? "#0B2025" : "#DAD9D0"} />
        </radialGradient>
      </defs>
      <rect width="800" height="400" fill="url(#ra-glow)" />
      {/* faint coordinate grid */}
      {Array.from({ length: 7 }, (_, i) => (
        <line
          key={`v${i}`}
          x1={100 * (i + 1)}
          y1="0"
          x2={100 * (i + 1)}
          y2="400"
          stroke={isInk ? "#F5F6F2" : "#0B2025"}
          strokeOpacity="0.06"
        />
      ))}
      {Array.from({ length: 3 }, (_, i) => (
        <line
          key={`h${i}`}
          x1="0"
          y1={100 * (i + 1)}
          x2="800"
          y2={100 * (i + 1)}
          stroke={isInk ? "#F5F6F2" : "#0B2025"}
          strokeOpacity="0.06"
        />
      ))}
      {/* route */}
      <path
        d={path}
        fill="none"
        stroke="#60E1BB"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="1 14"
      />
      <path d={path} fill="none" stroke="#60E1BB" strokeWidth="1.5" strokeOpacity="0.5" />
      {xs.map((x, i) => (
        <g key={x}>
          <circle cx={x} cy={ys[i]} r="14" fill="#60E1BB" fillOpacity="0.18" />
          <circle cx={x} cy={ys[i]} r="6" fill={i === count - 1 ? "#17B1DF" : "#60E1BB"} />
        </g>
      ))}
    </svg>
  );
}
