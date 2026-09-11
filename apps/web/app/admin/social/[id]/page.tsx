import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SOCIAL_PLATFORMS } from "@guideless/types";
import {
  INSTAGRAM_CAPTION_MAX,
  INSTAGRAM_HASHTAG_MAX,
  PINTEREST_TITLE_MAX,
} from "@guideless/validation";
import { Flash } from "@/components/admin/flash";
import { LocalTimeZoneInput } from "@/components/admin/local-time-zone-input";
import { SubmitButton } from "@/components/admin/submit-button";
import { DL, PageHeader, Section, inputClass, labelClass } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { CONTENT_ROLES, requireStaff } from "@/lib/auth/staff";
import {
  cancelSocialPostAction,
  deleteSocialPostAction,
  duplicateSocialPostAction,
  publishSocialPostNowAction,
  scheduleSocialPostAction,
  unscheduleSocialPostAction,
  updateSocialPostAction,
} from "@/lib/admin/actions/social";
import { SOCIAL_STATUS_VARIANT, getSocialPost, socialMediaUrl } from "@/lib/admin/social";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Social post" };

const COMMON_ZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Rome",
  "Europe/Madrid",
  "Asia/Tokyo",
  "Australia/Sydney",
];

export default async function SocialPostPage(props: PageProps<"/admin/social/[id]">) {
  const { id } = await props.params;
  await requireStaff(CONTENT_ROLES, `/admin/social/${id}`);
  const sp = await props.searchParams;
  const post = await getSocialPost(id);
  if (!post) notFound();

  const sb = await createClient();
  const [{ data: tours }, { data: destinations }] = await Promise.all([
    sb.from("tours").select("id, name").order("name"),
    sb.from("destinations").select("id, name").order("name"),
  ]);

  const editable = post.status !== "published" && post.status !== "publishing";
  const schedulable =
    post.status === "draft" || post.status === "failed" || post.status === "cancelled";
  const back = `/admin/social/${post.id}`;
  const preview = [post.caption.trim(), post.hashtags.map((h) => `#${h}`).join(" ")]
    .filter(Boolean)
    .join("\n\n");

  return (
    <>
      <PageHeader
        title={post.caption ? post.caption.slice(0, 60) : "Untitled post"}
        crumbs={<Link href="/admin/social">Social</Link>}
        description={
          <span className="inline-flex items-center gap-2">
            <Badge variant={SOCIAL_STATUS_VARIANT[post.status]}>{post.status}</Badge>
            <Badge variant="guideless">{post.platform}</Badge>
            {post.kind} · {post.media_paths.length} image{post.media_paths.length === 1 ? "" : "s"}
            {post.permalink && (
              <a href={post.permalink} target="_blank" rel="noopener noreferrer">
                View on {post.platform === "pinterest" ? "Pinterest" : "Instagram"}
              </a>
            )}
          </span>
        }
      />
      <Flash searchParams={sp} />

      {post.status === "failed" && post.last_error && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-danger-border bg-danger-surface p-4 text-sm"
        >
          <p className="font-semibold">Last attempt failed (attempt {post.attempts})</p>
          <p className="mt-1 break-words">{post.last_error}</p>
          <p className="mt-2 text-muted-foreground">
            Fix the cause (image URL reachable? token valid? quota?) and schedule again.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Section
            title="Media"
            description="JPEG, sRGB, EXIF stripped, aspect ratio clamped to 4:5 – 1.91:1 at import."
          >
            {post.media_paths.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No media. Re-run <code>pnpm social:import</code> with the photo in place.
              </p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {post.media_paths.map((path, i) => (
                  <li key={path} className="space-y-1">
                    <Image
                      src={socialMediaUrl(path)}
                      alt={post.alt_texts[i] || ""}
                      width={320}
                      height={320}
                      className="aspect-square w-full rounded-lg border border-border object-cover"
                    />
                    <p className="truncate text-xs text-muted-foreground" title={path}>
                      {i + 1}. {path.split("/").pop()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Caption">
            <form action={updateSocialPostAction} className="grid gap-4">
              <input type="hidden" name="postId" value={post.id} />
              <input type="hidden" name="returnTo" value={back} />
              <label className={labelClass}>
                Platform
                <select
                  name="platform"
                  defaultValue={post.platform}
                  disabled={!editable}
                  className={inputClass}
                >
                  {SOCIAL_PLATFORMS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              {post.platform === "pinterest" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className={labelClass}>
                    Pin title (≤{PINTEREST_TITLE_MAX})
                    <input
                      name="title"
                      defaultValue={post.title ?? ""}
                      maxLength={PINTEREST_TITLE_MAX}
                      disabled={!editable}
                      className={inputClass}
                      placeholder="Old town Nice at golden hour"
                    />
                  </label>
                  <label className={labelClass}>
                    Destination link (defaults to the site)
                    <input
                      name="linkUrl"
                      type="url"
                      defaultValue={post.link_url ?? ""}
                      disabled={!editable}
                      className={inputClass}
                      placeholder="https://guidelesstravel.com/tours/southern-france?utm_source=pinterest&utm_medium=social"
                    />
                  </label>
                </div>
              )}
              <label className={labelClass}>
                Caption ({post.caption.length}/{INSTAGRAM_CAPTION_MAX})
                <textarea
                  name="caption"
                  defaultValue={post.caption}
                  rows={8}
                  maxLength={INSTAGRAM_CAPTION_MAX}
                  disabled={!editable}
                  className={inputClass + " h-auto py-2 leading-relaxed"}
                  placeholder="Travel organized. Explore independently. What did this day look like?"
                />
              </label>
              <label className={labelClass}>
                Hashtags (up to {INSTAGRAM_HASHTAG_MAX}, appended on their own line)
                <input
                  name="hashtags"
                  defaultValue={post.hashtags.map((h) => `#${h}`).join(" ")}
                  disabled={!editable}
                  className={inputClass}
                  placeholder="#guideless #slowtravel #frenchriviera"
                />
              </label>
              <label className={labelClass}>
                Alt text (first image — accessibility, also indexed)
                <input
                  name="altText"
                  defaultValue={post.alt_texts[0] ?? ""}
                  maxLength={1000}
                  disabled={!editable}
                  className={inputClass}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={labelClass}>
                  Related tour
                  <select
                    name="tourId"
                    defaultValue={post.tour_id ?? ""}
                    disabled={!editable}
                    className={inputClass}
                  >
                    <option value="">—</option>
                    {(tours ?? []).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Related destination
                  <select
                    name="destinationId"
                    defaultValue={post.destination_id ?? ""}
                    disabled={!editable}
                    className={inputClass}
                  >
                    <option value="">—</option>
                    {(destinations ?? []).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {editable && <SubmitButton size="sm">Save caption</SubmitButton>}
            </form>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Preview" description="Exactly what the publisher sends.">
            <pre className="whitespace-pre-wrap rounded-lg bg-cloud p-3 text-sm leading-relaxed">
              {preview || <span className="text-muted-foreground">Nothing yet.</span>}
            </pre>
          </Section>

          <Section title="Schedule">
            <DL
              rows={[
                [
                  "Scheduled",
                  post.scheduled_at
                    ? new Date(post.scheduled_at).toISOString().replace("T", " ").slice(0, 16) +
                      " UTC"
                    : "—",
                ],
                [
                  "Published",
                  post.published_at
                    ? new Date(post.published_at).toISOString().replace("T", " ").slice(0, 16) +
                      " UTC"
                    : "—",
                ],
                ["Attempts", post.attempts],
              ]}
            />
            {schedulable && (
              <form action={scheduleSocialPostAction} className="mt-4 grid gap-3">
                <input type="hidden" name="postId" value={post.id} />
                <input type="hidden" name="returnTo" value={back} />
                <div className="grid grid-cols-2 gap-3">
                  <label className={labelClass}>
                    Date
                    <input type="date" name="date" required className={inputClass} />
                  </label>
                  <label className={labelClass}>
                    Time
                    <input
                      type="time"
                      name="time"
                      required
                      defaultValue="17:00"
                      className={inputClass}
                    />
                  </label>
                </div>
                <label className={labelClass}>
                  Time zone
                  <LocalTimeZoneInput />
                  <datalist id="common-time-zones">
                    {COMMON_ZONES.map((z) => (
                      <option key={z} value={z} />
                    ))}
                  </datalist>
                </label>
                <SubmitButton size="sm" disabled={post.media_paths.length === 0}>
                  Schedule
                </SubmitButton>
              </form>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {schedulable && (
                <form action={publishSocialPostNowAction}>
                  <input type="hidden" name="postId" value={post.id} />
                  <input type="hidden" name="returnTo" value={back} />
                  <SubmitButton
                    size="sm"
                    variant="secondary"
                    disabled={post.media_paths.length === 0}
                    confirm="Queue this post to publish on the next run (within 10 minutes)?"
                  >
                    Publish now
                  </SubmitButton>
                </form>
              )}
              {post.status === "scheduled" && (
                <form action={unscheduleSocialPostAction}>
                  <input type="hidden" name="postId" value={post.id} />
                  <input type="hidden" name="returnTo" value={back} />
                  <SubmitButton size="sm" variant="secondary">
                    Back to draft
                  </SubmitButton>
                </form>
              )}
              {(post.status === "draft" ||
                post.status === "scheduled" ||
                post.status === "failed") && (
                <form action={cancelSocialPostAction}>
                  <input type="hidden" name="postId" value={post.id} />
                  <input type="hidden" name="returnTo" value="/admin/social" />
                  <SubmitButton
                    size="sm"
                    variant="ghost"
                    confirm="Cancel this post? It stays in the archive."
                  >
                    Cancel
                  </SubmitButton>
                </form>
              )}
              {post.status !== "published" && post.status !== "publishing" && (
                <form action={deleteSocialPostAction}>
                  <input type="hidden" name="postId" value={post.id} />
                  <SubmitButton
                    size="sm"
                    variant="ghost"
                    className="text-danger"
                    confirm="Delete this post and its uploaded images? This cannot be undone."
                  >
                    Delete
                  </SubmitButton>
                </form>
              )}
              {post.media_paths.length > 0 && (
                <form action={duplicateSocialPostAction}>
                  <input type="hidden" name="postId" value={post.id} />
                  <input
                    type="hidden"
                    name="platform"
                    value={post.platform === "pinterest" ? "instagram" : "pinterest"}
                  />
                  <SubmitButton size="sm" variant="secondary" pendingText="Copying…">
                    Also post to {post.platform === "pinterest" ? "Instagram" : "Pinterest"}
                  </SubmitButton>
                </form>
              )}
            </div>
          </Section>

          {post.source_files.length > 0 && (
            <Section title="Source">
              <ul className="text-xs text-muted-foreground">
                {post.source_files.map((f) => (
                  <li key={f}>guideless_photos/{f}</li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>
    </>
  );
}
