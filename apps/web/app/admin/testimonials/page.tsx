import { PageHeader, Section, Table } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Flash } from "@/components/admin/flash";
import { SubmitButton } from "@/components/admin/submit-button";
import { TestimonialForm } from "@/components/admin/testimonial-form";
import { requireStaff, CONTENT_ROLES } from "@/lib/auth/staff";
import { listAllTestimonials, listSubmissions, listTourOptions } from "@/lib/admin/testimonials";
import {
  declineSubmissionAction,
  deleteTestimonialAction,
  saveTestimonialAction,
  setTestimonialStatusAction,
  useSubmissionAction,
  useSubmissionPhotoAction,
} from "@/lib/admin/actions/testimonials";
import { siteUrl } from "@/lib/seo";

export const metadata = { title: "Testimonials" };
export const dynamic = "force-dynamic";

/**
 * Quotes from Monaco weekends run before Guideless existed.
 *
 * Kept well away from /admin/moderation, which is for reviews and photos written by travelers who
 * booked with us. These are a different claim and they carry no rating, which is what stops them
 * ever reaching a tour page's star count.
 */
export default async function AdminTestimonialsPage(props: PageProps<"/admin/testimonials">) {
  await requireStaff(CONTENT_ROLES);
  const [sp, rows, tours, submissions] = await Promise.all([
    props.searchParams,
    listAllTestimonials(),
    listTourOptions(),
    listSubmissions(),
  ]);
  const waitingOn = submissions.filter((s) => s.status === "new");

  const published = rows.filter((r) => r.status === "published");
  const waiting = rows.filter((r) => r.status !== "published");

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Testimonials"
        description="Quotes from earlier trips. Not reviews — they carry no rating and never touch a tour's star count. Nothing publishes until you confirm the person agreed to be quoted."
      />
      <Flash searchParams={sp} />

      <Section
        title="The link to send"
        description="Send this to somebody who came on an earlier trip. They write it themselves and tick their own consent box, which is a better record than you ticking it for them. Nothing they send appears anywhere until you make a draft from it and publish."
      >
        <ul className="grid gap-2">
          {tours.map((t) => (
            <li key={t.id} className="flex flex-wrap items-baseline gap-3 text-sm">
              <span className="font-medium">{t.name}</span>
              <code className="rounded bg-cloud px-2 py-1 text-xs">
                {siteUrl(`/share/${t.slug}`)}
              </code>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title={`Sent in (${waitingOn.length} waiting)`}
        description="Straight from the people who were there. Making a draft copies the quote across and carries their consent with it."
      >
        {submissions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing yet. The link above is the only way in.
          </p>
        ) : (
          <ul className="grid gap-4">
            {submissions.map((sub) => (
              <li key={sub.id} className="rounded-xl border border-border p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <p className="font-medium">
                    {sub.author_name}
                    {sub.trip_year ? ` · ${sub.trip_year}` : ""}
                    {sub.tourName ? ` · ${sub.tourName}` : ""}
                  </p>
                  <Badge variant={sub.status === "new" ? "included" : "optional"}>
                    {sub.status}
                  </Badge>
                </div>
                <blockquote className="mt-3 border-l-2 border-teal pl-4 text-sm">
                  {sub.quote}
                </blockquote>
                <p className="mt-3 text-xs text-muted-foreground">
                  {sub.email} · sent {sub.created_at.slice(0, 10)} ·{" "}
                  {sub.consent_photos ? "photos allowed" : "photos not allowed"}
                </p>

                {sub.photos.length > 0 && (
                  <ul className="mt-4 flex flex-wrap gap-3">
                    {sub.photos.map((p) => (
                      <li key={p.path} className="w-28">
                        {p.url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={p.url}
                            alt=""
                            className="h-24 w-28 rounded-lg border border-border object-cover"
                          />
                        ) : (
                          <div className="h-24 w-28 rounded-lg border border-border bg-cloud" />
                        )}
                        {sub.testimonial_id && sub.consent_photos && (
                          <form action={useSubmissionPhotoAction} className="mt-1">
                            <input type="hidden" name="submissionId" value={sub.id} />
                            <input type="hidden" name="path" value={p.path} />
                            <SubmitButton size="sm" variant="secondary" pendingText="…">
                              Use this
                            </SubmitButton>
                          </form>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {sub.status === "new" && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <form action={useSubmissionAction}>
                      <input type="hidden" name="submissionId" value={sub.id} />
                      <SubmitButton size="sm" pendingText="…">
                        Make a draft from it
                      </SubmitButton>
                    </form>
                    <form action={declineSubmissionAction}>
                      <input type="hidden" name="submissionId" value={sub.id} />
                      <SubmitButton size="sm" variant="secondary" pendingText="…">
                        Set aside
                      </SubmitButton>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Add one by hand"
        description="Paste the quote as they wrote it. Trim for length if you must; do not rewrite it."
      >
        <TestimonialForm action={saveTestimonialAction} tours={tours} submitLabel="Add" />
      </Section>

      <Section
        title={`Live (${published.length})`}
        description="Showing on their tour page right now. One without a tour attached is live but has nowhere to appear."
      >
        <Table
          head={["Quote", "Who", "Trip", "On tour", "Order", ""]}
          rows={published.map((t) => [
            <span key="q" className="line-clamp-2 max-w-md">
              {t.quote}
            </span>,
            t.author_name,
            t.trip_label,
            t.tourName ?? "—",
            t.position,
            <form key="a" action={setTestimonialStatusAction}>
              <input type="hidden" name="testimonialId" value={t.id} />
              <input type="hidden" name="status" value="pending" />
              <SubmitButton size="sm" variant="secondary" pendingText="…">
                Take down
              </SubmitButton>
            </form>,
          ])}
          empty="Nothing published yet."
        />
      </Section>

      <Section
        title={`Drafts (${waiting.length})`}
        description="Not visible to anyone outside admin. A draft without consent confirmed cannot be published."
      >
        <Table
          head={["Quote", "Who", "Trip", "Consent", "", ""]}
          rows={waiting.map((t) => [
            <span key="q" className="line-clamp-2 max-w-md">
              {t.quote}
            </span>,
            t.author_name,
            t.trip_label,
            t.consent_confirmed ? (
              <Badge key="c" variant="included">
                confirmed
              </Badge>
            ) : (
              <span key="c" className="text-sm text-muted-foreground">
                not confirmed
              </span>
            ),
            <form key="p" action={setTestimonialStatusAction}>
              <input type="hidden" name="testimonialId" value={t.id} />
              <input type="hidden" name="status" value="published" />
              <SubmitButton size="sm" pendingText="…" disabled={!t.consent_confirmed}>
                Publish
              </SubmitButton>
            </form>,
            <form key="d" action={deleteTestimonialAction}>
              <input type="hidden" name="testimonialId" value={t.id} />
              <SubmitButton size="sm" variant="secondary" pendingText="…">
                Delete
              </SubmitButton>
            </form>,
          ])}
          empty="No drafts."
        />
      </Section>

      {rows.length > 0 && (
        <Section title="Edit" description="Pick one to change. Saving replaces what is there.">
          <div className="grid gap-8">
            {rows.map((t) => (
              <details key={t.id} className="rounded-xl border border-border p-4">
                <summary className="cursor-pointer text-sm font-medium">
                  {t.author_name} · {t.trip_label}
                </summary>
                <div className="mt-4">
                  <TestimonialForm
                    action={saveTestimonialAction}
                    testimonial={t}
                    tours={tours}
                    submitLabel="Save"
                  />
                </div>
              </details>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
