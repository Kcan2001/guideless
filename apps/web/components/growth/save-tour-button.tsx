import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleSavedTourAction } from "@/lib/growth/saved-actions";

/**
 * Keep a tour for later.
 *
 * A form rather than a client component: it works before JavaScript loads, which matters on a
 * marketing page somebody opened on a train. Signed-out visitors are sent to sign in and returned
 * to the page they were reading, rather than being told they cannot.
 *
 * It does not know whether *you* already saved this, and that is deliberate: the tour page is
 * statically generated, so reading a session here would force it dynamic and cost the cache on the
 * page that matters most. The action toggles either way, and "what I saved" lives on the account
 * page where per-person state belongs.
 *
 * The save count is only shown once enough people have saved it. "1 person saved this" is worse
 * than saying nothing — the same reasoning the roster stats already use.
 */
export function SaveTourButton({
  tourId,
  slug,
  saveCount,
}: {
  tourId: string;
  slug: string;
  saveCount: number | null;
}) {
  return (
    <form action={toggleSavedTourAction} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="tourId" value={tourId} />
      <input type="hidden" name="slug" value={slug} />
      <Button type="submit" variant="secondary" size="sm">
        <Bookmark className="h-4 w-4" aria-hidden />
        Save for later
      </Button>
      {saveCount !== null && (
        <span className="text-sm text-muted-foreground">
          {saveCount} people are keeping an eye on this
        </span>
      )}
    </form>
  );
}
