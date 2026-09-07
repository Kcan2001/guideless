"use server";

import { revalidatePath } from "next/cache";
import {
  supportPrioritySchema,
  supportReplySchema,
  supportStatusSchema,
  uuidSchema,
} from "@guideless/validation";
import { SUPPORT_ROLES, requireStaff } from "@/lib/auth/staff";
import { dbErrorMessage, flash, parseForm } from "@/lib/admin/form";
import { createClient } from "@/lib/supabase/server";

function threadIdFrom(fd: FormData): string {
  const parsed = uuidSchema.safeParse(fd.get("threadId"));
  if (!parsed.success) throw new Error("Missing or invalid threadId");
  return parsed.data;
}

const back = (threadId: string, hash = "") => `/admin/support/${threadId}${hash}`;

/**
 * Staff reply. The insert trigger sets first_response_at, moves the thread to waiting_on_customer
 * and notifies the customer (support_messages_notify), so nothing else needs to happen here.
 */
export async function replyToThreadAction(fd: FormData): Promise<void> {
  const ctx = await requireStaff(SUPPORT_ROLES);
  const threadId = threadIdFrom(fd);
  const to = back(threadId, "#reply");
  const parsed = parseForm(supportReplySchema, fd);
  if (!parsed.ok) flash(to, "error", parsed.error);
  const sb = await createClient();
  const { error } = await sb.from("support_messages").insert({
    thread_id: threadId,
    sender_id: ctx.user.id,
    is_from_staff: true,
    is_internal_note: false,
    body: parsed.data.body,
  });
  if (error) flash(to, "error", dbErrorMessage(error));
  revalidatePath("/admin/support");
  revalidatePath(to);
  flash(to, "ok", "Reply sent. The traveler has been notified.");
}

/** Internal notes are never shown to the customer (RLS filters is_internal_note). */
export async function addInternalNoteAction(fd: FormData): Promise<void> {
  const ctx = await requireStaff(SUPPORT_ROLES);
  const threadId = threadIdFrom(fd);
  const to = back(threadId, "#note");
  const parsed = parseForm(supportReplySchema, fd);
  if (!parsed.ok) flash(to, "error", parsed.error);
  const sb = await createClient();
  const { error } = await sb.from("support_messages").insert({
    thread_id: threadId,
    sender_id: ctx.user.id,
    is_from_staff: true,
    is_internal_note: true,
    body: parsed.data.body,
  });
  if (error) flash(to, "error", dbErrorMessage(error));
  revalidatePath(to);
  flash(to, "ok", "Note added.");
}

export async function setThreadPriorityAction(fd: FormData): Promise<void> {
  await requireStaff(SUPPORT_ROLES);
  const threadId = threadIdFrom(fd);
  const to = back(threadId);
  const parsed = parseForm(supportPrioritySchema, fd);
  if (!parsed.ok) flash(to, "error", parsed.error);
  const sb = await createClient();
  const { error } = await sb
    .from("support_threads")
    .update({ priority: parsed.data.priority })
    .eq("id", threadId);
  if (error) flash(to, "error", dbErrorMessage(error));
  revalidatePath("/admin/support");
  revalidatePath(to);
  flash(to, "ok", `Priority set to ${parsed.data.priority}.`);
}

/** Resolve, close or reopen. Resolving stamps resolved_at; reopening clears it. */
export async function setThreadStatusAction(fd: FormData): Promise<void> {
  await requireStaff(SUPPORT_ROLES);
  const threadId = threadIdFrom(fd);
  const to = back(threadId);
  const parsed = parseForm(supportStatusSchema, fd);
  if (!parsed.ok) flash(to, "error", parsed.error);
  const status = parsed.data.status;
  const resolved = status === "resolved" || status === "closed";
  const sb = await createClient();
  const { error } = await sb
    .from("support_threads")
    .update({ status, resolved_at: resolved ? new Date().toISOString() : null })
    .eq("id", threadId);
  if (error) flash(to, "error", dbErrorMessage(error));
  revalidatePath("/admin/support");
  revalidatePath(to);
  flash(
    to,
    "ok",
    resolved ? "Thread marked resolved." : `Thread reopened (${status.replace(/_/g, " ")}).`,
  );
}

/** Assign the thread to the signed-in staff member, or clear the assignment. */
export async function assignThreadAction(fd: FormData): Promise<void> {
  const ctx = await requireStaff(SUPPORT_ROLES);
  const threadId = threadIdFrom(fd);
  const to = back(threadId);
  const clear = fd.get("clear") === "1";
  const sb = await createClient();
  const { error } = await sb
    .from("support_threads")
    .update({ assigned_to: clear ? null : ctx.user.id })
    .eq("id", threadId);
  if (error) flash(to, "error", dbErrorMessage(error));
  // Keep the historical assignment log in step.
  if (!clear) {
    await sb
      .from("support_assignments")
      .insert({ thread_id: threadId, staff_id: ctx.user.id, assigned_by: ctx.user.id });
  } else {
    await sb
      .from("support_assignments")
      .update({ unassigned_at: new Date().toISOString() })
      .eq("thread_id", threadId)
      .is("unassigned_at", null);
  }
  revalidatePath("/admin/support");
  revalidatePath(to);
  flash(to, "ok", clear ? "Assignment cleared." : "Assigned to you.");
}
