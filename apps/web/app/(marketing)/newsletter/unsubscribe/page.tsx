import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@guideless/config";
import { unsubscribeNewsletter } from "@/lib/marketing/newsletter";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

/**
 * One-click unsubscribe target for the link in every newsletter (also used as the
 * List-Unsubscribe URL). The token is opaque; a wrong or reused token just shows the neutral copy.
 */
export default async function UnsubscribePage(props: PageProps<"/newsletter/unsubscribe">) {
  const sp = await props.searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  const done = token ? await unsubscribeNewsletter(token) : false;

  return (
    <section className="mx-auto w-full max-w-xl px-6 py-24 text-center">
      <h1 className="font-heading text-3xl ">
        {done ? "You're unsubscribed." : "This link has already been used."}
      </h1>
      <p className="mt-4 text-muted-foreground">
        {done
          ? `You won't hear about new departures from ${brand.name} by email anymore. Booking and trip emails are unaffected.`
          : "If you still receive our newsletter, write to us and we'll take care of it by hand."}
      </p>
      <div className="mt-8 flex justify-center gap-4 text-sm">
        <Link href="/" className="text-link">
          Back to {brand.shortName}
        </Link>
        <a href={`mailto:${brand.supportEmail}`} className="text-link">
          {brand.supportEmail}
        </a>
      </div>
    </section>
  );
}
