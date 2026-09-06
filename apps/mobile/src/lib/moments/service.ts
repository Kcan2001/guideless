import type { Tables, Views } from "@guideless/types";
import { zonedToUtc } from "@guideless/utils";
import { supabase } from "@/lib/supabase";

export type LiveMoment = Tables<"live_moments">;

export interface MomentWithState extends LiveMoment {
  joined: number;
  mine: "joined" | "maybe" | "left" | null;
}

/**
 * Live Moments (spec §24): temporary, optional gatherings. Staff create "official" ones; any
 * traveler can suggest one. RLS keeps them trip-scoped; drafts and staff_only are never returned.
 */
export const momentsService = {
  async list(tripId: string, userId: string): Promise<MomentWithState[]> {
    const since = new Date(Date.now() - 6 * 3600_000).toISOString();
    const [{ data: moments, error }, { data: counts }, { data: mine }] = await Promise.all([
      supabase
        .from("live_moments")
        .select("*")
        .eq("trip_id", tripId)
        .in("status", ["scheduled", "live"])
        .gte("start_at", since)
        .order("start_at"),
      supabase.from("live_moment_counts").select("*"),
      supabase.from("live_moment_participants").select("moment_id, status").eq("user_id", userId),
    ]);
    if (error) throw error;
    const countById = new Map(
      (counts ?? []).map((c: Views<"live_moment_counts">) => [c.moment_id, c.joined ?? 0]),
    );
    const mineById = new Map(
      (mine ?? []).map((m) => [m.moment_id, m.status as MomentWithState["mine"]]),
    );
    return (moments ?? []).map((m) => ({
      ...m,
      joined: countById.get(m.id) ?? 0,
      mine: mineById.get(m.id) ?? null,
    }));
  },

  async join(momentId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from("live_moment_participants")
      .upsert(
        { moment_id: momentId, user_id: userId, status: "joined" },
        { onConflict: "moment_id,user_id" },
      );
    if (error) throw error;
  },

  async leave(momentId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from("live_moment_participants")
      .upsert(
        { moment_id: momentId, user_id: userId, status: "left" },
        { onConflict: "moment_id,user_id" },
      );
    if (error) throw error;
  },

  /** Traveler-suggested moment. `date` "YYYY-MM-DD" and `time` "HH:mm" are local to `timezone`. */
  async create(input: {
    tripId: string;
    userId: string;
    title: string;
    description?: string;
    date: string;
    time: string;
    timezone: string;
    locationName?: string;
    capacity?: number | null;
  }): Promise<LiveMoment> {
    const startAt = zonedToUtc(input.date, input.time, input.timezone);
    const { data, error } = await supabase
      .from("live_moments")
      .insert({
        trip_id: input.tripId,
        created_by: input.userId,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        start_at: startAt.toISOString(),
        timezone: input.timezone,
        location_name: input.locationName?.trim() || null,
        capacity: input.capacity ?? null,
        status: "scheduled",
        visibility: "trip_member",
        is_official: false,
      })
      .select("*")
      .single();
    if (error) throw error;
    // The creator is going, obviously.
    await momentsService.join(data.id, input.userId);
    return data;
  },

  subscribe(tripId: string, onChange: () => void) {
    return supabase
      .channel(`moments:${tripId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_moments", filter: `trip_id=eq.${tripId}` },
        onChange,
      )
      .subscribe();
  },
};
