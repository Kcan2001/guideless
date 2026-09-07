"use server";

import { newsletterSignupSchema, newsletterUnsubscribeSchema } from "@guideless/validation";
import { getServerEnv } from "@/lib/env";
import { RATE_LIMITED_MESSAGE, withinRateLimit } from "@/lib/rate-limit";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

export interface NewsletterState {
  status: "idle" | "ok" | "error";
  message?: string;
}

/**
 * Newsletter signup (footer form, checkout opt-in). Postgres is the list of record
 * (`newsletter_subscribers`, via the security-definer RPC); Resend's audience receives a synced
 * copy so Broadcasts can send to it. A Resend outage never fails the signup.
 */
export async function subscribeNewsletterAction(
  _prev: NewsletterState,
  fd: FormData,
): Promise<NewsletterState> {
  const parsed = newsletterSignupSchema.safeParse({
    email: fd.get("email"),
    source: fd.get("source") ?? "footer",
    website: fd.get("website"),
  });
  if (!parsed.success) {
    // Honeypot hits get a friendly success so bots learn nothing; real typos get the message.
    if (parsed.error.issues.some((i) => i.path[0] === "website"))
      return { status: "ok", message: "Thanks — you're on the list." };
    return { status: "error", message: "Enter a valid email address." };
  }
  if (!(await withinRateLimit("newsletter", 5, 3600)))
    return { status: "error", message: RATE_LIMITED_MESSAGE };

  const sb = await createClient();
  const { data, error } = await sb.rpc("subscribe_newsletter", {
    p_email: parsed.data.email,
    p_source: parsed.data.source,
  });
  if (error) {
    console.error("newsletter subscribe failed", { error: error.message });
    return { status: "error", message: "Something went wrong. Please try again in a moment." };
  }

  if (data === "subscribed" || data === "resubscribed") {
    await syncToResend(parsed.data.email).catch((err: unknown) =>
      console.error("newsletter: Resend sync failed", {
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }

  return {
    status: "ok",
    message:
      data === "already_subscribed"
        ? "You're already on the list — nothing to do."
        : "Thanks — you're on the list. New departures land in your inbox first.",
  };
}

export async function unsubscribeNewsletter(token: string): Promise<boolean> {
  const parsed = newsletterUnsubscribeSchema.safeParse({ token });
  if (!parsed.success) return false;
  const sb = await createClient();
  const { data, error } = await sb.rpc("unsubscribe_newsletter", { p_token: parsed.data.token });
  if (error) {
    console.error("newsletter unsubscribe failed", { error: error.message });
    return false;
  }
  if (data) await markUnsubscribedInResend(parsed.data.token).catch(() => undefined);
  return data === true;
}

// ── Resend audience sync (optional: needs RESEND_API_KEY + RESEND_AUDIENCE_ID) ─
async function syncToResend(email: string): Promise<void> {
  const { RESEND_API_KEY, RESEND_AUDIENCE_ID } = getServerEnv();
  if (!RESEND_API_KEY || !RESEND_AUDIENCE_ID) return;
  const res = await fetch(`https://api.resend.com/audiences/${RESEND_AUDIENCE_ID}/contacts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, unsubscribed: false }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { id?: string };
  if (json.id) {
    const admin = createServiceRoleClient();
    await admin
      .from("newsletter_subscribers")
      .update({ resend_contact_id: json.id })
      .eq("email", email);
  }
}

async function markUnsubscribedInResend(token: string): Promise<void> {
  const { RESEND_API_KEY, RESEND_AUDIENCE_ID } = getServerEnv();
  if (!RESEND_API_KEY || !RESEND_AUDIENCE_ID) return;
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("newsletter_subscribers")
    .select("resend_contact_id")
    .eq("unsubscribe_token", token)
    .maybeSingle();
  if (!data?.resend_contact_id) return;
  await fetch(
    `https://api.resend.com/audiences/${RESEND_AUDIENCE_ID}/contacts/${data.resend_contact_id}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ unsubscribed: true }),
    },
  );
}
