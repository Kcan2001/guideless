import Link from "next/link";
import { brand } from "@guideless/config";
import { formatDate } from "@guideless/utils";
import type { LegalDocument } from "@/content/legal/types";

/** Terms and Privacy share one calm layout: lede, version line, in-page contents, sections. */
export function LegalPage({ doc }: { doc: LegalDocument }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-16">
      <header className="max-w-3xl">
        <p className="eyebrow text-muted-foreground">
          {brand.legalName} · {brand.name}
        </p>
        <h1 className="mt-3 text-4xl md:text-5xl">{doc.title}</h1>
        <p className="mt-4 text-lg text-muted-foreground">{doc.lede}</p>
        <p className="mt-4 text-sm text-muted-foreground">
          Version {doc.version} · Last updated {formatDate(doc.lastUpdated)}
        </p>
      </header>

      <div className="mt-12 grid gap-12 lg:grid-cols-[260px_1fr]">
        <nav aria-label="Contents" className="lg:sticky lg:top-24 lg:self-start">
          <p className="font-heading text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Contents
          </p>
          <ol className="mt-3 space-y-2 text-sm">
            {doc.sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-muted-foreground no-underline hover:text-link">
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-sm text-muted-foreground">
            See also{" "}
            <Link
              href={doc.slug === "terms" ? "/privacy" : "/terms"}
              className="text-link no-underline hover:underline"
            >
              {doc.slug === "terms" ? "Privacy Policy" : "Terms of Service"}
            </Link>
            .
          </p>
        </nav>

        <article className="max-w-3xl space-y-10">
          {doc.sections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-24">
              <h2 className="text-2xl ">{s.title}</h2>
              {s.paragraphs?.map((p, i) => (
                <p key={i} className="mt-3 leading-relaxed text-foreground/90">
                  {p}
                </p>
              ))}
              {s.list && (
                <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-foreground/90">
                  {s.list.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
