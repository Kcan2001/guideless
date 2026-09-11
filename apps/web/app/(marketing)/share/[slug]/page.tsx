import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { brand } from "@guideless/config";
import { ShareForm } from "@/components/testimonials/share-form";
import { ShareFlash } from "@/components/testimonials/share-flash";
import { createPublicClient } from "@/lib/supabase/public";
import { Suspense } from "react";

/**
 * The page behind the link Kyle sends to somebody who came on an earlier trip.
 *
 * Deliberately not linked from anywhere. It is not a marketing page and it should not be indexed
 * or discovered — it only makes sense to somebody who got the message that explains it.
 */
export const metadata: Metadata = {
  title: "Tell us about it",
  robots: { index: false, follow: false },
};

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  const sb = createPublicClient();
  const { data } = await sb.from("tours").select("slug").eq("is_published", true);
  return (data ?? []).map((t) => ({ slug: t.slug }));
}

export default async function SharePage({ params }: PageProps<"/share/[slug]">) {
  const { slug } = await params;
  const sb = createPublicClient();
  const { data: tour } = await sb.from("tours").select("name, slug").eq("slug", slug).maybeSingle();
  if (!tour) notFound();

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-16">
      <p className="eyebrow text-muted-foreground">{brand.shortName}</p>
      <h1 className="mt-3 font-heading text-4xl ">Tell us about {tour.name}.</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        You came on one of these before it had a name. If you have a minute, a sentence about what
        it was actually like would help the next group decide to come.
      </p>
      <p className="mt-3 text-muted-foreground">
        It goes on the trip page with your first name and the year &mdash; kept separate from
        reviews, which are only for people who book through Guideless. Nothing appears until Kyle
        has sent you the wording.
      </p>

      <Suspense fallback={null}>
        <ShareFlash />
      </Suspense>

      <div className="mt-10">
        <ShareForm tourSlug={tour.slug} tourName={tour.name} />
      </div>
    </div>
  );
}
