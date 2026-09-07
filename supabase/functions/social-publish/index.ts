// social-publish — publishes due `social_posts` to Instagram and Pinterest.
//
// Triggered every 10 minutes by pg_cron (`invoke_social_publish()` → pg_net POST with the shared
// `x-cron-secret` header), or manually with the service role bearer token. See docs/marketing.md.
//
// Flow per run: claim due posts atomically (`claim_due_social_posts`) → group by platform → for
// each platform load the active account, refresh its token when close to expiry, check quota →
// publish each post → store permalink. Failures are recorded on the row (`status = failed`,
// `last_error`) for staff to fix and re-schedule; nothing retries blindly.
//
// Secrets (supabase secrets set …): SOCIAL_PUBLISH_SECRET. Optional: META_GRAPH_BASE
// (default https://graph.instagram.com — "Instagram API with Instagram Login"), PINTEREST_API_BASE
// (default https://api.pinterest.com/v5), PINTEREST_APP_ID + PINTEREST_APP_SECRET (token refresh),
// SITE_URL (default pin link), SOCIAL_DRY_RUN=1 (claims and logs, calls no platform API).

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

type Json = Record<string, unknown>;
type Platform = "instagram" | "pinterest";

interface SocialAccount {
  id: string;
  platform: Platform;
  external_id: string;
  username: string;
  access_token: string;
  token_expires_at: string | null;
  metadata: { board_id?: string; refresh_token?: string } & Json;
}

interface SocialPost {
  id: string;
  platform: Platform;
  kind: "image" | "carousel";
  caption: string;
  hashtags: string[];
  media_paths: string[];
  alt_texts: string[];
  title: string | null;
  link_url: string | null;
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
const PINTEREST_BASE = (
  Deno.env.get("PINTEREST_API_BASE") ?? "https://api.pinterest.com/v5"
).replace(/\/$/, "");
const PINTEREST_APP_ID = Deno.env.get("PINTEREST_APP_ID") ?? "";
const PINTEREST_APP_SECRET = Deno.env.get("PINTEREST_APP_SECRET") ?? "";
const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://guidelesstravel.com").replace(/\/$/, "");
const DRY_RUN = Deno.env.get("SOCIAL_DRY_RUN") === "1";
const BATCH = 5;
const REFRESH_WHEN_WITHIN_DAYS = 10;

// ── Shared helpers ─────────────────────────────────────────────────────────────
class PlatformError extends Error {
  constructor(
    message: string,
    readonly code?: number | string,
    readonly subcode?: number,
  ) {
    super(message);
  }
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

function publicMediaUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/social-media/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

function captionWithTags(post: SocialPost, max: number): string {
  const tags = post.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ");
  return [post.caption.trim(), tags].filter(Boolean).join("\n\n").slice(0, max);
}

/** Never store tokens or full API payloads on the row. */
function safeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const code =
    err instanceof PlatformError && err.code !== undefined
      ? ` (code ${err.code}${err.subcode ? `/${err.subcode}` : ""})`
      : "";
  return `${msg}${code}`
    .replace(/access_token=[^&\s]+/g, "access_token=***")
    .replace(/Bearer\s+\S+/g, "Bearer ***")
    .slice(0, 500);
}

function db(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ── Instagram (Meta Graph API) ─────────────────────────────────────────────────
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
    throw new PlatformError(e.message ?? `Graph API ${res.status}`, e.code, e.error_subcode);
  }
  return json as T;
}

/** Instagram processes containers asynchronously; publish only once FINISHED. */
async function waitForContainer(containerId: string, token: string): Promise<void> {
  for (let i = 0; i < 10; i++) {
    const { status_code } = await graph<{ status_code: string }>("GET", containerId, token, {
      fields: "status_code",
    });
    if (status_code === "FINISHED") return;
    if (status_code === "ERROR" || status_code === "EXPIRED") {
      throw new PlatformError(`Container ${status_code.toLowerCase()}`);
    }
    await sleep(3000);
  }
  throw new PlatformError("Container did not finish processing in time");
}

async function createInstagramContainer(account: SocialAccount, post: SocialPost): Promise<string> {
  const caption = captionWithTags(post, 2200);
  const media = `${account.external_id}/media`;
  if (post.kind === "image") {
    const { id } = await graph<{ id: string }>("POST", media, account.access_token, {
      image_url: publicMediaUrl(post.media_paths[0]),
      caption,
      ...(post.alt_texts[0] ? { alt_text: post.alt_texts[0].slice(0, 1000) } : {}),
    });
    return id;
  }
  const children: string[] = [];
  for (const [i, path] of post.media_paths.entries()) {
    const { id } = await graph<{ id: string }>("POST", media, account.access_token, {
      image_url: publicMediaUrl(path),
      is_carousel_item: "true",
      ...(post.alt_texts[i] ? { alt_text: post.alt_texts[i].slice(0, 1000) } : {}),
    });
    children.push(id);
  }
  const { id } = await graph<{ id: string }>("POST", media, account.access_token, {
    media_type: "CAROUSEL",
    children: children.join(","),
    caption,
  });
  return id;
}

