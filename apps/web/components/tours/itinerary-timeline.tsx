import {
  BedDouble,
  CarFront,
  Flag,
  LogIn,
  LogOut,
  MapPin,
  Plane,
  Sparkles,
  Star,
  Sun,
  TrainFront,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import type { ItineraryItemType } from "@guideless/types";
import { formatWallTime } from "@guideless/utils";
import { Badge } from "@/components/ui/badge";
import type { TourDetail } from "@/lib/data/tours";
import { cn } from "@/lib/utils";

const ICONS: Record<ItineraryItemType, LucideIcon> = {
  hotel: BedDouble,
  transfer: CarFront,
  train: TrainFront,
  flight: Plane,
  activity: Sparkles,
  meal: UtensilsCrossed,
  free_time: Sun,
  recommendation: Star,
  meeting_point: MapPin,
  check_in: LogIn,
  check_out: LogOut,
  live_moment: Sparkles,
  custom: Flag,
};

const TYPE_LABEL: Record<ItineraryItemType, string> = {
  hotel: "Hotel",
  transfer: "Transfer",
  train: "Train",
  flight: "Flight",
  activity: "Experience",
  meal: "Meal",
  free_time: "Free time",
  recommendation: "Recommendation",
  meeting_point: "Meeting point",
  check_in: "Check-in",
  check_out: "Check-out",
  live_moment: "Live Moment",
  custom: "Note",
};

function timeLabel(start: string | null, end: string | null): string | null {
  if (start && end) return `${formatWallTime(start)} – ${formatWallTime(end)}`;
  if (start) return formatWallTime(start);
  if (end) return `by ${formatWallTime(end)}`;
  return null;
}

export function ItineraryTimeline({ days }: { days: TourDetail["days"] }) {
  return (
    <ol className="space-y-10">
      {days.map((day) => (
        <li key={day.id} id={`day-${day.day_number}`} className="scroll-mt-24">
          <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="font-heading text-sm font-semibold uppercase tracking-[0.18em] text-link">
              Day {day.day_number}
            </span>
            {day.destination && (
              <span className="text-sm text-muted-foreground">{day.destination.name}</span>
            )}
            <h3 className="basis-full text-2xl ">{day.title}</h3>
            {day.summary && <p className="basis-full text-muted-foreground">{day.summary}</p>}
          </header>

          <ol className="mt-5 border-l-2 border-border pl-6">
            {day.items.map((item) => {
              const Icon = ICONS[item.type];
              const isFree = item.type === "free_time";
              const time = timeLabel(item.start_time, item.end_time);
              return (
                <li key={item.id} className="relative pb-6 last:pb-0">
                  <span
                    aria-hidden
                    className={cn(
                      "absolute -left-[31px] top-1 flex h-7 w-7 items-center justify-center rounded-full border-2 bg-surface",
                      isFree ? "border-aqua text-ink" : "border-border text-muted-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div
                    className={cn(
                      "rounded border p-4",
                      isFree ? "border-dashed border-aqua bg-aqua/10" : "border-border bg-surface",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {time && <time className="font-medium text-foreground">{time}</time>}
                      <span>{TYPE_LABEL[item.type]}</span>
                      {item.is_optional && <Badge variant="optional">Optional</Badge>}
                      <Badge
                        variant={item.responsibility === "guideless" ? "guideless" : "traveler"}
                      >
                        {item.responsibility === "guideless" ? "Guideless handles" : "You book"}
                      </Badge>
                    </div>
                    <p className="mt-1.5 font-semibold">{item.title}</p>
                    {item.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                    )}
                    {item.location_name && (
                      <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" aria-hidden /> {item.location_name}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </li>
      ))}
    </ol>
  );
}
