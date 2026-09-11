import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@guideless/config";
import { createPublicClient } from "@/lib/supabase/public";

export const metadata: Metadata = {
  title: "Unsubscribed",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One click, no sign-in, no "are you sure".
 *
 * Most people on these lists have no Guideless account — that is the whole point of collecting an
 * email rather than requiring one — so the account page was never a real way out. Acting on GET is
 * deliberate here even though it is a write: mail clients do not post forms, and a link that needs
 * a second click is a link that leaves people subscribed.
 *
 * An unknown or already-used token says exactly what a good one says. The page must not become a
 * way to check whether an address is on a list.
 */
export default async function UnsubscribePage(props: PageProps<"/unsubscribe">) {
  const sp = await props.searchParams;
  const kind = typeof sp.kind === "string" ? sp.kind : "";
  const token = typeof sp.token === "string" ? sp.token : "";

  if (UUID.test(token)) {
    const sb = createPublicClient();
    if (kind === "destination_alert") {
      await sb.rpc("stop_destination_alert", { p_token: token });
    } else if (kind === "waitlist") {
      await sb.rpc("stop_departure_waitlist", { p_token: token });
    } else if (kind === "newsletter") {
      await sb.rpc("unsubscribe_newsletter", { p_token: token });
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl px-6 py-24">
      <p className="eyebrow text-muted-foreground">{brand.shortName}</p>
      <h1 className="mt-3 font-heading text-4xl ">That&rsquo;s done.</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        You won&rsquo;t get any more of those. Nothing else changes, and if you have a trip booked
        we&rsquo;ll still send you the things you need for it.
      </p>
      <p className="mt-8">
        <Link href="/" className="text-link no-underline">
          Back to {brand.shortName} &rarr;
        </Link>
      </p>
    </div>
  );
}
