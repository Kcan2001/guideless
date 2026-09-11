import type { Metadata, Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { brand } from "@guideless/config";
import { LoginForm } from "@/components/auth/login-form";
import { enabledAuthProviders } from "@/lib/auth/providers";
import { FormError } from "@/components/ui/field";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

const ERRORS: Record<string, string> = {
  link: "That sign-in link has expired or was already used. Request a new one below.",
  oauth: "Google sign-in isn't available right now. Use an email link instead.",
};

export default async function LoginPage(props: PageProps<"/login">) {
  const providers = await enabledAuthProviders();
  const sp = await props.searchParams;
  const rawNext = typeof sp.next === "string" ? sp.next : "/account";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/account";
  const errorKey = typeof sp.error === "string" ? sp.error : undefined;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(next as Route);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-16">
      <Link
        href="/"
        className="mb-10 flex items-center gap-3 self-start text-foreground no-underline"
      >
        <Image src="/brand/guideless-logo.webp" alt="" width={36} height={36} className="rounded" />
        <span className="font-heading text-lg font-bold">{brand.shortName}</span>
      </Link>
      <h1 className="text-3xl ">Sign in</h1>
      <p className="mt-2 text-muted-foreground">
        Your bookings, your trips, your group — in one place.
      </p>
      <div className="mt-8 space-y-4">
        {errorKey && (
          <FormError message={ERRORS[errorKey] ?? "Something went wrong. Please try again."} />
        )}
        <LoginForm next={next} googleEnabled={providers.google} />
      </div>
    </main>
  );
}
