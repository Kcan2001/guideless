import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { formatDate, formatDateRange } from "@guideless/utils";
import { SurveyForm } from "@/components/surveys/survey-form";
import { FormError } from "@/components/ui/field";
import { getOpenSurvey, getSurveyAnswers } from "@/lib/surveys/queries";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your survey",
  robots: { index: false, follow: false },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One survey, on its own page rather than folded into the account page. Two reasons: there are ten
 * questions and they deserve room, and an email prompting somebody to answer needs somewhere to
 * link to.
 *
 * Which survey is open is not a URL parameter. The database decides — pre-trip until the trip ends,
 * post-trip after — so a stale link can never open the wrong one.
 */
export default async function SurveyPage(props: PageProps<"/account/surveys/[bookingId]">) {
  const [{ bookingId }, sp] = await Promise.all([props.params, props.searchParams]);
  if (!UUID.test(bookingId)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/account/surveys/${bookingId}`)}`);

  const survey = await getOpenSurvey(bookingId);
  if (!survey) notFound();
  const existing = await getSurveyAnswers(bookingId, survey.kind);
  const errorMsg = typeof sp.error_msg === "string" ? sp.error_msg : null;
  const pre = survey.kind === "pre_trip";

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <Link
        href="/account"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground no-underline hover:text-link"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to your account
      </Link>

      <p className="eyebrow mt-6 text-muted-foreground">{survey.tourName}</p>
      <h1 className="mt-2 font-heading text-3xl ">
        {pre ? "Before you go" : `How was ${survey.tripName}?`}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {formatDateRange(survey.startDate, survey.endDate)}
      </p>
      <p className="mt-4 text-muted-foreground">
        {pre
          ? "A few questions about what you are expecting. Knowing that before you arrive is the difference between a week that suits you and one that nearly does."
          : "This is private and stays that way — it is not a review and none of it goes on the site. Say the blunt version."}
      </p>
      {!pre && (
        <p className="mt-3 text-sm text-muted-foreground">
          If you would also like to write something the next traveler can read, there is a review
          form on{" "}
          <Link href="/account#reviews" className="text-link">
            your account page
          </Link>
          .
        </p>
      )}

      {existing && (
        <p className="mt-6 rounded border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
          You answered this on {formatDate(existing.submittedAt.slice(0, 10))}. Changing anything
          below replaces that answer.
        </p>
      )}

      {errorMsg && (
        <div className="mt-6">
          <FormError message={errorMsg} />
        </div>
      )}

      <SurveyForm survey={survey} existing={existing} />
    </div>
  );
}
