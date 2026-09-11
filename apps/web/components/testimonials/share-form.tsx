"use client";

import { useId, useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { TESTIMONIAL_PHOTO_MAX_BYTES, TESTIMONIAL_PHOTO_MIME_TYPES } from "@guideless/validation";
import { SubmitButton } from "@/components/admin/submit-button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { submitTestimonialAction } from "@/lib/testimonials/submit";
import { createClient } from "@/lib/supabase/client";

const MAX_PHOTOS = 12;
const BUCKET = "testimonial-uploads";

interface Picked {
  path: string;
  name: string;
  preview: string;
}

/**
 * The form behind the link Kyle sends to somebody who came on an earlier trip.
 *
 * Photos upload as they are chosen rather than on submit, because a phone on hotel wifi posting
 * twelve images in one request is how this feature would actually fail. Each file goes straight
 * into the private testimonial-uploads bucket under a folder named for this submission — the id is
 * generated here, before anything is sent, because the files need somewhere to live before there
 * is a row to attach them to. `submit_testimonial()` re-checks that every path is inside that
 * folder, so nothing here is load-bearing for security.
 *
 * Previews come from the local File, not from the bucket: the bucket is private and deliberately
 * unreadable, including by the person who just uploaded.
 */
export function ShareForm({ tourSlug, tourName }: { tourSlug: string; tourName: string }) {
  const [submissionId] = useState(() => crypto.randomUUID());
  const [photos, setPhotos] = useState<Picked[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const ids = useId();
  const id = (name: string) => `${ids}-${name}`;

  async function onPick(files: FileList | null): Promise<void> {
    if (!files || files.length === 0) return;
    setUploadError(null);
    setUploading(true);
    const sb = createClient();
    const added: Picked[] = [];

    for (const file of Array.from(files)) {
      if (photos.length + added.length >= MAX_PHOTOS) break;
      if (!TESTIMONIAL_PHOTO_MIME_TYPES.includes(file.type as never)) {
        setUploadError(`${file.name} is not a photo we can take.`);
        continue;
      }
      if (file.size > TESTIMONIAL_PHOTO_MAX_BYTES) {
        setUploadError(`${file.name} is bigger than 15 MB.`);
        continue;
      }
      const path = `${submissionId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await sb.storage.from(BUCKET).upload(path, file, { upsert: false });
      if (error) {
        setUploadError("One of those didn't upload. Try it again?");
        continue;
      }
      added.push({ path, name: file.name, preview: URL.createObjectURL(file) });
    }

    setPhotos((prev) => [...prev, ...added]);
    setUploading(false);
    if (fileInput.current) fileInput.current.value = "";
  }

  function remove(path: string): void {
    // Left in the bucket deliberately: deleting would need a policy letting anyone delete anything
    // in a folder they can name. An orphan in a private bucket costs nothing and staff can clear it.
    setPhotos((prev) => prev.filter((p) => p.path !== path));
  }

  return (
    <form action={submitTestimonialAction} className="grid gap-6">
      <input type="hidden" name="submissionId" value={submissionId} />
      <input type="hidden" name="tourSlug" value={tourSlug} />
      <input type="hidden" name="photoPaths" value={JSON.stringify(photos.map((p) => p.path))} />
      {/* Honeypot. Real people never see it; bots fill everything in. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="hidden"
      />

      <Field
        id={id("quote")}
        label="What was it like?"
        hint="A sentence or two is plenty. Your words, not ours."
      >
        <Textarea
          id={id("quote")}
          name="quote"
          rows={5}
          required
          minLength={20}
          maxLength={2000}
          placeholder={`What stood out about ${tourName}?`}
        />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field id={id("name")} label="First name" hint="That's all that ever appears.">
          <Input
            id={id("name")}
            name="authorName"
            required
            maxLength={60}
            autoComplete="given-name"
          />
        </Field>
        <Field id={id("year")} label="Which year were you there?" hint="Optional.">
          <Input
            id={id("year")}
            name="tripYear"
            type="number"
            min={2000}
            max={2100}
            placeholder="2025"
          />
        </Field>
      </div>

      <Field
        id={id("email")}
        label="Your email"
        hint="Only so Kyle can send you the exact wording before it goes up. It is never shown anywhere."
      >
        <Input id={id("email")} name="email" type="email" required autoComplete="email" />
      </Field>

      <div>
        <p className="text-sm font-medium">Photos</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Anything from the weekend. Don&rsquo;t pick the best ones — send whatever you have.
        </p>

        <input
          ref={fileInput}
          id={id("photos")}
          type="file"
          accept={TESTIMONIAL_PHOTO_MIME_TYPES.join(",")}
          multiple
          className="sr-only"
          onChange={(e) => void onPick(e.target.files)}
        />
        <label
          htmlFor={id("photos")}
          className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded border border-border px-4 py-2 text-sm font-medium hover:bg-cloud"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Upload className="h-4 w-4" aria-hidden />
          )}
          {uploading ? "Uploading…" : photos.length > 0 ? "Add more" : "Choose photos"}
        </label>

        {uploadError && <p className="mt-2 text-sm text-danger">{uploadError}</p>}

        {photos.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-3">
            {photos.map((p) => (
              <li key={p.path} className="relative">
                {/* Local object URL, not a bucket URL — the bucket is private. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.preview}
                  alt={p.name}
                  className="h-24 w-24 rounded border border-border object-cover"
                />
                <button
                  type="button"
                  onClick={() => remove(p.path)}
                  className="absolute -right-2 -top-2 rounded-full border border-border bg-surface p-1 shadow-sm"
                  aria-label={`Remove ${p.name}`}
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <label className="flex items-start gap-3 rounded border border-border bg-cloud/60 p-4">
        <input type="checkbox" name="consentPublic" required className="mt-1" />
        <span className="text-sm">
          <span className="font-medium">
            Guideless can use what I&rsquo;ve written on their website, with my first name.
          </span>{" "}
          <span className="text-muted-foreground">
            It won&rsquo;t appear as a review of a Guideless trip, because it wasn&rsquo;t one. Ask
            Kyle to take it down any time and it goes.
          </span>
        </span>
      </label>

      <label className="flex items-start gap-3">
        <input type="checkbox" name="consentPhotos" className="mt-1" defaultChecked />
        <span className="text-sm text-muted-foreground">
          They can use my photos too. Untick if you&rsquo;d rather they didn&rsquo;t.
        </span>
      </label>

      <div>
        <SubmitButton pendingText="Sending…" disabled={uploading}>
          Send it
        </SubmitButton>
      </div>
    </form>
  );
}
