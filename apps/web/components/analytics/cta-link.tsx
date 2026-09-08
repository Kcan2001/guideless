"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { track } from "@/lib/analytics";

type LinkProps = ComponentProps<typeof Link>;

/**
 * A <Link> that records which call to action was used (`cta_click` with its placement).
 * Marketing pages render it from Server Components; it carries no other state.
 */
export function CtaLink({ placement, onClick, ...props }: LinkProps & { placement: string }) {
  return (
    <Link
      {...props}
      onClick={(e) => {
        const href = props.href;
        const target =
          typeof href === "string"
            ? href
            : `${href.pathname ?? ""}${href.hash ? `#${href.hash}` : ""}`;
        track("cta_click", { placement, target });
        onClick?.(e);
      }}
    />
  );
}
