import { formatDate } from "@guideless/utils";
import { PageHeader, Section, Stat, Table } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { listSurveyResponses, listSurveyStats, type SurveyResponse } from "@/lib/admin/surveys";
import { requireStaff } from "@/lib/auth/staff";

export const metadata = { title: "Surveys" };

/**
 * Private feedback, before and after a trip. Read-only on purpose: there is no moderation queue
 * here because nothing on this page is ever published. Reviews are the public surface and they
 * have their own screen.
 *
 * Gated at any staff role, which is exactly what the table's RLS allows — a page stricter than the
 * database would only be theatre, and one looser than it would show an empty screen.
 */
export default async function AdminSurveysPage() {
  await requireStaff();
  const [stats, responses] = await Promise.all([listSurveyStats(), listSurveyResponses()]);

  const post = responses.filter((r) => r.kind === "post_trip");
  const pre = responses.filter((r) => r.kind === "pre_trip");
  const repeats = post.filter((r) => r.wouldRepeat !== null);
  const wouldRepeat = repeats.filter((r) => r.wouldRepeat).length;

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Surveys"
        description="What travelers told us privately. Never published — this is the half nobody would put on a tour page."
      />

      {responses.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Before a trip" value={pre.length} hint="what people expect" />
          <Stat label="After a trip" value={post.length} hint="what actually happened" />
          <Stat
            label="Would travel again"
            value={repeats.length === 0 ? "—" : `${wouldRepeat} of ${repeats.length}`}
            hint={repeats.length === 0 ? "nobody has answered yet" : "of those who answered"}
            tone={repeats.length > 0 && wouldRepeat === repeats.length ? "good" : "neutral"}
          />
        </div>
      )}

      <Section
        title="Averages by tour"
        description="Read the response count first. A 5.0 from one answer is one person, not a signal."
      >
        <Table
          head={["Tour", "Survey", "Responses", ...(stats[0]?.scores.map((s) => s.label) ?? [])]}
          rows={stats.map((s) => [
            s.tourName,
            <Badge key="k" variant={s.kind === "post_trip" ? "info" : "neutral"}>
              {s.kind === "post_trip" ? "after" : "before"}
            </Badge>,
            s.responses,
            ...s.scores.map((score) => score.value?.toFixed(2) ?? "—"),
          ])}
          empty="Nobody has answered a survey yet. Nothing is averaged until somebody does."
        />
      </Section>

      <Section
        title="Responses"
        description="Newest first. Names are here because, unlike a review, this may be worth following up on."
      >
        {responses.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing yet. Travelers are prompted from their account and from the app.
          </p>
        ) : (
          <div className="grid gap-6">
            {responses.map((r) => (
              <ResponseCard key={r.id} response={r} />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

const PACE: Record<string, string> = {
  relaxed: "expects a slow week",
  balanced: "expects a balanced week",
  full: "expects a full week",
};

function ResponseCard({ response: r }: { response: SurveyResponse }) {
  const answered = r.scores.filter((s) => s.value !== null);
  return (
    <article className="border-b border-border pb-6 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={r.kind === "post_trip" ? "info" : "neutral"}>
          {r.kind === "post_trip" ? "after" : "before"}
        </Badge>
        <p className="text-sm font-medium">{r.travelerName}</p>
        <p className="text-sm text-muted-foreground">
          {r.tripName || r.tourName} · {formatDate(r.submittedAt.slice(0, 10))}
        </p>
        {r.wouldRepeat === false && <Badge variant="danger">would not travel again</Badge>}
      </div>

      {answered.length > 0 && (
        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {answered.map((s) => (
            <div key={s.label} className="flex items-baseline gap-1.5">
              <dt className="text-muted-foreground">{s.label}</dt>
              <dd className="font-medium">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {r.answers.pace && (
        <p className="mt-2 text-sm text-muted-foreground">
          {PACE[r.answers.pace] ?? r.answers.pace}
          {r.answers.heard_about ? ` · found us via ${r.answers.heard_about}` : ""}
        </p>
      )}
      {!r.answers.pace && r.answers.heard_about && (
        <p className="mt-2 text-sm text-muted-foreground">Found us via {r.answers.heard_about}</p>
      )}

      <Quote label={r.kind === "pre_trip" ? "Hoping for" : "Anything else"} text={r.expectations} />
      <Quote label="Best part" text={r.bestBit} />
      <Quote label="Worst part" text={r.worstBit} />
    </article>
  );
}

function Quote({ label, text }: { label: string; text: string | null }) {
  if (!text) return null;
  return (
    <div className="mt-3">
      <p className="eyebrow text-muted-foreground">{label}</p>
      <p className="mt-0.5 whitespace-pre-line text-sm">{text}</p>
    </div>
  );
}
