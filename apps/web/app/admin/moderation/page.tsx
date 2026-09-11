import Image from "next/image";
import { formatDate } from "@guideless/utils";
import { Flash } from "@/components/admin/flash";
import { SubmitButton } from "@/components/admin/submit-button";
import { PageHeader, Section, StatusBadge, inputClass } from "@/components/admin/ui";
import { Stars } from "@/components/reviews/stars";
import { setPhotoStatusAction, setReviewStatusAction } from "@/lib/admin/actions/moderation";
import { SUPPORT_ROLES, requireStaff } from "@/lib/auth/staff";
import {
  listPhotosForModeration,
  listReviewsForModeration,
  type ModerationPhoto,
  type ModerationReview,
} from "@/lib/reviews/moderation";

export const metadata = { title: "Moderation" };

const when = (iso: string) => formatDate(iso.slice(0, 10));

function ReviewRow({ review }: { review: ModerationReview }) {
  const pending = review.status === "pending";
  return (
    <article className="border-b border-border py-6 first:pt-0 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <Stars rating={review.rating} />
            <StatusBadge kind="generic" status={review.status} />
          </div>
          {review.title && <h3 className="mt-2 font-semibold">{review.title}</h3>}
          <p className="mt-1 text-sm text-muted-foreground">
            {review.authorName} · {review.tourName}
            {review.tripEndDate && ` · travelled ${when(review.tripEndDate)}`} · written{" "}
            {when(review.createdAt)}
            {review.wouldRepeat ? " · would travel again" : ""}
          </p>
        </div>
      </div>

      <p className="mt-3 whitespace-pre-line text-sm">{review.body}</p>
      {review.staffNote && (
        <p className="mt-2 text-sm text-muted-foreground">Staff note: {review.staffNote}</p>
      )}

      <form action={setReviewStatusAction} className="mt-4 flex flex-wrap items-center gap-2">
        <input type="hidden" name="reviewId" value={review.id} />
        <input
          name="note"
          className={`${inputClass} max-w-xs`}
          placeholder="Note (optional, staff only)"
          maxLength={500}
        />
        {pending || review.status === "rejected" ? (
          <>
            <input type="hidden" name="status" value="published" />
            <SubmitButton size="sm" pendingText="Publishing…">
              Publish
            </SubmitButton>
          </>
        ) : (
          <>
            <input type="hidden" name="status" value="rejected" />
            <SubmitButton
              size="sm"
              variant="secondary"
              pendingText="Removing…"
              confirm="Take this review off the site?"
            >
              Unpublish
            </SubmitButton>
          </>
        )}
      </form>

      {pending && (
        <form action={setReviewStatusAction} className="mt-2">
          <input type="hidden" name="reviewId" value={review.id} />
          <input type="hidden" name="status" value="rejected" />
          <SubmitButton
            size="sm"
            variant="secondary"
            pendingText="Rejecting…"
            confirm="Reject this review? The traveler is not told."
          >
            Reject
          </SubmitButton>
        </form>
      )}
    </article>
  );
}

function PhotoRow({ photo }: { photo: ModerationPhoto }) {
  return (
    <article className="border-b border-border py-6 first:pt-0 last:border-0 last:pb-0">
      <div className="flex flex-wrap gap-4">
        <div className="relative h-32 w-44 shrink-0 overflow-hidden rounded bg-cloud">
          {photo.signedUrl ? (
            <Image
              src={photo.signedUrl}
              alt={photo.caption ?? "Traveler photo awaiting moderation"}
              fill
              sizes="176px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <span className="flex h-full items-center justify-center px-2 text-center text-xs text-muted-foreground">
              Preview unavailable
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <StatusBadge kind="generic" status={photo.status} />
          {photo.caption && <p className="mt-2 text-sm">{photo.caption}</p>}
          <p className="mt-1 text-sm text-muted-foreground">
            {photo.authorName} · {photo.tourName} · added {when(photo.createdAt)}
          </p>
          {photo.staffNote && (
            <p className="mt-1 text-sm text-muted-foreground">Staff note: {photo.staffNote}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <form action={setPhotoStatusAction} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="photoId" value={photo.id} />
              <input
                type="hidden"
                name="status"
                value={photo.status === "published" ? "rejected" : "published"}
              />
              <SubmitButton
                size="sm"
                variant={photo.status === "published" ? "secondary" : "primary"}
              >
                {photo.status === "published" ? "Unpublish" : "Publish"}
              </SubmitButton>
            </form>
            {photo.status === "pending" && (
              <form action={setPhotoStatusAction}>
                <input type="hidden" name="photoId" value={photo.id} />
                <input type="hidden" name="status" value="rejected" />
                <SubmitButton size="sm" variant="secondary" confirm="Reject this photo?">
                  Reject
                </SubmitButton>
              </form>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export default async function ModerationPage(props: PageProps<"/admin/moderation">) {
  const [sp] = await Promise.all([props.searchParams, requireStaff(SUPPORT_ROLES)]);
  const [reviews, photos] = await Promise.all([
    listReviewsForModeration(),
    listPhotosForModeration(),
  ]);

  const pendingReviews = reviews.filter((r) => r.status === "pending");
  const decidedReviews = reviews.filter((r) => r.status !== "pending");
  const pendingPhotos = photos.filter((p) => p.status === "pending");
  const decidedPhotos = photos.filter((p) => p.status !== "pending");

  return (
    <>
      <PageHeader
        title="Moderation"
        description="Reviews and photos travelers sent after their trip. Nothing appears on the site until it is published here."
      />
      <Flash searchParams={sp} />

      <div className="grid gap-6">
        <Section
          title={`${pendingReviews.length} review${pendingReviews.length === 1 ? "" : "s"} waiting`}
          description="Written by travelers whose trip has ended. Publish what reads like a person; reject spam or anything that names another traveler."
        >
          {pendingReviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing waiting. Reviews can only be written after a trip has ended, so this stays
              empty until the first departures come home.
            </p>
          ) : (
            pendingReviews.map((r) => <ReviewRow key={r.id} review={r} />)
          )}
        </Section>

        <Section
          title={`${pendingPhotos.length} photo${pendingPhotos.length === 1 ? "" : "s"} waiting`}
          description="Photos from travelers on trips that have finished."
        >
          {pendingPhotos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing waiting.</p>
          ) : (
            pendingPhotos.map((p) => <PhotoRow key={p.id} photo={p} />)
          )}
        </Section>

        {decidedReviews.length > 0 && (
          <Section
            title="Decided reviews"
            description="Published or rejected. You can change your mind."
          >
            {decidedReviews.map((r) => (
              <ReviewRow key={r.id} review={r} />
            ))}
          </Section>
        )}

        {decidedPhotos.length > 0 && (
          <Section title="Decided photos">
            {decidedPhotos.map((p) => (
              <PhotoRow key={p.id} photo={p} />
            ))}
          </Section>
        )}
      </div>
    </>
  );
}
