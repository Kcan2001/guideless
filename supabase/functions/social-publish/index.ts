// social-publish — publishes due `social_posts` to Instagram through the Instagram Graph API.
//
// Triggered every 10 minutes by pg_cron (`invoke_social_publish()` → pg_net POST with the shared
// `x-cron-secret` header), or manually with the service role bearer token. See docs/marketing.md.
//
// Flow per run: load the active account → refresh its long-lived token when close to expiry →
// check the 24h publishing quota → claim due posts atomically (`claim_due_social_posts`) →
// container → poll status → publish → store permalink. Failures are recorded on the row
// (`status = failed`, `last_error`) for staff to fix and re-schedule; nothing retries blindly.
//
// Secrets (supabase secrets set …): SOCIAL_PUBLISH_SECRET. Optional: META_GRAPH_BASE
// (default https://graph.instagram.com — the "Instagram API with Instagram Login" host),
// SOCIAL_DRY_RUN=1 (claims and logs, calls no Meta endpoint, marks posts back to scheduled).

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

type Json = Record<string, unknown>;

interface SocialAccount {
  id: string;
  platform: string;
  external_id: string;
  username: string;
  access_token: string;
  token_expires_at: string | null;
}

interface SocialPost {
  id: string;
  kind: "image" | "carousel";
  caption: string;
  hashtags: string[];
  media_paths: string[];
  alt_texts: string[];
  external_container_id: string | null;
  attempts: number;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CRON_SECRET = Deno.env.get("SOCIAL_PUBLISH_SECRET") ?? "";
const GRAPH_BASE = (Deno.env.get("META_GRAPH_BASE") ?? "https://graph.instagram.com").replace(
  /\/$/,
  "",
);
const DRY_RUN = Deno.env.get("SOCIAL_DRY_RUN") === "1";
const BATCH = 5;
const REFRESH_WHEN_WITHIN_DAYS = 10;

// ── Meta Graph helpers ─────────────────────────────────────────────────────────
class GraphError extends Error {
  constructor(
    message: string,
    readonly code?: number,
    readonly subcode?: number,
  ) {
    super(message);
  }
}

async function graph<T extends Json>(
  method: "GET" | "POST",
  path: string,
  token: string,
  params: Record<string, string> = {},
): Promise<T> {
  const url = new URL(`${GRAPH_BASE}/${path.replace(/^\//, "")}`);
  const body = new URLSearchParams({ ...params, access_token: token });
  const res =
    method === "GET"
      ? await fetch(`${url}?${body}`)
      : await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        });
  const json = (await res.json().catch(() => ({}))) as Json & {
    error?: { message?: string; code?: number; error_subcode?: number };
  };
  if (!res.ok || json.error) {
    const e = json.error ?? {};
    throw new GraphError(e.message ?? `Graph API ${res.status}`, e.code, e.error_subcode);
  }
  return json as T;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

/** Instagram processes containers asynchronously; publish only once FINISHED. */
async function waitForContainer(containerId: string, token: string): Promise<void> {
  for (let i = 0; i < 10; i++) {
    const { status_code } = await graph<{ status_code: string }>("GET", containerId, token, {
      fields: "status_code",
    });
    if (status_code === "FINISHED") return;
    if (status_code === "ERROR" || status_code === "EXPIRED") {
      throw new GraphError(`Container ${status_code.toLowerCase()}`);
    }
    await sleep(3000);
  }
  throw new GraphError("Container did not finish processing in time");
}

function publicMediaUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/social-media/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

function fullCaption(post: SocialPost): string {
  const tags = post.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ");
  return [post.caption.trim(), tags].filter(Boolean).join("\n\n").slice(0, 2200);
}

async function createContainer(account: SocialAccount, post: SocialPost): Promise<string> {
  const caption = fullCaption(post);
  if (post.kind === "image") {
    const { id } = await graph<{ id: string }>(
      "POST",
      `${account.external_id}/media`,
      account.access_token,
      {
        image_url: publicMediaUrl(post.media_paths[0]),
        caption,
        ...(post.alt_texts[0] ? { alt_text: post.alt_texts[0].slice(0, 1000) } : {}),
      },
    );
    return id;
  }
  const children: string[] = [];
  for (const [i, path] of post.media_paths.entries()) {
    const { id } = await graph<{ id: string }>(
      "POST",
      `${account.external_id}/media`,
      account.access_token,
      {
        image_url: publicMediaUrl(path),
        is_carousel_item: "true",
        ...(post.alt_texts[i] ? { alt_text: post.alt_texts[i].slice(0, 1000) } : {}),
      },
    );
    children.push(id);
  }
  const { id } = await graph<{ id: string }>(
    "POST",
    `${account.external_id}/media`,
    account.access_token,
    {
      media_type: "CAROUSEL",
      children: children.join(","),
      caption,
    },
  );
  return id;
}

