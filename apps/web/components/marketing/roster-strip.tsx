import { CalendarCheck, Globe2, Users } from "lucide-react";
import { formatDate } from "@guideless/utils";
import type { RosterStats } from "@/lib/data/extras";
import { cn } from "@/lib/utils";

/**
 * Anonymized roster ("11 booked · 5 travelling solo · 3 pairs · from 4 countries · ages 30–45").
 * Never names. Zero and null parts are hidden; below two bookings only the group-open date shows.
 */
export function RosterStrip({
  stats,
  className,
}: {
  stats: RosterStats | null;
  className?: string;
}) {
  if (!stats) return null;
  const parts: string[] = [];
  if (stats.booked > 0) parts.push(`${stats.booked} booked`);
  if (stats.solo > 0) parts.push(`${stats.solo} travelling solo`);
  if (stats.pairs > 0) parts.push(`${stats.pairs} ${stats.pairs === 1 ? "pair" : "pairs"}`);
  if (stats.groups > 0)
    parts.push(`${stats.groups} small ${stats.groups === 1 ? "group" : "groups"}`);
  if (stats.countries > 1) parts.push(`from ${stats.countries} countries`);
  if (stats.ageMin != null && stats.ageMax != null)
    parts.push(`ages ${stats.ageMin}–${stats.ageMax}`);

  return (
    <div
      className={cn("rounded border border-aqua/60 bg-aqua/10 p-4 text-sm", className)}
      data-testid="roster-strip"
    >
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Users className="h-4 w-4 text-teal" aria-hidden />
        <span className="font-medium">Your Group</span>
        {parts.length > 0 ? (
          <span className="text-muted-foreground">· {parts.join(" · ")}</span>
        ) : (
          <span className="text-muted-foreground">· first to book sets the tone</span>
        )}
      </p>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
        {stats.groupOpen ? (
          <>
            <Globe2 className="h-4 w-4 text-teal" aria-hidden />
            <span>The group is open: chat, roster and Live Moments are live in the app.</span>
          </>
        ) : (
          <>
            <CalendarCheck className="h-4 w-4 text-teal" aria-hidden />
            <span>
              Your group opens on {formatDate(stats.groupOpensOn)}. Until then, nobody sees who else
              booked.
            </span>
          </>
        )}
        {stats.spotsLeft > 0 && stats.spotsLeft <= 10 && (
          <span className="text-foreground">· {stats.spotsLeft} spots left</span>
        )}
      </p>
    </div>
  );
}