async function refreshInstagramToken(
  sb: SupabaseClient,
  account: SocialAccount,
): Promise<SocialAccount> {
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

async function instagramQuota(account: SocialAccount): Promise<number> {
  const res = await graph<{
    data: Array<{ quota_usage: number; config: { quota_total: number } }>;
  }>("GET", `${account.external_id}/content_publishing_limit`, account.access_token, {
    fields: "quota_usage,config",
  });
  const row = res.data?.[0];
  return row ? Math.max(0, row.config.quota_total - row.quota_usage) : BATCH;
}

async function publishInstagram(
  sb: SupabaseClient,
  account: SocialAccount,
  post: SocialPost,
): Promise<{ externalId: string; permalink: string | null }> {
  // Reuse a container from a previous crashed attempt instead of creating a duplicate.
  let containerId = post.external_container_id;
  if (!containerId) {
    containerId = await createInstagramContainer(account, post);
    await sb.from("social_posts").update({ external_container_id: containerId }).eq("id", post.id);
  }
  await waitForContainer(containerId, account.access_token);
  const { id: mediaId } = await graph<{ id: string }>(
    "POST",
    `${account.external_id}/media_publish`,
    account.access_token,
    { creation_id: containerId },
  );
  const { permalink } = await graph<{ permalink?: string }>("GET", mediaId, account.access_token, {
    fields: "permalink",
  });
  return { externalId: mediaId, permalink: permalink ?? null };
}

// ── Pinterest (API v5) ─────────────────────────────────────────────────────────
async function pinterest<T extends Json>(
  method: "GET" | "POST" | "PATCH",
  path: string,
  token: string,
  body?: Json,
): Promise<T> {
  const res = await fetch(`${PINTEREST_BASE}/${path.replace(/^\//, "")}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as Json & { message?: string; code?: number };
  if (!res.ok) {
    throw new PlatformError(json.message ?? `Pinterest API ${res.status}`, json.code ?? res.status);
  }
  return json as T;
}

/** Pinterest access tokens last 30 days; refresh with the stored refresh_token (app credentials). */
async function refreshPinterestToken(
  sb: SupabaseClient,
  account: SocialAccount,
): Promise<SocialAccount> {
  const refreshToken = account.metadata.refresh_token;
  if (!refreshToken || !PINTEREST_APP_ID || !PINTEREST_APP_SECRET) {
    throw new PlatformError(
      "Pinterest token near expiry and no refresh_token/app credentials configured",
    );
  }
  const basic = btoa(`${PINTEREST_APP_ID}:${PINTEREST_APP_SECRET}`);
  const res = await fetch(`${PINTEREST_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    message?: string;
  };
  if (!res.ok || !json.access_token)
    throw new PlatformError(json.message ?? `Pinterest refresh ${res.status}`);
  const expiresAt = new Date(Date.now() + (json.expires_in ?? 30 * 86400) * 1000).toISOString();
  const metadata = { ...account.metadata, refresh_token: json.refresh_token ?? refreshToken };
  const { error } = await sb
    .from("social_accounts")
    .update({
      access_token: json.access_token,
      token_expires_at: expiresAt,
      token_refreshed_at: new Date().toISOString(),
      metadata,
    })
    .eq("id", account.id);
  if (error) throw new Error(`Could not store refreshed token: ${error.message}`);
  return { ...account, access_token: json.access_token, token_expires_at: expiresAt, metadata };
}

async function publishPinterest(
  _sb: SupabaseClient,
  account: SocialAccount,
  post: SocialPost,
): Promise<{ externalId: string; permalink: string | null }> {
  const boardId = account.metadata.board_id;
  if (!boardId) throw new PlatformError("Pinterest account has no default board_id in metadata");
  const urls = post.media_paths.map(publicMediaUrl);
  const media_source =
    urls.length === 1
      ? { source_type: "image_url", url: urls[0] }
      : { source_type: "multiple_image_urls", items: urls.map((url) => ({ url })) };
  const pin = await pinterest<{ id: string }>("POST", "pins", account.access_token, {
    board_id: boardId,
    title: (post.title ?? post.caption.split("\n")[0] ?? "").slice(0, 100) || undefined,
    description: captionWithTags(post, 800),
    link: post.link_url ?? `${SITE_URL}/?utm_source=pinterest&utm_medium=social`,
    alt_text: post.alt_texts[0]?.slice(0, 500) || undefined,
    media_source,
  });
  return { externalId: pin.id, permalink: `https://www.pinterest.com/pin/${pin.id}/` };
}

// ── Orchestration ──────────────────────────────────────────────────────────────
async function loadAccount(sb: SupabaseClient, platform: Platform): Promise<SocialAccount | null> {
  const { data, error } = await sb
    .from("social_accounts")
    .select("id, platform, external_id, username, access_token, token_expires_at, metadata")
    .eq("platform", platform)
    .eq("is_active", true)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SocialAccount | null) ?? null;
}

async function refreshIfNeeded(sb: SupabaseClient, account: SocialAccount): Promise<SocialAccount> {
  if (!account.token_expires_at || DRY_RUN) return account;
  const daysLeft = (new Date(account.token_expires_at).getTime() - Date.now()) / 86_400_000;
  if (daysLeft > REFRESH_WHEN_WITHIN_DAYS) return account;
  return account.platform === "instagram"
    ? await refreshInstagramToken(sb, account)
    : await refreshPinterestToken(sb, account);
}

async function publishOne(sb: SupabaseClient, account: SocialAccount, post: SocialPost) {
  try {
    const result =
      account.platform === "instagram"
        ? await publishInstagram(sb, account, post)
        : await publishPinterest(sb, account, post);
    await sb
      .from("social_posts")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        external_media_id: result.externalId,
        permalink: result.permalink,
        account_id: account.id,
        last_error: null,
      })
      .eq("id", post.id);
    return "published" as const;
  } catch (err) {
    console.error(`social-publish: ${post.platform} post ${post.id} failed: ${safeError(err)}`);
    await sb
      .from("social_posts")
      .update({ status: "failed", last_error: safeError(err), account_id: account.id })
      .eq("id", post.id);
    return "failed" as const;
  }
}

