import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { JsonLd } from "@/components/site/json-ld";
import { buttonVariants } from "@/components/ui/button";
import { listJournalPosts } from "@/lib/content/journal";
import { photoAlt } from "@/lib/photos";
import { breadcrumbJsonLd } from "@/lib/seo";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Journal",
  description:
    "Notes from the routes we run: where to stay, when to go, and what a week actually costs.",
  alternates: { canonical: "/journal" },
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function JournalIndexPage() {
  const posts = await listJournalPosts();
  const [lead, ...rest] = posts;

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Journal", path: "/journal" },
        ])}
      />

      <section className="mx-auto w-full max-w-6xl px-6 pt-20 pb-10">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-link">Journal</p>
        <h1 className="mt-3 max-w-3xl font-heading text-4xl font-bold md:text-5xl">
          Notes from the routes we run.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          Where to stay, when to go, and what a week actually costs. Every piece ends where the trip
          begins.
        </p>
      </section>

      {posts.length === 0 ? (
        <section className="mx-auto w-full max-w-6xl px-6 pb-24">
          <div className="rounded border border-border bg-surface p-10 text-center">
            <p className="font-heading text-xl font-semibold">The first piece is being written.</p>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">
              Until then, the trips themselves are the best read: each one lists its route, its
              hotels and every optional experience, priced.
            </p>
            <Link href="/tours" className={`${buttonVariants()} mt-6`}>
              Explore trips <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </section>
      ) : (
        <section className="mx-auto w-full max-w-6xl px-6 pb-24">
          {lead && (
            <Link
              href={`/journal/${lead.slug}`}
              className="group grid gap-6 no-underline md:grid-cols-2 md:items-center"
            >
              {lead.hero_image_url && (
                <div className="relative aspect-[4/3] overflow-hidden rounded">
                  <Image
                    src={lead.hero_image_url}
                    alt={photoAlt(lead.hero_image_url, lead.title)}
                    fill
                    sizes="(min-width: 768px) 50vw, 100vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    priority
                  />
                </div>
              )}
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {formatDate(lead.published_at)} · {lead.readingMinutes} min read
                </p>
                <h2 className="mt-3 font-heading text-3xl font-bold">{lead.title}</h2>
                <p className="mt-3 text-muted-foreground">{lead.summary}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 font-medium text-link">
                  Read <ArrowRight className="h-4 w-4" aria-hidden />
                </span>
              </div>
            </Link>
          )}

          {rest.length > 0 && (
            <ul className="mt-16 grid gap-8 border-t border-border pt-12 md:grid-cols-2 lg:grid-cols-3">
              {rest.map((post) => (
                <li key={post.id} className="grid">
                  <Link href={`/journal/${post.slug}`} className="group no-underline">
                    {post.hero_image_url && (
                      <div className="relative mb-4 aspect-[3/2] overflow-hidden rounded">
                        <Image
                          src={post.hero_image_url}
                          alt={photoAlt(post.hero_image_url, post.title)}
                          fill
                          sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                    )}
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      {formatDate(post.published_at)} · {post.readingMinutes} min
                    </p>
                    <h3 className="mt-2 font-heading text-xl font-semibold">{post.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{post.summary}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
