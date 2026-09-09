import "server-only";

import { publicEnv } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";
import { campaignEmail } from "@/lib/email/templates/campaign";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Sending a campaign to a segment of the mailing list.
 *
 * Three things this does that a loop over `sendEmail` would not:
 *
 *   * It refuses to send to a segment that did not consent to marketing. `mailing_list.can_market`
 *     is false for host applicants and testimonial submitters, and the check is here rather than
 *     only in the UI because the cost of getting it wrong is a burned sending domain.
 *   * It records each address in `email_campaign_sends` before moving on, and skips anybody
 *     already there. A send that dies halfway can be run again without emailing anyone twice.
 *   * Every recipient gets their own unsubscribe link, built from the token on the row they are
 *     on. Somebody who signed up for Lisbon alerts and the newsletter stops only the one they
 *     clicked, which is the honest behaviour.
 *
 * Volumes here are tens to low hundreds, so a sequential loop is correct: it is easy to reason
 * about, it cannot flood Resend, and a failure stops at one address rather than a batch.
 */

export interface Recipient {
  email: string;
  name: string | null;
  segment: string;
  canMarket: boolean;
  purpose: string;
  context: string | null;
  unsubscribeToken: string | null;
}

const SEGMENT_KINDS: Record<string, "destination_alert" | "waitlist" | "newsletter"> = {
  destination_alert: "destination_alert",
  waitlist: "waitlist",
  newsletter: "newsletter",
};

export function unsubscribeUrl(segment: string, token: string | null): string {
  const kind = SEGMENT_KINDS[segment];
  if (!kind || !token) return `${publicEnv.NEXT_PUBLIC_SITE_URL}/account`;
  return `${publicEnv.NEXT_PUBLIC_SITE_URL}/unsubscribe?kind=${kind}&token=${token}`;
}

/** Plain-English reason, shown in the footer above the unsubscribe link. */
export function marketingReason(r: Recipient): string {
  switch (r.segment) {
    case "destination_alert":
      return r.context
        ? `you asked us to tell you about ${r.context}`
        : "you asked us to tell you when we go somewhere new";
    case "waitlist":
      return r.context
        ? `you joined the waiting list for ${r.context}`
        : "you joined a waiting list";
    default:
      return "you signed up for the Guideless newsletter";
  }
}

export interface SendResult {
  sent: number;
  skipped: number;
  failed: number;
}

export async function sendCampaign(campaignId: string): Promise<SendResult> {
  const admin = createServiceRoleClient();

  const { data: campaign, error } = await admin
    .from("email_campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();
  if (error) throw error;

  const { data: rows } = await admin
    .from("mailing_list")
    .select("*")
    .eq("segment", campaign.segment);

  let recipients: Recipient[] = (rows ?? []).map((r) => ({
    email: String(r.email),
    name: r.name,
    segment: String(r.segment),
    canMarket: Boolean(r.can_market),
    purpose: String(r.purpose),
    context: r.context,
    unsubscribeToken: r.unsubscribe_token,
  }));

  // Purpose limitation: a campaign about Lisbon goes to the people who asked about Lisbon.
  if (campaign.context) {
    const wanted = campaign.context.trim().toLowerCase();
    recipients = recipients.filter((r) => (r.context ?? "").trim().toLowerCase() === wanted);
  }

  const refused = recipients.filter((r) => !r.canMarket);
  if (refused.length > 0) {
    throw new Error(
      `That segment did not consent to marketing email. Reply to those ${refused.length} people individually instead.`,
    );
  }

  // Already-sent addresses, so a retry is safe. Also dedupes somebody listed twice in a segment.
  const { data: already } = await admin
    .from("email_campaign_sends")
    .select("email")
    .eq("campaign_id", campaignId);
  const done = new Set((already ?? []).map((r) => String(r.email).toLowerCase()));

  const result: SendResult = { sent: 0, skipped: 0, failed: 0 };
  const seen = new Set<string>();

  for (const r of recipients) {
    const key = r.email.toLowerCase();
    if (done.has(key) || seen.has(key)) {
      result.skipped += 1;
      continue;
    }
    seen.add(key);

    const email = campaignEmail({
      subject: campaign.subject,
      preheader: campaign.preheader,
      body: campaign.body,
      cta:
        campaign.cta_label && campaign.cta_url
          ? { label: campaign.cta_label, url: campaign.cta_url }
          : null,
      unsubscribeUrl: unsubscribeUrl(r.segment, r.unsubscribeToken),
      reason: marketingReason(r),
    });

    try {
      await sendEmail(admin, {
        to: r.email,
        userId: null,
        template: `campaign:${campaignId}`,
        subject: email.subject,
        html: email.html,
        text: email.text,
        payload: { campaign_id: campaignId, segment: r.segment },
      });
      await admin
        .from("email_campaign_sends")
        .insert({ campaign_id: campaignId, email: r.email, ok: true });
      result.sent += 1;
    } catch (err) {
      await admin.from("email_campaign_sends").insert({
        campaign_id: campaignId,
        email: r.email,
        ok: false,
        error: (err as Error).message.slice(0, 500),
      });
      result.failed += 1;
    }
  }

  await admin
    .from("email_campaigns")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", campaignId);

  return result;
}
