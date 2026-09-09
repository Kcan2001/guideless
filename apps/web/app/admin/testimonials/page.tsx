import { PageHeader, Section, Table } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Flash } from "@/components/admin/flash";
import { SubmitButton } from "@/components/admin/submit-button";
import { TestimonialForm } from "@/components/admin/testimonial-form";
import { requireStaff, CONTENT_ROLES } from "@/lib/auth/staff";
import { listAllTestimonials, listTourOptions } from "@/lib/admin/testimonials";
import {
  deleteTestimonialAction,
  saveTestimonialAction,
  setTestimonialStatusAction,
} from "@/lib/admin/actions/testimonials";

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
  const [sp, rows, tours] = await Promise.all([
    props.searchParams,
    listAllTestimonials(),
    listTourOptions(),
  ]);

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
        title="Add one"
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
