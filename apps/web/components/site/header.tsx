"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { brand } from "@guideless/config";
import { SessionNav } from "@/components/auth/session-nav";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The header holds three things: who we are, the one page that explains the product, and the way
 * in. Everything else is in the footer.
 *
 * It used to carry six links plus a button, three of which ("How it works", "Why Guideless",
 * "Group travel") were the same argument written three times — so the nav asked you to choose
 * between three doors into one room. They are one page now.
 */
export const headerNav = [{ href: "/how-it-works", label: "How it works" }] as const;

/** The full set, for the footer and the mobile drawer, where a longer list costs nothing. */
export const primaryNav = [
  { href: "/tours", label: "Trips" },
  { href: "/destinations", label: "Destinations" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/faq", label: "FAQ" },
] as const;

/**
 * The header sits *on* a dark hero rather than above it, and only becomes a bar once you scroll
 * past one.
 *
 * A solid bar at the top of the page puts a horizontal rule across the first thing anyone sees and
 * boxes the photograph in; the hero is supposed to be the first impression, not a panel underneath
 * the chrome. So on a page whose hero is dark the header starts transparent with cloud text, and
 * swaps to the cloud bar with ink text the moment the hero has scrolled under it.
 *
 * Pages opt in by marking their hero `data-hero-dark`. Anything without one — the account pages,
 * the admin, a 404 — keeps the solid bar from the first pixel, because transparent chrome over a
 * light page is invisible chrome.
 */
export function SiteHeader() {
  const pathname = usePathname();
  // Only ever answers "have we scrolled past the hero?". Whether this page *has* a dark hero is
  // decided in CSS, so the first paint is already correct — see globals.css.
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const hero = document.querySelector("[data-hero-dark]");
    if (!hero) return;
    // True while any part of the hero is still below the header band, which is exactly the window
    // in which the header is drawn on top of the photograph.
    const io = new IntersectionObserver(([entry]) => setScrolled(!entry?.isIntersecting), {
      rootMargin: "-72px 0px 0px 0px",
      threshold: 0,
    });
    io.observe(hero);
    // Resetting on the way out rather than on the way in: navigating from a hero page to one
    // without a hero must drop back to the solid bar, and there is nothing on the new page to
    // observe that would tell us to.
    return () => {
      io.disconnect();
      setScrolled(false);
    };
  }, [pathname]);

  return (
    <header
      data-scrolled={scrolled ? "" : undefined}
      className="site-header sticky top-0 z-40 border-b border-border/70 bg-cloud/95 text-foreground backdrop-blur transition-colors duration-200 supports-[backdrop-filter]:bg-cloud/85"
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6 py-4">
        {/* The visible word is the whole accessible name. The sr-only span used to append to it,
            so a screen reader announced "Guideless Guideless Travel home". */}
        <Link
          href="/"
          className="font-heading text-lg font-black uppercase tracking-[0.02em] no-underline"
        >
          {brand.shortName}
        </Link>

        <nav
          aria-label="Primary"
          className="hidden items-center gap-6 font-heading text-xs font-bold uppercase tracking-[0.12em] lg:flex"
        >
          {headerNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="no-underline transition-colors hover:text-link"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <SessionNav className="hidden font-heading text-xs font-bold uppercase tracking-[0.12em] no-underline hover:text-link sm:inline" />
          <Link
            href="/tours"
            className={cn(buttonVariants({ size: "sm" }), "hidden sm:inline-flex")}
          >
            Explore trips
          </Link>
          <details className="relative lg:hidden">
            <summary
              role="button"
              aria-haspopup="menu"
              className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded border border-current/40 [&::-webkit-details-marker]:hidden"
              aria-label="Open menu"
            >
              <span
                aria-hidden
                className="block h-0.5 w-4 bg-current shadow-[0_5px_0_0_currentColor,0_-5px_0_0_currentColor]"
              />
            </summary>
            <nav
              aria-label="Mobile"
              className="absolute right-0 mt-2 flex w-60 flex-col gap-1 rounded border border-border bg-surface p-2 text-foreground shadow-lg"
            >
              {primaryNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="eyebrow rounded px-3 py-2 no-underline hover:bg-sand/60"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/about"
                className="eyebrow rounded px-3 py-2 no-underline hover:bg-sand/60"
              >
                About
              </Link>
              <Link
                href="/contact"
                className="eyebrow rounded px-3 py-2 no-underline hover:bg-sand/60"
              >
                Contact
              </Link>
              <SessionNav className="eyebrow rounded px-3 py-2 no-underline hover:bg-sand/60 sm:hidden" />
              <Link
                href="/tours"
                className={cn(buttonVariants({ size: "sm" }), "mt-1 justify-center")}
              >
                Explore trips
              </Link>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
