"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  TRIP_DOCUMENT_KINDS,
  TRIP_DOCUMENT_MAX_BYTES,
  TRIP_DOCUMENT_MIME_TYPES,
} from "@guideless/validation";
import { inputClass, labelClass } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { recordTripDocumentAction } from "@/lib/admin/actions/documents";
import { createClient } from "@/lib/supabase/client";

const KIND_LABEL: Record<(typeof TRIP_DOCUMENT_KINDS)[number], string> = {
  ticket: "Ticket",
  voucher: "Voucher",
  hotel_confirmation: "Hotel confirmation",
  insurance: "Insurance",
  guide: "Guide",
  map: "Map",
  other: "Other",
};

function safeFileName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned.slice(0, 80) || "document";
}

/**
 * Upload goes browser → Storage directly (RLS lets ops staff write to trip-documents), then the
 * server records the row. Files never pass through a server body, so size limits are the
 * bucket's (50 MB). Needs JavaScript; the list and delete below work without it.
 */
export function TripDocumentUpload({
  tripId,
  members,
}: {
  tripId: string;
  members: Array<{ userId: string; label: string }>;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit(fd: FormData) {
    setError(null);
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("Choose a file first.");
      return;
    }
    if (!(TRIP_DOCUMENT_MIME_TYPES as readonly string[]).includes(file.type)) {
      setError("PDF, JPEG, PNG or WebP only.");
      return;
    }
    if (file.size > TRIP_DOCUMENT_MAX_BYTES) {
      setError("That file is over 50 MB.");
      return;
    }
    const title = String(fd.get("title") ?? "").trim() || file.name.replace(/\.[^.]+$/, "");
    const storagePath = `trips/${tripId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;

    start(async () => {
      setProgress("Uploading…");
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("trip-documents")
        .upload(storagePath, file, { contentType: file.type, upsert: false });
      if (uploadError) {
        setProgress(null);
        setError(`Upload failed: ${uploadError.message}`);
        return;
      }
      setProgress("Saving…");
      const result = await recordTripDocumentAction({
        tripId,
        record: {
          kind: fd.get("kind"),
          title,
          forUserId: fd.get("forUserId"),
          visibility: fd.get("visibility"),
          storagePath,
          mimeType: file.type,
          sizeBytes: file.size,
        },
      });
      setProgress(null);
      if (!result.ok) {
        setError(result.error ?? "Could not save the document.");
        return;
      }
      formRef.current?.reset();
      router.refresh();
    });
  }

  return (
    <form ref={formRef} action={submit} className="mb-4 grid gap-2 sm:grid-cols-2">
      <label className="text-sm">
        <span className={labelClass}>Kind</span>
        <select name="kind" defaultValue="hotel_confirmation" className={inputClass}>
          {TRIP_DOCUMENT_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className={labelClass}>Title</span>
        <input
          name="title"
          placeholder="Defaults to the file name"
          className={inputClass}
          maxLength={200}
        />
      </label>
      <label className="text-sm">
        <span className={labelClass}>For</span>
        <select name="forUserId" defaultValue="" className={inputClass}>
          <option value="">Everyone on the trip</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className={labelClass}>Visibility</span>
        <select name="visibility" defaultValue="trip_member" className={inputClass}>
          <option value="trip_member">Travelers (notifies them)</option>
          <option value="staff_only">Staff only</option>
        </select>
      </label>
      <label className="text-sm sm:col-span-2">
        <span className={labelClass}>File (PDF, JPEG, PNG or WebP, up to 50 MB)</span>
        <input
          type="file"
          name="file"
          accept={TRIP_DOCUMENT_MIME_TYPES.join(",")}
          required
          className={inputClass}
        />
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? (progress ?? "Working…") : "Upload document"}
        </Button>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
