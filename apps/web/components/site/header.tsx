import Image from "next/image";
import Link from "next/link";
import { brand } from "@guideless/config";
import { SessionNav } from "@/components/auth/session-nav";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Primary navigation (plan v2 §6). Order follows the visitor's questions: what, where, how, why. */
export const primaryNav = [
  { href: "/tours", label: "Trips" },
  { href: "/destinations", label: "Destinations" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/why-guideless", label: "Why Guideless" },
  { href: "/group-travel", label: "Group travel" },
  { href: "/faq", label: "FAQ" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-cloud/85 backdrop-blur supports-[backdrop-filter]:bg-cloud/70">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <Link href="/" className="flex items-center gap-3 text-foreground no-underline">
          <Image
            src="/brand/guideless-logo.webp"
            alt=""
            width={36}
            height={36}
            className="rounded-md"
            priority
          />
          <span className="font-heading text-lg font-bold tracking-tight">{brand.shortName}</span>
          <span className="sr-only">{brand.name} home</span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-6 text-sm lg:flex">
          {primaryNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-foreground no-underline transition-colors hover:text-link"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <SessionNav className="hidden text-sm text-foreground no-underline hover:text-link sm:inline" />
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
              className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border border-border text-foreground [&::-webkit-details-marker]:hidden"
              aria-label="Open menu"
            >
              <span
                aria-hidden
                className="block h-0.5 w-4 bg-current shadow-[0_5px_0_0_currentColor,0_-5px_0_0_currentColor]"
              />
            </summary>
            <nav
              aria-label="Mobile"
              className="absolute right-0 mt-2 flex w-60 flex-col gap-1 rounded-xl border border-border bg-surface p-2 shadow-lg"
            >
              {primaryNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3 py-2 text-foreground no-underline hover:bg-sand/60"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/about"
                className="rounded-lg px-3 py-2 text-foreground no-underline hover:bg-sand/60"
              >
                About
              </Link>
              <Link
                href="/contact"
                className="rounded-lg px-3 py-2 text-foreground no-underline hover:bg-sand/60"
              >
                Contact
              </Link>
              <SessionNav className="rounded-lg px-3 py-2 text-foreground no-underline hover:bg-sand/60 sm:hidden" />
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
