import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { JsonLd } from "@/components/site/json-ld";
import { Prose } from "@/components/content/prose";
import { buttonVariants } from "@/components/ui/button";
import { getJournalPost, listJournalSlugs } from "@/lib/content/journal";
import { markdownToPlainText } from "@/lib/content/markdown";
import { articleJsonLd } from "@/lib/content/seo";
import { photoAlt } from "@/lib/photos";
import { breadcrumbJsonLd } from "@/lib/seo";

export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams() {
  const posts = await listJournalSlugs();
  return posts.map(({ slug }) => ({ slug }));
}

export async function generateMetadata(props: PageProps<"/journal/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const post = await getJournalPost(slug);
  if (!post) return { title: "Post not found" };
  const description =
    post.seo_description ?? post.excerpt ?? markdownToPlainText(post.body_markdown, 180);
  return {
    title: post.seo_title ?? post.title,
    description,
    alternates: { canonical: `/journal/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.seo_title ?? post.title,
      description,
      ...(post.og_image_url || post.hero_image_url
        ? { images: [{ url: (post.og_image_url ?? post.hero_image_url) as string }] }
        : {}),
      ...(post.published_at ? { publishedTime: post.published_at } : {}),
    },
  };
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function JournalPostPage(props: PageProps<"/journal/[slug]">) {
  const { slug } = await props.params;
  const post = await getJournalPost(slug);
  if (!post) notFound();

  const description =
    post.seo_description ?? post.excerpt ?? markdownToPlainText(post.body_markdown, 180);

  return (
    <>
      <JsonLd
        data={articleJsonLd({
          title: post.title,
          description,
          slug: post.slug,
          publishedAt: post.published_at,
          updatedAt: post.updated_at,
          imageUrl: post.hero_image_url ?? post.og_image_url,
          authorName: post.author_name,
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Journal", path: "/journal" },
          { name: post.title, path: `/journal/${post.slug}` },
        ])}
      />

      <article className="mx-auto w-full max-w-3xl px-6 pt-16 pb-24">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <Link href="/journal">Journal</Link>
          <span className="mx-2" aria-hidden>
            /
          </span>
          <span>{post.title}</span>
        </nav>

        <header className="mt-8">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {formatDate(post.published_at)}
            {post.author_name ? ` · ${post.author_name}` : ""} · {post.readingMinutes} min read
          </p>
          <h1 className="mt-3 font-heading text-4xl font-bold md:text-5xl">{post.title}</h1>
          {post.excerpt && <p className="mt-4 text-lg text-muted-foreground">{post.excerpt}</p>}
        </header>

        {post.hero_image_url && (
          <div className="relative mt-10 aspect-[16/9] overflow-hidden rounded">
            <Image
              src={post.hero_image_url}
              alt={photoAlt(post.hero_image_url, post.title)}
              fill
              sizes="(min-width: 768px) 768px, 100vw"
              className="object-cover"
              priority
            />
          </div>
        )}

        <Prose markdown={post.body_markdown} className="mt-10" />

        <aside className="mt-16 rounded border border-border bg-sand/40 p-8">
          {post.tour ? (
            <>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                The trip behind this
              </p>
              <h2 className="mt-2 font-heading text-2xl font-bold">{post.tour.name}</h2>
              <p className="mt-2 text-muted-foreground">
                Hotels, trains and one good evening at the start are handled. Choose where you stay
                and what you join.
              </p>
              <Link href={`/tours/${post.tour.slug}`} className={`${buttonVariants()} mt-5`}>
                Build this trip <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </>
          ) : (
            <>
              <h2 className="font-heading text-2xl font-bold">
                Everything planned. Nothing forced.
              </h2>
              <p className="mt-2 text-muted-foreground">
                Hotels, trains and one good evening at the start. The rest of the week is yours.
              </p>
              <Link href="/tours" className={`${buttonVariants()} mt-5`}>
                Explore trips <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </>
          )}
        </aside>
      </article>
    </>
  );
}
