"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { LinkPending, PENDING_CLASS } from "@/components/ui/pending-link";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

type LinkProps = ComponentProps<typeof Link>;

/**
 * A <Link> that records which call to action was used (`cta_click` with its placement) and shows
 * that it is working while the next page loads.
 *
 * The spinner matters most here: these are the buttons into the Trip Builder and the departure
 * pages, which are rendered per request, and a link that looks inert gets pressed again.
 */
export function CtaLink({
  placement,
  onClick,
  className,
  children,
  pendingLabel,
  ...props
}: LinkProps & { placement: string; pendingLabel?: string }) {
  return (
    <Link
      {...props}
      className={cn(PENDING_CLASS, className)}
      onClick={(e) => {
        const href = props.href;
        const target =
          typeof href === "string"
            ? href
            : `${href.pathname ?? ""}${href.hash ? `#${href.hash}` : ""}`;
        track("cta_click", { placement, target });
        onClick?.(e);
      }}
    >
      <LinkPending pendingLabel={pendingLabel} spinnerFirst={false}>
        {children}
      </LinkPending>
    </Link>
  );
}