async function failAll(sb: SupabaseClient, posts: SocialPost[], reason: string) {
  if (!posts.length) return;
  await sb
    .from("social_posts")
    .update({ status: "failed", last_error: reason.slice(0, 500) })
    .in(
      "id",
      posts.map((p) => p.id),
    );
}

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
  const { data: claimed, error: claimError } = await sb.rpc("claim_due_social_posts", {
    p_limit: BATCH,
  });
  if (claimError) return Response.json({ error: claimError.message }, { status: 500 });
  const posts = (claimed ?? []) as SocialPost[];
  if (posts.length === 0)
    return Response.json({ claimed: 0, published: 0, failed: 0, results: {} });

  if (DRY_RUN) {
    // Put them back so a real run can pick them up.
    await sb
      .from("social_posts")
      .update({ status: "scheduled" })
      .in(
        "id",
        posts.map((p) => p.id),
      );
    return Response.json({
      dryRun: true,
      wouldPublish: posts.map((p) => ({
        id: p.id,
        platform: p.platform,
        kind: p.kind,
        media: p.media_paths,
      })),
    });
  }

  const results: Record<string, "published" | "failed"> = {};
  const byPlatform = new Map<Platform, SocialPost[]>();
  for (const p of posts) byPlatform.set(p.platform, [...(byPlatform.get(p.platform) ?? []), p]);

  for (const [platform, group] of byPlatform) {
    let account: SocialAccount | null = null;
    try {
      account = await loadAccount(sb, platform);
      if (!account) throw new PlatformError(`no active ${platform} account connected`);
      account = await refreshIfNeeded(sb, account);
    } catch (err) {
      // A dead token or missing account blocks the whole platform; mark its posts so staff see why.
      console.error(`social-publish: ${platform} unavailable: ${safeError(err)}`);
      await failAll(sb, group, `${platform}: ${safeError(err)}`);
      for (const p of group) results[p.id] = "failed";
      continue;
    }

    let allowed = group.length;
    if (platform === "instagram") {
      try {
        allowed = Math.min(group.length, await instagramQuota(account));
      } catch (err) {
        console.warn(`social-publish: quota check failed, continuing with one: ${safeError(err)}`);
        allowed = 1;
      }
    }
    const [now, later] = [group.slice(0, allowed), group.slice(allowed)];
    if (later.length) {
      // Over quota: release back to the queue for the next run rather than failing.
      await sb
        .from("social_posts")
        .update({ status: "scheduled" })
        .in(
          "id",
          later.map((p) => p.id),
        );
    }
    for (const post of now) results[post.id] = await publishOne(sb, account, post);
  }

  const values = Object.values(results);
  return Response.json({
    claimed: posts.length,
    published: values.filter((r) => r === "published").length,
    failed: values.filter((r) => r === "failed").length,
    results,
  });
});
