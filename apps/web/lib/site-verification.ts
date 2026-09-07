import type { Metadata } from "next";

/**
 * Search Console (and later Bing) site-verification tokens for the root layout's `metadata`.
 * Empty when the env vars are unset, so local builds emit nothing.
 *
 * Wire-up (one line in apps/web/app/layout.tsx `metadata`): `verification: siteVerification(),`
 */
export function siteVerification(): NonNullable<Metadata["verification"]> {
  const google = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();
  const bing = process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION?.trim();
  return {
    ...(google ? { google } : {}),
    ...(bing ? { other: { "msvalidate.01": bing } } : {}),
  };
}
