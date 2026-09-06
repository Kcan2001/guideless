// notify-dispatch — delivers `public.notifications` rows by push (Expo) and email (Resend).
//
// Triggered every minute by pg_cron (`invoke_notify_dispatch()` → pg_net POST with the shared
// `x-cron-secret` header) whenever undispatched rows exist, or manually with the service role
// bearer token. See docs/api.md → Notifications.
//
// Flow per run: `claim_pending_notifications(50)` (atomic, skip-locked) → per row decide channels
// from category + preferences (operational push always; social/marketing per opt-in; email per
// opt-in, operational default on) → send → record one `notification_deliveries` row per channel.
// Tokens Expo reports as DeviceNotRegistered are disabled. Nothing retries blindly: a failed
// delivery is visible to admins with the provider's error, never the message content.
//
// Secrets (supabase secrets set …): NOTIFY_DISPATCH_SECRET, RESEND_API_KEY. Optional: EMAIL_FROM,
// EXPO_ACCESS_TOKEN (Expo push security), SITE_URL (email links), NOTIFY_DRY_RUN=1.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CRON_SECRET = Deno.env.get("NOTIFY_DISPATCH_SECRET") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const EXPO_ACCESS_TOKEN = Deno.env.get("EXPO_ACCESS_TOKEN") ?? "";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "Guideless Tours <hello@guidelesstours.com>";
const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://guidelesstours.com").replace(/\/$/, "");
const DRY_RUN = Deno.env.get("NOTIFY_DRY_RUN") === "1";
const BATCH = 50;

const BRAND = {
  name: "Guideless Tours",
  tagline: "Travel organized. Explore independently.",
  supportEmail: "hello@guidelesstours.com",
};

type Category = "operational" | "social" | "marketing";
type Channel = "push" | "email";
type DeliveryStatus = "sent" | "skipped" | "failed";

interface Claimed {
  id: string;
  user_id: string;
  category: Category;
  type: string;
  title: string;
  body: string | null;
  deep_link: Record<string, unknown> | null;
  trip_id: string | null;
  created_at: string;
  recipient_email: string | null;
  display_name: string | null;
  operational_email: boolean;
  social_push: boolean;
  social_email: boolean;
  marketing_push: boolean;
  marketing_email: boolean;
  quiet_hours_start: string | null; // "HH:MM:SS"
  quiet_hours_end: string | null;
  push_tokens: string[];
  trip_timezone: string | null;
  trip_active: boolean | null;
}

