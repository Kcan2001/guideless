import Image from "next/image";
import Link from "next/link";
import { Lock } from "lucide-react";
import { brand } from "@guideless/config";

/** Focused checkout chrome: logo, a lock, no navigation to wander off into. */
export default function CheckoutLayout({ children }: LayoutProps<"/checkout">) {
  return (
    <>
      <header className="border-b border-border bg-cloud">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3 text-foreground no-underline">
            <Image
              src="/brand/guideless-logo.webp"
              alt=""
              width={32}
              height={32}
              className="rounded-md"
            />
            <span className="font-heading font-bold">{brand.shortName}</span>
          </Link>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" aria-hidden /> Secure checkout · payments by Stripe
          </p>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap justify-between gap-2 px-6 py-6 text-xs text-muted-foreground">
          <span>
            © {new Date().getFullYear()} {brand.name}
          </span>
          <a href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a>
        </div>
      </footer>
    </>
  );
}
