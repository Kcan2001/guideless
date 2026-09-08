import { CouponForm } from "@/components/admin/coupon-form";
import { Flash } from "@/components/admin/flash";
import { SubmitButton } from "@/components/admin/submit-button";
import { PageHeader, Section, StatusBadge, Table, money } from "@/components/admin/ui";
import { deleteCouponAction, setCouponActiveAction } from "@/lib/admin/actions/coupons";
import { listCoupons, type CouponWithUsage } from "@/lib/admin/finance";
import { FINANCE_ROLES, requireStaff } from "@/lib/auth/staff";

export const metadata = { title: "Coupons" };

const date = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;

/** "20% off" or "$100 off", from whichever of the two the coupon carries. */
function discount(c: CouponWithUsage): string {
  if (c.percent_off !== null) return `${c.percent_off}% off`;
  if (c.amount_off !== null && c.currency) return `${money(c.amount_off, c.currency)} off`;
  return "—";
}

/** Why a coupon would be refused today, so staff can see it without doing the arithmetic. */
function state(c: CouponWithUsage): { label: string; live: boolean } {
  const now = new Date();
  if (!c.is_active) return { label: "inactive", live: false };
  if (c.valid_from && new Date(c.valid_from) > now) return { label: "not started", live: false };
  if (c.valid_until && new Date(c.valid_until) < now) return { label: "expired", live: false };
  if (c.max_redemptions !== null && c.redemptions >= c.max_redemptions)
    return { label: "used up", live: false };
  return { label: "active", live: true };
}

export default async function AdminCouponsPage(props: PageProps<"/admin/coupons">) {
  const [sp] = await Promise.all([props.searchParams, requireStaff(FINANCE_ROLES)]);
  const coupons = await listCoupons();
  const live = coupons.filter((c) => state(c).live).length;

  return (
    <>
      <PageHeader
        title="Coupons"
        description="Discount codes travelers enter at checkout. They come off the trip price only, never off add-ons."
      />
      <Flash searchParams={sp} />

      <div className="grid gap-6">
        <Section
          title={`${coupons.length} coupon${coupons.length === 1 ? "" : "s"}`}
          description={`${live} would be accepted right now. Editing a coupon never changes a booking that already used it — bookings keep the discount they were sold.`}
        >
          <Table
            head={["Code", "Discount", "Valid", "Used", "State", ""]}
            empty="No coupons yet. Create one below."
            rows={coupons.map((c) => {
              const s = state(c);
              const from = date(c.valid_from);
              const until = date(c.valid_until);
              return [
                <span key="code">
                  <span className="font-medium">{c.code}</span>
                  {c.description && (
                    <span className="block text-xs text-muted-foreground">{c.description}</span>
                  )}
                </span>,
                discount(c),
                <span key="valid" className="text-sm">
                  {from || until ? `${from ?? "any time"} → ${until ?? "no end"}` : "Always"}
                </span>,
                <span key="used" className="tabular-nums">
                  {c.redemptions}
                  {c.max_redemptions !== null && ` / ${c.max_redemptions}`}
                  {c.bookings_used !== c.redemptions && (
                    <span className="block text-xs text-muted-foreground">
                      {c.bookings_used} booking{c.bookings_used === 1 ? "" : "s"}
                    </span>
                  )}
                </span>,
                <StatusBadge key="state" kind="generic" status={s.label} />,
                <div key="act" className="flex flex-wrap gap-2">
                  <form action={setCouponActiveAction}>
                    <input type="hidden" name="couponId" value={c.id} />
                    <input type="hidden" name="isActive" value={String(!c.is_active)} />
                    <SubmitButton size="sm" variant="ghost">
                      {c.is_active ? "Deactivate" : "Reactivate"}
                    </SubmitButton>
                  </form>
                  {c.deletable && (
                    <form action={deleteCouponAction}>
                      <input type="hidden" name="couponId" value={c.id} />
                      <SubmitButton size="sm" variant="ghost" confirm={`Delete ${c.code}?`}>
                        Delete
                      </SubmitButton>
                    </form>
                  )}
                </div>,
              ];
            })}
          />
        </Section>

        {coupons.map((c) => (
          <Section key={c.id} title={`Edit ${c.code}`}>
            <CouponForm coupon={c} />
          </Section>
        ))}

        <Section
          title="New coupon"
          description="Percentage or fixed amount, not both. A fixed amount needs a currency and only applies to bookings in it."
        >
          <CouponForm />
        </Section>
      </div>
    </>
  );
}
