import Link from "next/link";
import { formatDate } from "@guideless/utils";
import { PageHeader, Section, Stat, Table } from "@/components/admin/ui";
import { getAssistantSpend } from "@/lib/admin/assistant";
import { assistantIsConfigured } from "@/lib/assistant/chat";
import { FINANCE_ROLES, requireStaff } from "@/lib/auth/staff";

export const metadata = { title: "Assistant" };

/**
 * What the trip assistant costs. Finance roles, because this screen is about money.
 *
 * There is nothing here but counts and money, and there is no link from it to a conversation,
 * because no staff role can read one. If somebody asks to see what travelers are asking, the
 * answer is the surveys screen or a support thread — not this.
 */
export default async function AdminAssistantPage() {
  await requireStaff(FINANCE_ROLES);
  const spend = await getAssistantSpend();
  const configured = assistantIsConfigured();

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Assistant"
        description="What the trip assistant costs, per booking. Conversations are private to the traveler and are not readable here."
      />

      {!configured && (
        <p className="rounded-xl border border-warning-border bg-warning-surface p-4 text-sm">
          <strong>Not switched on.</strong> `ANTHROPIC_API_KEY` is missing in this environment, so
          the assistant is off and no traveler can reach it. Everything below is history.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Spend, all time" value={spend.total} hint={`${spend.messages} messages`} />
        <Stat label="Last 30 days" value={spend.last30} />
        <Stat
          label="Cost per message"
          value={
            spend.messages > 0
              ? `$${(spend.totalMicros / spend.messages / 1_000_000).toFixed(3)}`
              : "—"
          }
          hint="all time"
        />
        <Stat
          label="Hit the cap today"
          value={spend.atLimitToday}
          tone={spend.atLimitToday > 0 ? "warning" : "neutral"}
          hint={spend.atLimitToday > 0 ? "someone is looping, or the cap is too low" : "nobody"}
        />
      </div>

      <Section
        title="By booking"
        description="Highest spend first. A booking here is one traveler's conversation about one trip."
      >
        <Table
          head={["Booking", "Tour", "Travelers", "Messages", "Cost", "Last used"]}
          rows={spend.rows.map((r) => [
            <Link key="b" href={`/admin/bookings/${r.bookingId}`} className="text-link">
              {r.confirmationNumber}
            </Link>,
            r.tourName,
            r.travelers,
            r.messages,
            r.cost,
            formatDate(r.lastUsed),
          ])}
          empty="Nobody has used the assistant yet."
        />
      </Section>
    </div>
  );
}
