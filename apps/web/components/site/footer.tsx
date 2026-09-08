import type { Route } from "next";
import Link from "next/link";
import { brand, social } from "@guideless/config";
import { NewsletterForm } from "@/components/site/newsletter-form";

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

const COLUMNS: Array<{ label: string; links: Array<{ href: Route; label: string }> }> = [
  {
    label: "Trips",
    links: [
      { href: "/tours", label: "All trips" },
      { href: "/destinations", label: "Destinations" },
      { href: "/meetups", label: "City evenings" },
      { href: "/host", label: "Host a departure" },
    ],
  },
  {
    label: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/why-guideless", label: "Why Guideless" },
      { href: "/how-it-works", label: "How it works" },
      { href: "/group-travel", label: "Traveling with friends" },
      { href: "/faq", label: "FAQ" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    label: "Legal",
    links: [
      { href: "/terms", label: "Terms of Service" },
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/cancellation", label: "Cancellation policy" },
      { href: "/travel-insurance", label: "Travel insurance" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-surface">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-14 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div>
          <p className="font-heading text-lg font-bold">{brand.name}</p>
          <p className="mt-3 max-w-sm text-muted-foreground">{brand.tagline}</p>
          <p className="mt-1 max-w-sm font-heading text-sm font-semibold text-foreground">
            {brand.signature}
          </p>
          <div className="mt-6 max-w-sm">
            <p className="text-sm font-semibold">New departures, first.</p>
            <p className="mb-3 mt-1 text-xs text-muted-foreground">
              One email when a new trip or date opens. No weekly noise. Unsubscribe in one click.
            </p>
            <NewsletterForm source="footer" />
          </div>
          <ul className="mt-6 space-y-2 text-sm">
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
          </ul>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.label} aria-label={`Footer — ${col.label}`} className="text-sm">
            <p className="font-semibold">{col.label}</p>
            <ul className="mt-3 space-y-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-muted-foreground no-underline hover:text-link"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-6 text-xs text-muted-foreground">
          <span>
            © {new Date().getFullYear()} {brand.legalName}. All rights reserved.
          </span>
          <span>{brand.category}. Organized, not escorted.</span>
        </div>
      </div>
    </footer>
  );
}