interface Delivery {
  status: DeliveryStatus;
  providerId?: string;
  detail?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function db(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

function safeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function esc(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function wantsPush(n: Claimed): boolean {
  if (n.push_tokens.length === 0) return false;
  switch (n.category) {
    case "operational":
      return true;
    case "social":
      return n.social_push;
    case "marketing":
      return n.marketing_push;
  }
}

function wantsEmail(n: Claimed): boolean {
  if (!n.recipient_email) return false;
  switch (n.category) {
    case "operational":
      return n.operational_email;
    case "social":
      return n.social_email;
    case "marketing":
      return n.marketing_email;
  }
}

/** Minutes past midnight in the given zone (falls back to UTC on a bad zone). */
function localMinutes(now: Date, timeZone: string | null): number {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timeZone ?? "UTC",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
    const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    return h * 60 + m;
  } catch {
    return now.getUTCHours() * 60 + now.getUTCMinutes();
  }
}

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Quiet hours apply to social and marketing pushes only; operational ones always go out. */
function inQuietHours(n: Claimed, now: Date): boolean {
  if (n.category === "operational" || !n.quiet_hours_start || !n.quiet_hours_end) return false;
  const cur = localMinutes(now, n.trip_timezone);
  const start = toMinutes(n.quiet_hours_start);
  const end = toMinutes(n.quiet_hours_end);
  return start <= end ? cur >= start && cur < end : cur >= start || cur < end;
}

/** Web equivalent of a DeepLink (docs/api.md → Deep links). */
function webUrl(link: Record<string, unknown> | null): string {
  const kind = link?.kind;
  const tripId = typeof link?.tripId === "string" ? link.tripId : null;
  if ((kind === "trip" || kind === "itinerary_item" || kind === "live_moment") && tripId) {
    return `${SITE_URL}/trips/${tripId}`;
  }
  return `${SITE_URL}/account`;
}

function ctaLabel(link: Record<string, unknown> | null): string {
  switch (link?.kind) {
    case "payment":
      return "Pay your balance";
    case "support_thread":
      return "Open your account";
    case "trip":
    case "itinerary_item":
    case "live_moment":
      return "Open your trip";
    default:
      return "Open your account";
  }
}

// ── Email (Resend) ─────────────────────────────────────────────────────────────
function renderEmail(n: Claimed): { subject: string; html: string; text: string } {
  const url = webUrl(n.deep_link);
  const cta = ctaLabel(n.deep_link);
  const greeting = n.display_name ? `Hi ${n.display_name},` : "Hello,";
  const text = [
    BRAND.name,
    "",
    greeting,
    "",
    n.title,
    n.body ?? "",
    "",
    `${cta}: ${url}`,
    "",
    BRAND.tagline,
    BRAND.supportEmail,
  ].join("\n");
  const html = `<!doctype html>
<html><body style="margin:0;background:#F5F6F2;font-family:Inter,-apple-system,Segoe UI,Roboto,sans-serif;color:#0B2025">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <p style="font-weight:700;font-size:18px;margin:0 0 24px">${esc(BRAND.name)}</p>
    <div style="background:#FFFFFF;border:1px solid #DAD9D0;border-radius:16px;padding:28px">
      <p style="margin:0 0 16px;color:#4D575B">${esc(greeting)}</p>
      <h1 style="margin:0 0 8px;font-size:24px;line-height:1.2">${esc(n.title)}</h1>
      ${n.body ? `<p style="margin:0 0 20px;line-height:1.6">${esc(n.body)}</p>` : ""}
      <p style="margin:24px 0 0"><a href="${esc(url)}" style="display:inline-block;background:#0B2025;color:#FFFFFF;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">${esc(cta)}</a></p>
    </div>
    <p style="margin:24px 0 0;color:#4D575B;font-size:13px">${esc(BRAND.tagline)} · <a href="mailto:${esc(BRAND.supportEmail)}" style="color:#0B6680">${esc(BRAND.supportEmail)}</a></p>
    <p style="margin:8px 0 0;color:#4D575B;font-size:12px">You receive trip notices for bookings you hold. Manage group and news emails in the Guideless app under Profile.</p>
  </div>
</body></html>`;
  return { subject: n.title, html, text };
}

async function sendEmail(sb: SupabaseClient, n: Claimed): Promise<Delivery> {
  const email = renderEmail(n);
  const { data: row } = await sb
    .from("email_events")
    .insert({
      user_id: n.user_id,
      template: `notification:${n.type}`,
      recipient: n.recipient_email,
      provider: "resend",
      status: RESEND_API_KEY && !DRY_RUN ? "queued" : "skipped",
      payload: { notification_id: n.id, category: n.category },
    })
    .select("id")
    .maybeSingle();

  if (!RESEND_API_KEY) return { status: "skipped", detail: "no RESEND_API_KEY" };
  if (DRY_RUN) return { status: "skipped", detail: "dry run" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [n.recipient_email],
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    const detail = res.ok ? null : (body.message ?? `HTTP ${res.status}`);
    if (row) {
      await sb
        .from("email_events")
        .update({
          status: res.ok ? "sent" : "failed",
          provider_message_id: body.id ?? null,
          error: detail,
        })
        .eq("id", row.id);
    }
    return res.ok
      ? { status: "sent", providerId: body.id }
      : { status: "failed", detail: detail ?? undefined };
  } catch (err) {
    if (row) {
      await sb
        .from("email_events")
        .update({ status: "failed", error: safeError(err) })
        .eq("id", row.id);
    }
    return { status: "failed", detail: safeError(err) };
  }
}

// ── Push (Expo) ────────────────────────────────────────────────────────────────
interface ExpoTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

async function sendPush(sb: SupabaseClient, n: Claimed): Promise<Delivery> {
  if (DRY_RUN) return { status: "skipped", detail: "dry run" };
  const messages = n.push_tokens.map((to) => ({
    to,
    title: n.title,
    body: n.body ?? undefined,
    data: { deepLink: n.deep_link, notificationId: n.id },
    sound: "default",
    priority: n.category === "operational" ? "high" : "default",
    channelId: n.category === "marketing" ? "social" : n.category,
  }));

  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${EXPO_ACCESS_TOKEN}` } : {}),
      },
      body: JSON.stringify(messages),
    });
    const json = (await res.json().catch(() => ({}))) as {
      data?: ExpoTicket[];
      errors?: { message?: string }[];
    };
    if (!res.ok || json.errors?.length) {
      return { status: "failed", detail: json.errors?.[0]?.message ?? `HTTP ${res.status}` };
    }
    const tickets = json.data ?? [];
    const dead: string[] = [];
    let okId: string | undefined;
    let firstError: string | undefined;
    tickets.forEach((t, i) => {
      if (t.status === "ok") okId ??= t.id;
      else {
        firstError ??= t.details?.error ?? t.message;
        if (t.details?.error === "DeviceNotRegistered" && n.push_tokens[i])
          dead.push(n.push_tokens[i]);
      }
    });
    if (dead.length) {
      await sb
        .from("push_tokens")
        .update({ disabled_at: new Date().toISOString() })
        .in("token", dead);
    }
    if (okId) return { status: "sent", providerId: okId };
    return { status: "failed", detail: firstError ?? "no ticket returned" };
  } catch (err) {
    return { status: "failed", detail: safeError(err) };
  }
}

// ── Recording ──────────────────────────────────────────────────────────────────
async function record(sb: SupabaseClient, notificationId: string, channel: Channel, d: Delivery) {
  const { error } = await sb.from("notification_deliveries").upsert(
    {
      notification_id: notificationId,
      channel,
      status: d.status,
      provider_id: d.providerId ?? null,
      detail: d.detail ?? null,
      attempted_at: new Date().toISOString(),
    },
    { onConflict: "notification_id,channel" },
  );
  if (error)
    console.error(`notify-dispatch: could not record ${channel} delivery: ${error.message}`);
}

// ── Handler ────────────────────────────────────────────────────────────────────
function authorized(req: Request): boolean {
  const cron = req.headers.get("x-cron-secret");
  if (CRON_SECRET && cron && cron === CRON_SECRET) return true;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return !!bearer && bearer === SERVICE_ROLE_KEY;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return Response.json({ error: "POST only" }, { status: 405 });
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const sb = db();
  const { data, error } = await sb.rpc("claim_pending_notifications", { p_limit: BATCH });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const rows = (data ?? []) as Claimed[];
  const now = new Date();

  const summary = {
    claimed: rows.length,
    push: { sent: 0, skipped: 0, failed: 0 },
    email: { sent: 0, skipped: 0, failed: 0 },
  };

  for (const n of rows) {
    let push: Delivery;
    if (!wantsPush(n)) {
      push = { status: "skipped", detail: n.push_tokens.length ? "opted out" : "no device" };
    } else if (inQuietHours(n, now)) {
      push = { status: "skipped", detail: "quiet hours" };
    } else {
      push = await sendPush(sb, n);
    }
    await record(sb, n.id, "push", push);
    summary.push[push.status] += 1;

    const email = wantsEmail(n)
      ? await sendEmail(sb, n)
      : { status: "skipped" as const, detail: n.recipient_email ? "opted out" : "no email" };
    await record(sb, n.id, "email", email);
    summary.email[email.status] += 1;
  }

  return Response.json({ dryRun: DRY_RUN, ...summary });
});
