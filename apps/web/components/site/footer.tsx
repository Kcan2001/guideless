import Link from "next/link";
import { brand } from "@guideless/config";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-surface">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-14 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <p className="font-heading text-lg font-bold">{brand.name}</p>
          <p className="mt-3 max-w-sm text-muted-foreground">{brand.tagline}</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">{brand.taglineSecondary}</p>
        </div>
        <nav aria-label="Footer — trips" className="text-sm">
          <p className="font-semibold">Trips</p>
          <ul className="mt-3 space-y-2">
            <li>
              <Link href="/tours" className="text-muted-foreground no-underline hover:text-link">
                All trips
              </Link>
            </li>
            <li>
              <Link
                href="/destinations"
                className="text-muted-foreground no-underline hover:text-link"
              >
                Destinations
              </Link>
            </li>
            <li>
              <Link
                href="/how-it-works"
                className="text-muted-foreground no-underline hover:text-link"
              >
                How it works
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Footer — company" className="text-sm">
          <p className="font-semibold">Guideless</p>
          <ul className="mt-3 space-y-2">
            <li>
              <a
                href={`mailto:${brand.supportEmail}`}
                className="text-muted-foreground no-underline hover:text-link"
              >
                {brand.supportEmail}
              </a>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-6 text-xs text-muted-foreground">
          <span>
            © {new Date().getFullYear()} {brand.name}. All rights reserved.
          </span>
          <span>Organized, not escorted.</span>
        </div>
      </div>
    </footer>
  );
}
