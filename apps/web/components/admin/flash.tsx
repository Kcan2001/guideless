import { FormError, FormMessage } from "@/components/ui/field";

type SearchParams = Record<string, string | string[] | undefined>;

/** Renders the ?ok= / ?error= message set by lib/admin/form.ts flash(). */
export function Flash({ searchParams }: { searchParams: SearchParams }) {
  const ok = typeof searchParams.ok === "string" ? searchParams.ok : undefined;
  const error = typeof searchParams.error === "string" ? searchParams.error : undefined;
  if (!ok && !error) return null;
  return (
    <div className="mb-6">
      <FormMessage message={ok} />
      <FormError message={error} />
    </div>
  );
}
