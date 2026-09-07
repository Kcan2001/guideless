import Image from "next/image";
import Link from "next/link";
import { SOCIAL_POST_STATUSES } from "@guideless/types";
import { Flash } from "@/components/admin/flash";
import { PageHeader, Section, Stat, Table, inputClass } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { CONTENT_ROLES, requireStaff } from "@/lib/auth/staff";
import {
  SOCIAL_STATUS_VARIANT,
  listSocialPosts,
  socialMediaUrl,
  socialQueueSummary,
  type SocialPostStatus,
} from "@/lib/admin/social";

export const metadata = { title: "Social" };

function when(iso: string | null): string {
  if (!iso) return "—";
  return (
    new Date(iso).toLocaleString("en-GB", {
      timeZone: "UTC",
      dateStyle: "medium",
      timeStyle: "short",
    }) + " UTC"
  );
}

export default async function AdminSocialPage(props: PageProps<"/admin/social">) {
  await requireStaff(CONTENT_ROLES, "/admin/social");
  const sp = await props.searchParams;
  const status =
    typeof sp.status === "string" && (SOCIAL_POST_STATUSES as readonly string[]).includes(sp.status)
      ? (sp.status as SocialPostStatus)
      : undefined;
  const all = await listSocialPosts();
  const posts = status ? all.filter((p) => p.status === status) : all;
  const summary = await socialQueueSummary(all);

  return (
    <>
      <PageHeader
        title="Social"
        description={
          <>
            Instagram queue for <strong>@guidelesstravel</strong>. Drop photos in{" "}
            <code>guideless_photos/</code>, run <code>pnpm social:import</code>, finish captions
            here and schedule. The publisher runs every 10 minutes.
          </>
        }
      />
      <Flash searchParams={sp} />

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Stat label="Drafts" value={summary.drafts} hint="Need a caption or a time" />
        <Stat
          label="Scheduled"
          value={summary.scheduled}
          hint={
            summary.nextScheduledAt ? `Next ${when(summary.nextScheduledAt)}` : "Nothing queued"
          }
          tone={summary.scheduled ? "good" : "neutral"}
        />
        <Stat
          label="Failed"
          value={summary.failed}
          tone={summary.failed ? "warning" : "neutral"}
          hint="Open to see the error"
        />
        <Stat label="Published this month" value={summary.publishedThisMonth} />
      </div>

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3 text-sm">
        <label className="text-xs font-medium text-muted-foreground">
          Status
          <select name="status" defaultValue={status ?? ""} className={inputClass + " w-44"}>
            <option value="">Any</option>
            {SOCIAL_POST_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={buttonVariants({ variant: "secondary", size: "sm" })}>
          Filter
        </button>
      </form>

      <Section title={`${posts.length} post${posts.length === 1 ? "" : "s"}`}>
        <Table
          head={["Media", "Caption", "Kind", "Status", "Scheduled", "Published", ""]}
          empty={
            <>
              No posts yet. Add photos to <code>guideless_photos/</code> and run{" "}
              <code>pnpm social:import</code>.
            </>
          }
          rows={posts.map((p) => [
            <div key="m" className="flex -space-x-2">
              {p.media_paths.slice(0, 3).map((path, i) => (
                <Image
                  key={path}
                  src={socialMediaUrl(path)}
                  alt={p.alt_texts[i] || ""}
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded-md border border-border object-cover"
                />
              ))}
              {p.media_paths.length > 3 && (
                <span className="ml-3 self-center text-xs text-muted-foreground">
                  +{p.media_paths.length - 3}
                </span>
              )}
              {p.media_paths.length === 0 && (
                <span className="text-xs text-muted-foreground">no media</span>
              )}
            </div>,
            <div key="c" className="max-w-md">
              <p className="line-clamp-2">
                {p.caption || <em className="text-muted-foreground">No caption yet</em>}
              </p>
              {p.hashtags.length > 0 && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {p.hashtags.map((h) => `#${h}`).join(" ")}
                </p>
              )}
            </div>,
            p.kind,
            <Badge key="s" variant={SOCIAL_STATUS_VARIANT[p.status]}>
              {p.status}
            </Badge>,
            when(p.scheduled_at),
            p.permalink ? (
              <a key="l" href={p.permalink} target="_blank" rel="noopener noreferrer">
                {when(p.published_at)}
              </a>
            ) : (
              when(p.published_at)
            ),
            <Link key="e" href={`/admin/social/${p.id}`} className="text-link">
              Open
            </Link>,
          ])}
        />
      </Section>
    </>
  );
}
