import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A rating, drawn once and read the same way everywhere. The number is the accessible label —
 * five identical icons are meaningless to a screen reader — and it is never rendered for a
 * rating of zero, because a tour with no reviews shows no rating at all.
 */
export function Stars({
  rating,
  size = "sm",
  className,
}: {
  rating: number;
  size?: "sm" | "lg";
  className?: string;
}) {
  const rounded = Math.round(rating);
  const px = size === "lg" ? "h-5 w-5" : "h-4 w-4";
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      role="img"
      aria-label={`${rating} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(px, n <= rounded ? "fill-teal text-teal" : "text-border")}
          aria-hidden
        />
      ))}
    </span>
  );
}
