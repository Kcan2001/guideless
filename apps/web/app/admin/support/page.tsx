import type { Route } from "next";
import Link from "next/link";
import { Flash } from "@/components/admin/flash";
import { PageHeader, Section, Table, inputClass } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { listSupportThreads, type SupportFilter } from "@/lib/admin/queries";
import { SUPPORT_ROLES, requireStaff } from "@/lib/auth/staff";
import { cn } from "@/lib/utils";

export const revalidate = 30;

const FILTERS: Array<{ value: SupportFilter; label: string }> = [
  { value: "needs_reply", label: "Needs a reply" },
  { value: "open", label: "All open" },
  { value: "resolved", label: "Resolved" },
  { value: "all", label: "Everything" },
];

const PRIORITY_VARIANT = {
  low: "neutral",
  normal: "optional",
  high: "warning",
  urgent: "danger",
} as const;

const STATUS_LABEL: Record<string, string> = {
  open: "New",
  waiting_on_staff: "Waiting on us",
  waiting_on_customer: "Waiting on traveler",
  resolved: "Resolved",
  closed: "Closed",
};

function ago(iso: string | null): string {
  if (!iso) return "—";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.round(hours / 24)} d`;
}

export default async function SupportInboxPage(props: PageProps<"/admin/support">) {
  const [sp, ctx] = await Promise.all([props.searchParams, requireStaff(SUPPORT_ROLES)]);
  const filter = (
    FILTERS.some((f) => f.value === sp.filter) ? sp.filter : "needs_reply"
  ) as SupportFilter;
  const priority = typeof sp.priority === "string" && sp.priority ? sp.priority : null;
  const mine = sp.mine === "1";
  const threads = await listSupportThreads({
    filter,
    priority,
    assignedTo: mine ? ctx.user.id : null,
  });

  return (
    <>
      <PageHeader
        title="Support"
        description="Travelers write from the app. Reply here; they get a push and see it in the app."
      />
      <Flash searchParams={sp} />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3 text-sm">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter">
          {FILTERS.map((f) => (
            <Link
              key={f.value}
              href={
                `/admin/support?filter=${f.value}${priority ? `&priority=${priority}` : ""}${mine ? "&mine=1" : ""}` as Route
              }
              className={cn(
                buttonVariants({
                  variant: f.value === filter ? "primary" : "secondary",
                  size: "sm",
                }),
              )}
              aria-current={f.value === filter ? "page" : undefined}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <input type="hidden" name="filter" value={filter} />
        <label className="text-sm">
          <span className="sr-only">Priority</span>
          <select name="priority" defaultValue={priority ?? ""} className={inputClass}>
            <option value="">Any priority</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="mine"
            value="1"
            defaultChecked={mine}
            className="accent-ink"
          />
          Assigned to me
        </label>
        <button type="submit" className={buttonVariants({ variant: "secondary", size: "sm" })}>
          Apply
        </button>
      </form>

      <Section
        title={`${threads.length} ${threads.length === 1 ? "thread" : "threads"}`}
        description="Sorted by the latest message. Age is time since the traveler last wrote."
      >
        <Table
          head={["Traveler", "Subject", "Trip", "Status", "Priority", "Waiting", "Owner"]}
          empty="Nothing needs a reply right now."
          rows={threads.map((t) => [
            <Link key="c" href={`/admin/support/${t.id}` as Route} className="font-medium">
              {t.customer?.display_name || "Traveler"}
            </Link>,
            <div key="s" className="max-w-md">
              <p>{t.subject}</p>
              {t.lastMessage && (
                <p className="truncate text-xs text-muted-foreground">
                  {t.lastMessage.is_from_staff ? "You: " : ""}
                  {t.lastMessage.body}
                </p>
              )}
            </div>,
            t.tripName ?? <span className="text-muted-foreground">—</span>,
            <span key="st">
              {STATUS_LABEL[t.status] ?? t.status}
              {!t.first_response_at && t.status !== "resolved" && t.status !== "closed" && (
                <span className="ml-2 text-xs text-warning">no reply yet</span>
              )}
            </span>,
            <Badge
              key="p"
              variant={PRIORITY_VARIANT[t.priority as keyof typeof PRIORITY_VARIANT] ?? "neutral"}
            >
              {t.priority}
            </Badge>,
            t.status === "waiting_on_customer" || t.status === "resolved" || t.status === "closed"
              ? "—"
              : ago(t.lastCustomerAt ?? t.created_at),
            t.assignee?.display_name ?? <span className="text-muted-foreground">Unassigned</span>,
          ])}
        />
      </Section>
    </>
  );
}
