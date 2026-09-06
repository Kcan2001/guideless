import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@guideless/config";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "No access", robots: { index: false, follow: false } };

export default function NoAccessPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-24">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Operations
      </p>
      <h1 className="mt-3 text-3xl font-bold">This area is for Guideless staff.</h1>
      <p className="mt-3 text-muted-foreground">
        Your account is signed in but has no staff role. If you work at Guideless, ask an admin to
        grant one. Otherwise, your bookings are in your account.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/account" className={buttonVariants()}>
          Your account
        </Link>
        <a
          href={`mailto:${brand.supportEmail}`}
          className={buttonVariants({ variant: "secondary" })}
        >
          Contact us
        </a>
      </div>
    </main>
  );
}
