import "server-only";

import type { Enums, Tables } from "@guideless/types";
import type { BadgeProps } from "@/components/ui/badge";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type SocialPost = Tables<"social_posts">;
export type SocialPostStatus = Enums<"social_post_status">;

/** Public URL of an object in the `social-media` bucket (what Instagram downloads). */
export function socialMediaUrl(path: string): string {
  return `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/social-media/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

export const SOCIAL_STATUS_VARIANT: Record<SocialPostStatus, BadgeProps["variant"]> = {
  draft: "neutral",
  scheduled: "info",
  publishing: "warning",
  published: "included",
  failed: "danger",
  cancelled: "neutral",
};

export async function listSocialPosts(status?: SocialPostStatus): Promise<SocialPost[]> {
  const sb = await createClient();
  let q = sb.from("social_posts").select("*").order("created_at", { ascending: false }).limit(200);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function getSocialPost(id: string): Promise<SocialPost | null> {
  const sb = await createClient();
  const { data, error } = await sb.from("social_posts").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export interface SocialQueueSummary {
  drafts: number;
  scheduled: number;
  failed: number;
  publishedThisMonth: number;
  nextScheduledAt: string | null;
}

export async function socialQueueSummary(posts: SocialPost[]): Promise<SocialQueueSummary> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const scheduled = posts.filter((p) => p.status === "scheduled");
  return {
    drafts: posts.filter((p) => p.status === "draft").length,
    scheduled: scheduled.length,
    failed: posts.filter((p) => p.status === "failed").length,
    publishedThisMonth: posts.filter(
      (p) =>
        p.status === "published" && p.published_at && p.published_at >= monthStart.toISOString(),
    ).length,
    nextScheduledAt:
      scheduled
        .map((p) => p.scheduled_at)
        .filter((d): d is string => !!d)
        .sort()[0] ?? null,
  };
}