// ── Database helpers ───────────────────────────────────────────────────────────
function db(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function refreshTokenIfNeeded(
  sb: SupabaseClient,
  account: SocialAccount,
): Promise<SocialAccount> {
  if (!account.token_expires_at) return account;
  const daysLeft = (new Date(account.token_expires_at).getTime() - Date.now()) / 86_400_000;
  if (daysLeft > REFRESH_WHEN_WITHIN_DAYS || DRY_RUN) return account;
  const refreshed = await graph<{ access_token: string; expires_in: number }>(
    "GET",
    "refresh_access_token",
    account.access_token,
    { grant_type: "ig_refresh_token" },
  );
  const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  const { error } = await sb
    .from("social_accounts")
    .update({
      access_token: refreshed.access_token,
      token_expires_at: expiresAt,
      token_refreshed_at: new Date().toISOString(),
    })
    .eq("id", account.id);
  if (error) throw new Error(`Could not store refreshed token: ${error.message}`);
  return { ...account, access_token: refreshed.access_token, token_expires_at: expiresAt };
}

async function remainingQuota(account: SocialAccount): Promise<number> {
  const res = await graph<{
    data: Array<{ quota_usage: number; config: { quota_total: number } }>;
  }>("GET", `${account.external_id}/content_publishing_limit`, account.access_token, {
    fields: "quota_usage,config",
  });
  const row = res.data?.[0];
  if (!row) return BATCH;
  return Math.max(0, row.config.quota_total - row.quota_usage);
}

/** Never store tokens or full Graph payloads on the row. */
function safeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const code =
    err instanceof GraphError && err.code
      ? ` (code ${err.code}${err.subcode ? `/${err.subcode}` : ""})`
      : "";
  return `${msg}${code}`.replace(/access_token=[^&\s]+/g, "access_token=***").slice(0, 500);
}

async function publishOne(
  sb: SupabaseClient,
  account: SocialAccount,
  post: SocialPost,
): Promise<"published" | "failed"> {
  try {
    // Reuse a container from a previous crashed attempt instead of creating a duplicate.
    let containerId = post.external_container_id;
    if (!containerId) {
      containerId = await createContainer(account, post);
      await sb
        .from("social_posts")
        .update({ external_container_id: containerId })
        .eq("id", post.id);
    }
    await waitForContainer(containerId, account.access_token);
    const { id: mediaId } = await graph<{ id: string }>(
      "POST",
      `${account.external_id}/media_publish`,
      account.access_token,
      { creation_id: containerId },
    );
    const { permalink } = await graph<{ permalink?: string }>(
      "GET",
      mediaId,
      account.access_token,
      {
        fields: "permalink",
      },
    );
    await sb
      .from("social_posts")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        external_media_id: mediaId,
        permalink: permalink ?? null,
        account_id: account.id,
        last_error: null,
      })
      .eq("id", post.id);
    return "published";
  } catch (err) {
    console.error(`social-publish: post ${post.id} failed: ${safeError(err)}`);
    await sb
      .from("social_posts")
      .update({ status: "failed", last_error: safeError(err), account_id: account.id })
      .eq("id", post.id);
    return "failed";
  }
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
  const { data: accountRow, error: accountError } = await sb
    .from("social_accounts")
    .select("id, platform, external_id, username, access_token, token_expires_at")
    .eq("platform", "instagram")
    .eq("is_active", true)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (accountError) return Response.json({ error: accountError.message }, { status: 500 });
  if (!accountRow) return Response.json({ skipped: "no active instagram account connected" });

  let account = accountRow as SocialAccount;
  try {
    account = await refreshTokenIfNeeded(sb, account);
  } catch (err) {
    // A dead token blocks everything; surface it loudly but do not touch the queue.
    console.error(`social-publish: token refresh failed: ${safeError(err)}`);
    return Response.json(
      { error: "token refresh failed", detail: safeError(err) },
      { status: 502 },
    );
  }

  let quota = BATCH;
  if (!DRY_RUN) {
    try {
      quota = Math.min(BATCH, await remainingQuota(account));
    } catch (err) {
      console.warn(
        `social-publish: quota check failed, continuing conservatively: ${safeError(err)}`,
      );
      quota = 1;
    }
  }
  if (quota <= 0) return Response.json({ skipped: "24h publishing quota exhausted" });

  const { data: claimed, error: claimError } = await sb.rpc("claim_due_social_posts", {
    p_limit: quota,
  });
  if (claimError) return Response.json({ error: claimError.message }, { status: 500 });
  const posts = (claimed ?? []) as SocialPost[];

  if (DRY_RUN) {
    // Put them back so a real run can pick them up.
    if (posts.length)
      await sb
        .from("social_posts")
        .update({ status: "scheduled" })
        .in(
          "id",
          posts.map((p) => p.id),
        );
    return Response.json({
      dryRun: true,
      wouldPublish: posts.map((p) => ({ id: p.id, kind: p.kind, media: p.media_paths })),
    });
  }

  const results: Record<string, "published" | "failed"> = {};
  for (const post of posts) results[post.id] = await publishOne(sb, account, post);

  return Response.json({
    account: account.username,
    claimed: posts.length,
    published: Object.values(results).filter((r) => r === "published").length,
    failed: Object.values(results).filter((r) => r === "failed").length,
    results,
  });
});
