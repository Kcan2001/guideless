import { SubmitButton } from "@/components/admin/submit-button";
import { inputClass, labelClass } from "@/components/admin/ui";
import type { CmsPage } from "@/lib/content/journal";

/** Journal post / standing page editor (cmsPageFormSchema). Plain form; no JavaScript required. */
export function CmsPageForm({
  action,
  page,
  tours,
  submitLabel,
  returnTo,
}: {
  action: (fd: FormData) => Promise<void>;
  page?: CmsPage;
  tours: Array<{ id: string; name: string }>;
  submitLabel: string;
  returnTo?: string;
}) {
  const k = page?.id ?? "new";
  return (
    <form action={action} className="grid gap-4">
      {page && <input type="hidden" name="pageId" value={page.id} />}
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`p-${k}-kind`} className={labelClass}>
            Kind
          </label>
          <select
            id={`p-${k}-kind`}
            name="kind"
            defaultValue={page?.kind ?? "journal"}
            className={inputClass}
          >
            <option value="journal">Journal post</option>
            <option value="page">Standing page</option>
          </select>
        </div>
        <div>
          <label htmlFor={`p-${k}-slug`} className={labelClass}>
            Slug (lowercase, hyphens)
          </label>
          <input
            id={`p-${k}-slug`}
            name="slug"
            defaultValue={page?.slug ?? ""}
            className={inputClass}
            required
            pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
            placeholder="what-a-week-in-nice-costs"
          />
        </div>
      </div>

      <div>
        <label htmlFor={`p-${k}-title`} className={labelClass}>
          Title
        </label>
        <input
          id={`p-${k}-title`}
          name="title"
          defaultValue={page?.title ?? ""}
          className={inputClass}
          required
          minLength={3}
          maxLength={160}
        />
      </div>

      <div>
        <label htmlFor={`p-${k}-excerpt`} className={labelClass}>
          Summary — the line on the journal index (required to publish)
        </label>
        <textarea
          id={`p-${k}-excerpt`}
          name="excerpt"
          defaultValue={page?.excerpt ?? ""}
          className={inputClass}
          rows={2}
          maxLength={300}
        />
      </div>

      <div>
        <label htmlFor={`p-${k}-body`} className={labelClass}>
          Body
        </label>
        <textarea
          id={`p-${k}-body`}
          name="bodyMarkdown"
          defaultValue={page?.body_markdown ?? ""}
          className={`${inputClass} font-mono text-sm`}
          rows={22}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Markdown subset: <code>## heading</code>, <code>### heading</code>, blank line between
          paragraphs, <code>- bullet</code>, <code>1. number</code>, <code>&gt; quote</code>,{" "}
          <code>**bold**</code>, <code>*italic*</code>, <code>[text](/path)</code>. Anything else
          shows as written.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`p-${k}-hero`} className={labelClass}>
            Hero image (/photos/… or an https URL)
          </label>
          <input
            id={`p-${k}-hero`}
            name="heroImageUrl"
            defaultValue={page?.hero_image_url ?? ""}
            className={inputClass}
            placeholder="/photos/nice-promenade-dusk.jpg"
          />
        </div>
        <div>
          <label htmlFor={`p-${k}-og`} className={labelClass}>
            Social card image (optional; the hero is used otherwise)
          </label>
          <input
            id={`p-${k}-og`}
            name="ogImageUrl"
            defaultValue={page?.og_image_url ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`p-${k}-author`} className={labelClass}>
            Byline
          </label>
          <input
            id={`p-${k}-author`}
            name="authorName"
            defaultValue={page?.author_name ?? ""}
            className={inputClass}
            maxLength={80}
          />
        </div>
        <div>
          <label htmlFor={`p-${k}-tour`} className={labelClass}>
            Trip this post sends readers to
          </label>
          <select
            id={`p-${k}-tour`}
            name="tourId"
            defaultValue={page?.tour_id ?? ""}
            className={inputClass}
          >
            <option value="">No trip — generic call to action</option>
            {tours.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`p-${k}-seo-title`} className={labelClass}>
            SEO title (defaults to the title)
          </label>
          <input
            id={`p-${k}-seo-title`}
            name="seoTitle"
            defaultValue={page?.seo_title ?? ""}
            className={inputClass}
            maxLength={70}
          />
        </div>
        <div>
          <label htmlFor={`p-${k}-seo-desc`} className={labelClass}>
            SEO description (defaults to the summary)
          </label>
          <input
            id={`p-${k}-seo-desc`}
            name="seoDescription"
            defaultValue={page?.seo_description ?? ""}
            className={inputClass}
            maxLength={200}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isPublished" defaultChecked={page?.is_published ?? false} />
        Published — visible to everyone at its URL
      </label>

      <div>
        <SubmitButton size="sm">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
