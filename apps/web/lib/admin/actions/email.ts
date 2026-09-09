"use server";

import { revalidatePath } from "next/cache";
import { campaignFormSchema, campaignSendSchema } from "@guideless/validation";
import { dbErrorMessage, flash, parseForm } from "@/lib/admin/form";
import { CONTENT_ROLES, requireStaff } from "@/lib/auth/staff";
import { marketingReason, sendCampaign, unsubscribeUrl } from "@/lib/email/campaigns";
import { sendEmail } from "@/lib/email/send";
import { campaignEmail } from "@/lib/email/templates/campaign";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Writing and sending an email to part of the mailing list.
 *
 * The shape of this is deliberately awkward in one place: you cannot send a campaign you have not
 * first sent to yourself. Every other guard here protects the recipient; that one protects Kyle
 * from a typo going to two hundred people at once, and it costs a single click.
 */

const BACK = "/admin/email";

export async function saveCampaignAction(fd: FormData): Promise<void> {
  await requireStaff(CONTENT_ROLES);
  const parsed = parseForm(campaignFormSchema, fd);
  if (!parsed.ok) flash(BACK, "error", parsed.error);
  const v = parsed.data;

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  const row = {
    subject: v.subject,
    preheader: v.preheader ?? null,
    body: v.body,
    segment: v.segment,
    context: v.context ?? null,
    cta_label: v.ctaLabel ?? null,
    cta_url: v.ctaUrl ?? null,
  };

  if (v.campaignId) {
    const { error } = await sb
      .from("email_campaigns")
      .update(row)
      .eq("id", v.campaignId)
      .eq("status", "draft");
    if (error) flash(BACK, "error", dbErrorMessage(error));
    revalidatePath(BACK);
    flash(BACK, "ok", "Saved.");
  }

  const { error } = await sb
    .from("email_campaigns")
    .insert({ ...row, created_by: user?.id ?? null });
  if (error) flash(BACK, "error", dbErrorMessage(error));
  revalidatePath(BACK);
  flash(BACK, "ok", "Draft saved. Send it to yourself before you send it to anyone else.");
}

/** To Kyle's own address, rendered exactly as a recipient in that segment would receive it. */
export async function testCampaignAction(fd: FormData): Promise<void> {
  const staff = await requireStaff(CONTENT_ROLES);
  const parsed = parseForm(campaignSendSchema, fd);
  if (!parsed.ok) flash(BACK, "error", parsed.error);

  const sb = await createClient();
  const { data: campaign, error } = await sb
    .from("email_campaigns")
    .select("*")
    .eq("id", parsed.data.campaignId)
    .maybeSingle();
  if (error || !campaign) flash(BACK, "error", "That campaign is gone.");

  const email = campaignEmail({
    subject: `[test] ${campaign.subject}`,
    preheader: campaign.preheader,
    body: campaign.body,
    cta:
      campaign.cta_label && campaign.cta_url
        ? { label: campaign.cta_label, url: campaign.cta_url }
        : null,
    // A real-looking link with no token, so clicking it in a test unsubscribes nobody.
    unsubscribeUrl: unsubscribeUrl(campaign.segment, null),
    reason: marketingReason({
      email: "",
      name: null,
      segment: campaign.segment,
      canMarket: true,
      purpose: "",
      context: campaign.context,
      unsubscribeToken: null,
    }),
  });

  await sendEmail(createServiceRoleClient(), {
    to: staff.user.email ?? "",
    userId: staff.user.id,
    template: "campaign-test",
    subject: email.subject,
    html: email.html,
    text: email.text,
    payload: { campaign_id: campaign.id },
  });

  revalidatePath(BACK);
  flash(BACK, "ok", `Test sent to ${staff.user.email}. Read it before you send the real one.`);
}

export async function sendCampaignAction(fd: FormData): Promise<void> {
  await requireStaff(CONTENT_ROLES);
  const parsed = parseForm(campaignSendSchema, fd);
  if (!parsed.ok) flash(BACK, "error", parsed.error);
  if (!parsed.data.confirm) {
    flash(BACK, "error", "Tick the box to confirm you have read the test.");
  }

  const sb = await createClient();
  const { error: claimError, data: claimed } = await sb
    .from("email_campaigns")
    .update({ status: "sending" })
    .eq("id", parsed.data.campaignId)
    .eq("status", "draft")
    .select("id");
  if (claimError) flash(BACK, "error", dbErrorMessage(claimError));
  if (!claimed || claimed.length === 0) {
    flash(BACK, "error", "That one is already sending or sent.");
  }

  // flash() redirects, and redirect() works by throwing — so it must sit outside the try, or the
  // catch below would swallow the success case and mark a finished send as failed.
  let outcome: { ok: true; message: string } | { ok: false; message: string };
  try {
    const result = await sendCampaign(parsed.data.campaignId);
    outcome = {
      ok: true,
      message: `Sent to ${result.sent}. ${result.skipped} already had it, ${result.failed} failed.`,
    };
  } catch (err) {
    await sb.from("email_campaigns").update({ status: "failed" }).eq("id", parsed.data.campaignId);
    outcome = { ok: false, message: (err as Error).message };
  }

  revalidatePath(BACK);
  flash(BACK, outcome.ok ? "ok" : "error", outcome.message);
}
