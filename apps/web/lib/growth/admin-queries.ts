import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Staff read models for the waitlist screen. Runs as the signed-in staff user, so RLS decides
 * what comes back; nothing here is reachable by a traveler.
 */

export interface WaitlistUnlock {
  id: string;
  threshold: number;
  reward: string;
  grantedAt: string | null;
}

export interface WaitlistDeparture {
  departureId: string;
  tourName: string;
  startDate: string;
  endDate: string;
  status: string;
  opensAt: string | null;
  waiting: number;
  notified: number;
  confirmed: number;
  unlocks: WaitlistUnlock[];
}

export interface WaitlistTourInterest {
  id: string;
  tourName: string;
  email: string;
  partySize: number;
  createdAt: string;
  notifiedAt: string | null;
}

export async function listWaitlists(): Promise<{
  departures: WaitlistDeparture[];
  tourOnly: WaitlistTourInterest[];
}> {
  const sb = await createClient();
  const { data: rows } = await sb
    .from("departure_waitlist")
    .select(
      "id, tour_id, departure_id, email, party_size, created_at, notified_at, tours(name), departures(start_date, end_date, status, opens_at)",
    )
    .order("created_at", { ascending: false });

  const byDeparture = new Map<string, WaitlistDeparture>();
  const tourOnly: WaitlistTourInterest[] = [];

  for (const r of rows ?? []) {
    const tourName = (r.tours as { name?: string } | null)?.name ?? "Unknown trip";
    if (!r.departure_id) {
      tourOnly.push({
        id: r.id,
        tourName,
        email: r.email,
        partySize: r.party_size,
        createdAt: r.created_at,
        notifiedAt: r.notified_at,
      });
      continue;
    }
    const d = r.departures as {
      start_date?: string;
      end_date?: string;
      status?: string;
      opens_at?: string | null;
    } | null;
    const existing = byDeparture.get(r.departure_id);
    if (existing) {
      existing.waiting += 1;
      if (r.notified_at) existing.notified += 1;
      continue;
    }
    byDeparture.set(r.departure_id, {
      departureId: r.departure_id,
      tourName,
      startDate: d?.start_date ?? "",
      endDate: d?.end_date ?? "",
      status: d?.status ?? "unknown",
      opensAt: d?.opens_at ?? null,
      waiting: 1,
      notified: r.notified_at ? 1 : 0,
      confirmed: 0,
      unlocks: [],
    });
  }

  const ids = [...byDeparture.keys()];
  if (ids.length > 0) {
    const [{ data: unlocks }, ...progress] = await Promise.all([
      sb
        .from("departure_unlocks")
        .select("id, departure_id, threshold, reward, granted_at")
        .in("departure_id", ids)
        .eq("is_active", true)
        .order("threshold"),
      ...ids.map((id) => sb.rpc("departure_unlock_progress", { p_departure_id: id })),
    ]);
    for (const u of unlocks ?? []) {
      byDeparture.get(u.departure_id)?.unlocks.push({
        id: u.id,
        threshold: u.threshold,
        reward: u.reward,
        grantedAt: u.granted_at,
      });
    }
    ids.forEach((id, i) => {
      const data = progress[i]?.data as { confirmed?: number } | null;
      const row = byDeparture.get(id);
      if (row && typeof data?.confirmed === "number") row.confirmed = data.confirmed;
    });
  }

  const departures = [...byDeparture.values()].sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );
  return { departures, tourOnly };
}
