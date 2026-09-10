import "server-only";

import type { BookingQuoteResult, Tables, Views } from "@guideless/types";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";

export type Meetup = Tables<"meetups">;
export type HostApplication = Tables<"host_applications">;

export interface MeetupWithCount extends Meetup {
  going: number;
  /** Already happened (computed server-side so components stay pure). */
  isPast: boolean;
}

/**
 * Room pricing rule for a departure ("own room is the default; two who share each save $350"),
 * derived from the same quote function the checkout uses, so the number can never drift from
 * what the customer is charged. Uses the departure's default stay tier.
 */
export interface RoomRule {
  ownRoomAmount: number;
  sharedRoomAmount: number;
  savingPerTraveler: number;
  currency: string;
}

export async function getRoomRule(departureId: string): Promise<RoomRule | null> {
  const sb = createPublicClient();
  const [own, shared] = await Promise.all([
    sb.rpc("quote_booking", {
      p_departure_id: departureId,
      p_room_indexes: [1],
      p_payment_option: "full",
      p_apply_credit: false,
    }),
    sb.rpc("quote_booking", {
      p_departure_id: departureId,
      p_room_indexes: [1, 1],
      p_payment_option: "full",
      p_apply_credit: false,
    }),
  ]);
  const a = own.data as unknown as BookingQuoteResult | null;
  const b = shared.data as unknown as BookingQuoteResult | null;
  if (!a || !b || a.problems?.length || b.problems?.length) return null;
  const ownRoomAmount = a.base_amount;
  const sharedRoomAmount = Math.round(b.base_amount / 2);
  return {
    ownRoomAmount,
    sharedRoomAmount,
    savingPerTraveler: Math.max(ownRoomAmount - sharedRoomAmount, 0),
    currency: a.currency,
  };
}

// ── Meetups ───────────────────────────────────────────────────────────────────
export async function listUpcomingMeetups(): Promise<MeetupWithCount[]> {
  const sb = createPublicClient();
  const { data, error } = await sb
    .from("meetups")
    .select("*")
    .eq("is_published", true)
    .gte("starts_at", new Date().toISOString())
    .order("starts_at");
  if (error) throw error;
  return withCounts(data ?? []);
}

export async function getMeetup(id: string): Promise<MeetupWithCount | null> {
  const sb = createPublicClient();
  const { data, error } = await sb
    .from("meetups")
    .select("*")
    .eq("id", id)
    .eq("is_published", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [m] = await withCounts([data]);
  return m ?? null;
}

async function withCounts(meetups: Meetup[]): Promise<MeetupWithCount[]> {
  if (meetups.length === 0) return [];
  const sb = createPublicClient();
  const { data: counts } = await sb
    .from("meetup_rsvp_counts")
    .select("*")
    .in(
      "meetup_id",
      meetups.map((m) => m.id),
    );
  const byId = new Map(
    (counts ?? []).map((c: Views<"meetup_rsvp_counts">) => [c.meetup_id, c.going ?? 0]),
  );
  const nowIso = new Date().toISOString();
  return meetups.map((m) => ({ ...m, going: byId.get(m.id) ?? 0, isPast: m.starts_at < nowIso }));
}

/** The signed-in user's "going" RSVPs among the given meetups (empty when signed out). */
export async function getMyMeetupRsvps(meetupIds: string[]): Promise<Set<string>> {
  if (meetupIds.length === 0) return new Set();
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return new Set();
  const { data } = await sb
    .from("meetup_rsvps")
    .select("meetup_id")
    .eq("status", "going")
    .in("meetup_id", meetupIds);
  return new Set((data ?? []).map((r) => r.meetup_id));
}

// ── Admin reads (RLS: staff) ──────────────────────────────────────────────────
export async function listHostApplications(status?: string): Promise<HostApplication[]> {
  const sb = await createClient();
  let q = sb.from("host_applications").select("*").order("created_at", { ascending: false });
  if (status && ["pending", "approved", "declined"].includes(status)) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getHostApplication(id: string) {
  const sb = await createClient();
  const { data, error } = await sb.from("host_applications").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: tour } = data.preferred_tour_id
    ? await sb.from("tours").select("id, name, slug").eq("id", data.preferred_tour_id).maybeSingle()
    : { data: null };
  return { application: data, tour };
}

export async function listMeetupsAdmin(): Promise<MeetupWithCount[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("meetups")
    .select("*")
    .order("starts_at", { ascending: false });
  if (error) throw error;
  const meetups = data ?? [];
  if (meetups.length === 0) return [];
  const { data: counts } = await sb
    .from("meetup_rsvp_counts")
    .select("*")
    .in(
      "meetup_id",
      meetups.map((m) => m.id),
    );
  const byId = new Map((counts ?? []).map((c) => [c.meetup_id, c.going ?? 0]));
  const nowIso = new Date().toISOString();
  return meetups.map((m) => ({ ...m, going: byId.get(m.id) ?? 0, isPast: m.starts_at < nowIso }));
}

export async function getMeetupAdmin(id: string) {
  const sb = await createClient();
  const { data: meetup, error } = await sb.from("meetups").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!meetup) return null;
  const { data: rsvps } = await sb
    .from("meetup_rsvps")
    .select("user_id, status, created_at")
    .eq("meetup_id", id)
    .order("created_at");
  const ids = (rsvps ?? []).map((r) => r.user_id);
  const { data: profiles } = ids.length
    ? await sb.from("profiles").select("id, display_name, home_country").in("id", ids)
    : { data: [] as Array<{ id: string; display_name: string; home_country: string | null }> };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  return {
    meetup,
    rsvps: (rsvps ?? []).map((r) => ({ ...r, profile: profileById.get(r.user_id) ?? null })),
  };
}

/**
 * What a host earns, in minor units. Mirrors `host_credit_per_traveler` and `host_credit_cap` in
 * system_settings, which is staff-only, so the public page reads these.
 *
 * The old offer was "bring 8 and travel free", and it was retired on 2026-09-10 because a free
 * place is the most expensive thing we can give away: on the Monaco departure it is between $1,670
 * and $31,640, and on the two tiers nearest the circuit it is a room we have already paid for and
 * cannot resell. A flat credit per traveler costs the same whichever tier the host picks, which is
 * the whole point.
 */
export const HOST_CREDIT_PER_TRAVELER = 10000;
export const HOST_CREDIT_CAP = 100000;
