import { MARKETABLE_SEGMENTS } from "@guideless/validation";
import { PageHeader, Section, Stat, Table, inputClass, labelClass } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Flash } from "@/components/admin/flash";
import { SubmitButton } from "@/components/admin/submit-button";
import { CONTENT_ROLES, requireStaff } from "@/lib/auth/staff";
import { listCampaigns, listMailingList } from "@/lib/admin/email";
import {
  saveCampaignAction,
  sendCampaignAction,
  testCampaignAction,
} from "@/lib/admin/actions/email";

export const metadata = { title: "Email" };
export const dynamic = "force-dynamic";

const SEGMENT_LABELS: Record<string, string> = {
  newsletter: "Newsletter",
  destination_alert: "Asked about a place",
  waitlist: "On a waiting list",
  host_applicant: "Applied to host",
  testimonial: "Sent a testimonial",
};

/**
 * The mailing list and the thing that sends to it.
 *
 * The split at the top of this page is the important part. Two of the five groups gave us their
 * address to do one specific thing — apply to host, send a quote — and they are shown so they can
 * be replied to, not broadcast at. The composer will not accept them as a segment and neither will
 * sendCampaign(); this page just makes the reason visible.
 */
export default async function AdminEmailPage(props: PageProps<"/admin/email">) {
  await requireStaff(CONTENT_ROLES);
  const [sp, list, campaigns] = await Promise.all([
    props.searchParams,
    listMailingList(),
    listCampaigns(),
  ]);

  const bySegment = new Map<string, number>();
  const contexts = new Map<string, Set<string>>();
  for (const r of list) {
    bySegment.set(r.segment, (bySegment.get(r.segment) ?? 0) + 1);
    if (r.context) {
      const set = contexts.get(r.segment) ?? new Set<string>();
      set.add(r.context);
      contexts.set(r.segment, set);
    }
  }
  const marketable = list.filter((r) => r.can_market);
  const reachable = new Set(marketable.map((r) => r.email.toLowerCase())).size;
  const draft = campaigns.find((c) => c.status === "draft");

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Email"
        description="Everyone whose address we hold, and the one way to write to them. Nothing sends without a test to yourself first."
      />
      <Flash searchParams={sp} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="People we can email"
          value={reachable}
          hint="deduplicated, marketing consent"
        />
        <Stat label="Addresses on file" value={list.length} hint="across every list" />
        <Stat
          label="Reply only"
          value={list.length - marketable.length}
          hint="gave it to us for one thing"
        />
      </div>

      <Section
        title="The lists"
        description="A segment marked reply-only cannot be sent a campaign. They gave us an address to apply or to send us a quote, not to hear from us — that is not a setting, it is what they agreed to."
      >
        <Table
          head={["List", "People", "What they agreed to", "About"]}
          rows={[...bySegment.entries()].map(([segment, count]) => {
            const sample = [...(contexts.get(segment) ?? [])].slice(0, 4);
            return [
              SEGMENT_LABELS[segment] ?? segment,
              count,
              (MARKETABLE_SEGMENTS as readonly string[]).includes(segment) ? (
                <Badge key="c" variant="included">
                  can be emailed
                </Badge>
              ) : (
                <Badge key="c" variant="optional">
                  reply only
                </Badge>
              ),
              sample.length > 0
                ? sample.join(", ") + ((contexts.get(segment)?.size ?? 0) > 4 ? "…" : "")
                : "—",
            ];
          })}
          empty="Nobody has given us an address yet."
        />
      </Section>

      <Section
        title={draft ? "Your draft" : "Write one"}
        description="Plain text. Leave a blank line between paragraphs and the template does the rest — there is no HTML field on purpose."
      >
        <form action={saveCampaignAction} className="grid gap-4 sm:grid-cols-2">
          {draft && <input type="hidden" name="campaignId" value={draft.id} />}
          <label className="sm:col-span-2">
            <span className={labelClass}>Subject</span>
            <input
              name="subject"
              defaultValue={draft?.subject ?? ""}
              className={inputClass}
              required
              minLength={3}
              maxLength={200}
            />
          </label>
          <label className="sm:col-span-2">
            <span className={labelClass}>Preheader (the small line above the heading)</span>
            <input
              name="preheader"
              defaultValue={draft?.preheader ?? ""}
              className={inputClass}
              maxLength={200}
            />
          </label>
          <label className="sm:col-span-2">
            <span className={labelClass}>The email</span>
            <textarea
              name="body"
              defaultValue={draft?.body ?? ""}
              className={inputClass}
              rows={12}
              required
              minLength={10}
              maxLength={20000}
            />
          </label>
          <label>
            <span className={labelClass}>Send to</span>
            <select
              name="segment"
              defaultValue={draft?.segment ?? "newsletter"}
              className={inputClass}
            >
              {MARKETABLE_SEGMENTS.map((s) => (
                <option key={s} value={s}>
                  {SEGMENT_LABELS[s]} ({bySegment.get(s) ?? 0})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelClass}>Only those who asked about (optional)</span>
            <input
              name="context"
              defaultValue={draft?.context ?? ""}
              className={inputClass}
              maxLength={120}
              placeholder="Lisbon"
            />
          </label>
          <label>
            <span className={labelClass}>Button label (optional)</span>
            <input
              name="ctaLabel"
              defaultValue={draft?.cta_label ?? ""}
              className={inputClass}
              maxLength={60}
              placeholder="See the dates"
            />
          </label>
          <label>
            <span className={labelClass}>Button link</span>
            <input
              name="ctaUrl"
              type="url"
              defaultValue={draft?.cta_url ?? ""}
              className={inputClass}
            />
          </label>
          <div className="sm:col-span-2">
            <SubmitButton pendingText="Saving…">{draft ? "Save draft" : "Save draft"}</SubmitButton>
          </div>
        </form>

        {draft && (
          <div className="mt-8 grid gap-4 border-t border-border pt-6">
            <form action={testCampaignAction} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="campaignId" value={draft.id} />
              <SubmitButton variant="secondary" pendingText="Sending…">
                Send it to me first
              </SubmitButton>
              <span className="text-sm text-muted-foreground">
                Exactly what a recipient gets, with a dead unsubscribe link.
              </span>
            </form>

            <form action={sendCampaignAction} className="grid gap-3">
              <input type="hidden" name="campaignId" value={draft.id} />
              <label className="flex items-start gap-3">
                <input type="checkbox" name="confirm" className="mt-1" />
                <span className="text-sm">
                  I have read the test. Send this to{" "}
                  <span className="font-medium">
                    {bySegment.get(draft.segment) ?? 0} people on {SEGMENT_LABELS[draft.segment]}
                  </span>
                  {draft.context ? ` who asked about ${draft.context}` : ""}.
                </span>
              </label>
              <div>
                <SubmitButton pendingText="Sending…">Send it</SubmitButton>
              </div>
            </form>
          </div>
        )}
      </Section>

      <Section title="Sent" description="Every campaign, and who it reached.">
        <Table
          head={["Subject", "List", "Status", "Sent"]}
          rows={campaigns
            .filter((c) => c.status !== "draft")
            .map((c) => [
              c.subject,
              SEGMENT_LABELS[c.segment] ?? c.segment,
              <Badge key="s" variant={c.status === "sent" ? "included" : "optional"}>
                {c.status}
              </Badge>,
              c.sent_at ? `${c.recipientCount} · ${c.sent_at.slice(0, 10)}` : "—",
            ])}
          empty="Nothing sent yet."
        />
      </Section>
    </div>
  );
}
