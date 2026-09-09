import "server-only";

import type { Tables } from "@guideless/types";
import { createClient } from "@/lib/supabase/server";

/**
 * Staff reads for /admin/email. The mailing_list view bypasses RLS on the tables underneath it
 * (they have five different policies between them), so it is granted to `authenticated` only and
 * every read here goes through the staff client — the page itself is behind requireStaff.
 */

export interface MailingListRow {
  segment: string;
  email: string;
  name: string | null;
  can_market: boolean;
  purpose: string;
  context: string | null;
  unsubscribe_token: string | null;
  created_at: string;
}

export async function listMailingList(): Promise<MailingListRow[]> {
  const sb = await createClient();
  const { data, error } = await sb.rpc("mailing_list_for_staff");
  if (error) throw error;
  return (data ?? []) as unknown as MailingListRow[];
}

export type CampaignRow = Tables<"email_campaigns"> & { recipientCount: number };

export async function listCampaigns(): Promise<CampaignRow[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("email_campaigns")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;

  const rows = (data ?? []) as Array<Tables<"email_campaigns">>;
  if (rows.length === 0) return [];

  const { data: sends } = await sb
    .from("email_campaign_sends")
    .select("campaign_id")
    .in(
      "campaign_id",
      rows.map((r) => r.id),
    );
  const counts = new Map<string, number>();
  for (const s of sends ?? []) counts.set(s.campaign_id, (counts.get(s.campaign_id) ?? 0) + 1);

  return rows.map((r) => ({ ...r, recipientCount: counts.get(r.id) ?? 0 }));
}
