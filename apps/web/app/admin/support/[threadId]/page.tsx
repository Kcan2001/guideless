import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatInZone } from "@guideless/utils";
import { Flash } from "@/components/admin/flash";
import { SubmitButton } from "@/components/admin/submit-button";
import { DL, PageHeader, Section, inputClass, labelClass } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import {
  addInternalNoteAction,
  assignThreadAction,
  replyToThreadAction,
  setThreadPriorityAction,
  setThreadStatusAction,
} from "@/lib/admin/actions/support";
import { getSupportThreadAdmin } from "@/lib/admin/queries";
import { SUPPORT_ROLES, requireStaff } from "@/lib/auth/staff";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  open: "New",
  waiting_on_staff: "Waiting on us",
  waiting_on_customer: "Waiting on traveler",
  resolved: "Resolved",
  closed: "Closed",
};

export default async function SupportThreadPage(props: PageProps<"/admin/support/[threadId]">) {
  const [{ threadId }, sp, ctx] = await Promise.all([
    props.params,
    props.searchParams,
    requireStaff(SUPPORT_ROLES),
  ]);
  const data = await getSupportThreadAdmin(threadId);
  if (!data) notFound();
  const { thread, customer, assignee, trip, booking, context, contextItem, messages } = data;
  const tz = trip?.timezone ?? "UTC";
  const isOpen = thread.status !== "resolved" && thread.status !== "closed";

  return (
    <>
      <PageHeader
        title={thread.subject}
        crumbs={
          <>
            <Link href="/admin/support">Support</Link> / {customer?.display_name || "Traveler"}
          </>
        }
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant={isOpen ? "warning" : "neutral"}>{STATUS_LABEL[thread.status]}</Badge>
            <Badge
              variant={
                thread.priority === "urgent" || thread.priority === "high" ? "danger" : "optional"
              }
            >
              {thread.priority}
            </Badge>
            <span className="text-muted-foreground">{thread.category.replace(/_/g, " ")}</span>
          </span>
        }
      />
      <Flash searchParams={sp} />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Section
            title="Conversation"
            description="Internal notes are amber and never reach the traveler."
          >
            <ol className="space-y-3">
              {messages.map((m) => (
                <li
                  key={m.id}
                  className={cn(
                    "rounded-xl border p-4 text-sm",
                    m.is_internal_note
                      ? "border-warning/40 bg-warning/10"
                      : m.is_from_staff
                        ? "ml-6 border-aqua/60 bg-aqua/10"
                        : "mr-6 border-border bg-surface",
                  )}
                >
                  <p className="mb-1 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      {m.is_internal_note
                        ? `Internal note · ${m.sender?.display_name || "Staff"}`
                        : m.is_from_staff
                          ? `Guideless · ${m.sender?.display_name || "Staff"}`
                          : customer?.display_name || "Traveler"}
                    </span>
                    <time dateTime={m.created_at}>{formatInZone(m.created_at, tz)}</time>
                  </p>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  {m.attachments.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {m.attachments.map((a) => (
                        <li key={a.id}>
                          {a.url ? (
                            <a
                              href={a.url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-md border border-border bg-cloud px-2 py-1 text-xs no-underline hover:underline"
                            >
                              Attachment ({a.mime_type}, {Math.round(a.size_bytes / 1024)} KB)
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Attachment unavailable
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
              {messages.length === 0 && (
                <li className="text-sm text-muted-foreground">No messages yet.</li>
              )}
            </ol>

            <form id="reply" action={replyToThreadAction} className="mt-6 space-y-2">
              <input type="hidden" name="threadId" value={thread.id} />
              <label className="block text-sm">
                <span className={labelClass}>
                  Reply to {customer?.display_name || "the traveler"}
                </span>
                <textarea
                  name="body"
                  rows={4}
                  required
                  maxLength={8000}
                  className={inputClass}
                  placeholder="Plain and specific. Say what you did, what happens next, and by when."
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <SubmitButton size="sm" pendingText="Sending…">
                  Send reply
                </SubmitButton>
              </div>
            </form>

            <form id="note" action={addInternalNoteAction} className="mt-4 space-y-2">
              <input type="hidden" name="threadId" value={thread.id} />
              <label className="block text-sm">
                <span className={labelClass}>Internal note (staff only)</span>
                <textarea name="body" rows={2} required maxLength={8000} className={inputClass} />
              </label>
              <SubmitButton size="sm" variant="secondary" pendingText="Saving…">
                Add note
              </SubmitButton>
            </form>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Thread">
            <DL
              rows={[
                ["Traveler", customer?.display_name || "Traveler"],
                [
                  "Trip",
                  trip ? (
                    <Link href={`/admin/departures/${trip.departure_id}/trips/${trip.id}` as Route}>
                      {trip.name}
                    </Link>
                  ) : (
                    "—"
                  ),
                ],
                [
                  "Booking",
                  booking ? (
                    <Link href={`/admin/bookings/${booking.id}` as Route}>
                      {booking.confirmation_number}
                    </Link>
                  ) : (
                    "—"
                  ),
                ],
                ["Opened", formatInZone(thread.created_at, tz)],
                [
                  "First reply",
                  thread.first_response_at ? formatInZone(thread.first_response_at, tz) : "Not yet",
                ],
                ["Owner", assignee?.display_name ?? "Unassigned"],
              ]}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <form action={assignThreadAction}>
                <input type="hidden" name="threadId" value={thread.id} />
                {thread.assigned_to === ctx.user.id ? (
                  <>
                    <input type="hidden" name="clear" value="1" />
                    <SubmitButton size="sm" variant="secondary">
                      Unassign me
                    </SubmitButton>
                  </>
                ) : (
                  <SubmitButton size="sm" variant="secondary">
                    Assign to me
                  </SubmitButton>
                )}
              </form>
              <form action={setThreadStatusAction}>
                <input type="hidden" name="threadId" value={thread.id} />
                {isOpen ? (
                  <>
                    <input type="hidden" name="status" value="resolved" />
                    <SubmitButton
                      size="sm"
                      confirm="Mark this thread resolved? The traveler can still write back."
                    >
                      Mark resolved
                    </SubmitButton>
                  </>
                ) : (
                  <>
                    <input type="hidden" name="status" value="waiting_on_staff" />
                    <SubmitButton size="sm" variant="secondary">
                      Reopen
                    </SubmitButton>
                  </>
                )}
              </form>
            </div>
            <form action={setThreadPriorityAction} className="mt-4 flex items-end gap-2">
              <input type="hidden" name="threadId" value={thread.id} />
              <label className="text-sm">
                <span className={labelClass}>Priority</span>
                <select name="priority" defaultValue={thread.priority} className={inputClass}>
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>
              <SubmitButton size="sm" variant="secondary">
                Set
              </SubmitButton>
            </form>
          </Section>

          <Section
            title="Where they were"
            description="Captured by the app when the thread was opened."
          >
            <DL
              rows={[
                [
                  "Itinerary item",
                  contextItem
                    ? `${contextItem.title}${contextItem.location_name ? ` · ${contextItem.location_name}` : ""}`
                    : "—",
                ],
                [
                  "Location",
                  context.latitude != null && context.longitude != null ? (
                    <a
                      href={`https://maps.google.com/?q=${context.latitude},${context.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open in Maps
                    </a>
                  ) : (
                    "Not shared"
                  ),
                ],
                ["App version", context.appVersion ?? "—"],
              ]}
            />
          </Section>
        </div>
      </div>
    </>
  );
}
