import "server-only";

import {
  POST_FROM_HOUR,
  POST_UNTIL_HOUR,
  composePost,
  localClock,
  type FreeActivity,
} from "@/lib/assistant/schedule";
import { createServiceRoleClient } from "@/lib/supabase/server";

export { POST_FROM_HOUR, POST_UNTIL_HOUR, composePost } from "@/lib/assistant/schedule";

/**
 * The morning post: what is free today, who it is for, where to meet.
 *
 * Written rather than generated. A language model is not needed to list three itinerary rows, and
 * using one here would add cost, latency and a way for the most-read message on the trip to come
 * out wrong. The assistant's judgement belongs in the private conversation; the group room gets
 * facts.
 *
 * Every trip runs on its own clock. A run at 05:00 UTC is 07:00 in Nice and 06:00 in London, so
 * each trip is checked against its own local hour and only posted to inside its morning window.
 * That means the cron can fire hourly and still post to each group exactly once, in their morning.
 */

export interface GroupPostResult {
  tripsConsidered: number;
  posted: number;
  skippedAlreadyPosted: number;
  skippedNothingFree: number;
  skippedOutsideWindow: number;
  failures: Array<{ tripId: string; error: string }>;
}

/**
 * Post for every trip whose local morning it is. Safe to call repeatedly: the unique key on
 * (trip_id, post_date) means a second run inserts nothing and posts nothing.
 */
export async function postFreeActivities(now = new Date()): Promise<GroupPostResult> {
  const service = createServiceRoleClient();
  const result: GroupPostResult = {
    tripsConsidered: 0,
    posted: 0,
    skippedAlreadyPosted: 0,
    skippedNothingFree: 0,
    skippedOutsideWindow: 0,
    failures: [],
  };

  // A trip can be "today" on either side of the date line relative to UTC, so both UTC days are
  // considered and each trip's own clock decides which of them is its today.
  const utcToday = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
  const candidates = new Map<string, { roomId: string; timezone: string; name: string }>();

  for (const date of [yesterday, utcToday]) {
    const { data, error } = await service.rpc("trips_running_on", { p_date: date });
    if (error) throw error;
    for (const row of data ?? []) {
      candidates.set(row.trip_id, {
        roomId: row.room_id,
        timezone: row.timezone,
        name: row.trip_name,
      });
    }
  }

  for (const [tripId, trip] of candidates) {
    result.tripsConsidered += 1;
    const clock = localClock(trip.timezone, now);
    const hour = Number(clock.time.slice(0, 2));
    if (hour < POST_FROM_HOUR || hour >= POST_UNTIL_HOUR) {
      result.skippedOutsideWindow += 1;
      continue;
    }

    try {
      // Claim the day first. Posting and then recording would double-post if the insert failed
      // after the message went out, and a duplicate is the failure people actually notice.
      const { error: claimError } = await service
        .from("assistant_group_posts")
        .insert({ trip_id: tripId, post_date: clock.date, item_count: 0 });
      if (claimError) {
        // 23505 is the guard doing its job, not a fault.
        if (claimError.code === "23505") result.skippedAlreadyPosted += 1;
        else result.failures.push({ tripId, error: claimError.message });
        continue;
      }

      const { data: activities, error: actError } = await service.rpc("free_activities_on", {
        p_trip_id: tripId,
        p_date: clock.date,
      });
      if (actError) throw actError;
      if (!activities || activities.length === 0) {
        // The day is claimed and nothing was posted, which is right: a day with nothing free
        // should stay silent, and should not be reconsidered every hour until midnight.
        result.skippedNothingFree += 1;
        continue;
      }

      const { data: message, error: msgError } = await service
        .from("messages")
        .insert({
          room_id: trip.roomId,
          sender_id: null,
          is_system: true,
          body: composePost(activities as FreeActivity[]),
        })
        .select("id")
        .single();
      if (msgError) throw msgError;

      await service
        .from("assistant_group_posts")
        .update({ message_id: message.id, item_count: activities.length })
        .eq("trip_id", tripId)
        .eq("post_date", clock.date);

      result.posted += 1;
    } catch (err) {
      result.failures.push({ tripId, error: err instanceof Error ? err.message : "failed" });
    }
  }

  return result;
}
