"use server";

import { revalidatePath } from "next/cache";
import { tripDocumentRecordSchema, uuidSchema } from "@guideless/validation";
import { OPS_ROLES, requireStaff } from "@/lib/auth/staff";
import { dbErrorMessage } from "@/lib/admin/form";
import { createClient } from "@/lib/supabase/server";

export interface DocumentActionResult {
  ok: boolean;
  error?: string;
}

/**
 * The browser uploads the file straight to the private `trip-documents` bucket (RLS: ops staff),
 * then calls this to record the metadata. Server bodies never carry the file, so Vercel's request
 * limit does not apply. The insert trigger notifies the travelers it is for.
 */
export async function recordTripDocumentAction(input: {
  tripId: string;
  record: unknown;
}): Promise<DocumentActionResult> {
  const ctx = await requireStaff(OPS_ROLES);
  const tripId = uuidSchema.safeParse(input.tripId);
  if (!tripId.success) return { ok: false, error: "Invalid trip." };
  const parsed = tripDocumentRecordSchema.safeParse(input.record);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      error: `${first?.path.join(".") ?? "input"}: ${first?.message ?? "Invalid"}`,
    };
  }
  const r = parsed.data;
  if (!r.storagePath.startsWith(`trips/${tripId.data}/`)) {
    return { ok: false, error: "The file was uploaded under another trip." };
  }
  const sb = await createClient();
  const { error } = await sb.from("trip_documents").insert({
    trip_id: tripId.data,
    kind: r.kind,
    title: r.title,
    bucket: "trip-documents",
    storage_path: r.storagePath,
    mime_type: r.mimeType,
    size_bytes: r.sizeBytes,
    visibility: r.visibility,
    for_user_id: r.forUserId,
    uploaded_by: ctx.user.id,
  });
  if (error) {
    // Do not leave an orphaned object behind.
    await sb.storage.from("trip-documents").remove([r.storagePath]);
    return { ok: false, error: dbErrorMessage(error) };
  }
  revalidatePath(`/admin/departures`, "layout");
  return { ok: true };
}

/** Removes the object first, then the row; a failed object removal keeps the row for retry. */
export async function deleteTripDocumentAction(fd: FormData): Promise<void> {
  await requireStaff(OPS_ROLES);
  const documentId = uuidSchema.safeParse(fd.get("documentId"));
  const returnTo = String(fd.get("returnTo") ?? "/admin/departures");
  if (!documentId.success) throw new Error("Missing or invalid documentId");
  const sb = await createClient();
  const { data: doc } = await sb
    .from("trip_documents")
    .select("id, bucket, storage_path")
    .eq("id", documentId.data)
    .maybeSingle();
  if (!doc) throw new Error("Document not found");
  const { error: storageError } = await sb.storage.from(doc.bucket).remove([doc.storage_path]);
  if (storageError) throw new Error(`Could not remove the file: ${storageError.message}`);
  const { error } = await sb.from("trip_documents").delete().eq("id", doc.id);
  if (error) throw new Error(dbErrorMessage(error));
  revalidatePath(returnTo);
}
