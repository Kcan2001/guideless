import Link from "next/link";
import { brand, social } from "@guideless/config";

/** Instagram glyph (lucide dropped brand icons in v1). */
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

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
            <li>
              <a
                href={`${social.instagram.url}?utm_source=website&utm_medium=footer`}
                rel="noopener noreferrer me"
                target="_blank"
                className="inline-flex items-center gap-2 text-muted-foreground no-underline hover:text-link"
              >
                <InstagramIcon className="h-4 w-4" />@{social.instagram.handle}
                <span className="sr-only">(opens Instagram in a new tab)</span>
              </a>
            </li>
            <li>
              <Link href="/terms" className="text-muted-foreground no-underline hover:text-link">
                Terms of Service
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="text-muted-foreground no-underline hover:text-link">
                Privacy Policy
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-6 text-xs text-muted-foreground">
          <span>
            © {new Date().getFullYear()} {brand.legalName}. All rights reserved.
          </span>
          <span>Organized, not escorted.</span>
        </div>
      </div>
    </footer>
  );
}
