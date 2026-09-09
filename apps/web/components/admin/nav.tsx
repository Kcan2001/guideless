import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  BedDouble,
  Boxes,
  CalendarRange,
  Coins,
  HandHeart,
  LayoutDashboard,
  LifeBuoy,
  Map,
  Megaphone,
  Newspaper,
  ReceiptText,
  Scale,
  Sparkles,
  ShieldCheck,
  SquarePen,
  Tags,
  TrendingUp,
  PackageCheck,
  Ticket,
  Truck,
  UserPlus,
  Users,
  Wine,
  type LucideIcon,
} from "lucide-react";
import { brand } from "@guideless/config";
import type { Role } from "@guideless/types";
import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

const NAV: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/tours", label: "Tours", icon: Map },
  { href: "/admin/departures", label: "Departures", icon: CalendarRange },
  { href: "/admin/bookings", label: "Bookings", icon: ReceiptText },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/inventory", label: "Inventory", icon: Boxes },
  { href: "/admin/hotels", label: "Hotels", icon: BedDouble },
  { href: "/admin/suppliers", label: "Suppliers", icon: Truck },
  { href: "/admin/experiences", label: "Experiences", icon: Ticket },
  { href: "/admin/fulfilment", label: "To book", icon: PackageCheck },
  { href: "/admin/pricing", label: "Pricing", icon: Coins },
  { href: "/admin/coupons", label: "Coupons", icon: Tags },
  { href: "/admin/finance", label: "Reconciliation", icon: Scale },
  { href: "/admin/funnel", label: "Funnel", icon: TrendingUp },
  { href: "/admin/waitlists", label: "Waitlists", icon: UserPlus },
  { href: "/admin/content", label: "Content", icon: Newspaper },
  { href: "/admin/moderation", label: "Moderation", icon: ShieldCheck },
  { href: "/admin/surveys", label: "Surveys", icon: SquarePen },
  { href: "/admin/assistant", label: "Assistant", icon: Sparkles },
  { href: "/admin/hosts", label: "Hosts", icon: HandHeart },
  { href: "/admin/meetups", label: "Meetups", icon: Wine },
  { href: "/admin/support", label: "Support", icon: LifeBuoy },
  { href: "/admin/social", label: "Social", icon: Megaphone },
];

export function AdminNav({ email, roles }: { email: string | null; roles: Role[] }) {
  return (
    <aside className="flex w-full flex-col border-b border-border bg-ink text-cloud lg:min-h-screen lg:w-60 lg:border-b-0 lg:border-r">
      <div className="flex items-center gap-3 px-5 py-5">
        <Image
          src="/brand/guideless-logo.webp"
          alt=""
          width={32}
          height={32}
          className="rounded-md"
        />
        <div>
          <p className="font-heading text-sm font-bold leading-tight">{brand.shortName}</p>
          <p className="text-[11px] uppercase tracking-[0.18em] text-aqua">Operations</p>
        </div>
      </div>
      <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:pb-0">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href as Route}
            className="flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-sm text-cloud/85 no-underline hover:bg-cloud/10 hover:text-cloud"
          >
            <Icon className="h-4 w-4 text-aqua" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto hidden px-5 py-5 text-xs text-cloud/60 lg:block">
        <p className="truncate text-cloud/85">{email}</p>
        <p className="mt-1">{roles.join(", ")}</p>
        <div className="mt-3 flex gap-2">
          <Link href="/" className="text-cloud/70 no-underline hover:text-cloud">
            View site
          </Link>
          <form action={signOut}>
            <Button
              type="submit"
              variant="link"
              size="sm"
              className="h-auto p-0 text-cloud/70 hover:text-cloud"
            >
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </aside>
  );
}
