import { cn } from "@/lib/utils";

export interface CompareColumn {
  title: string;
  lines: string[];
  highlight?: boolean;
}

/** Three ways to take the same trip. The Guideless column is set in ink so the contrast is the point. */
export function CompareTable({ columns }: { columns: CompareColumn[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {columns.map((c) => (
        <div
          key={c.title}
          className={cn(
            "rounded border p-6",
            c.highlight
              ? "border-ink bg-ink text-cloud"
              : "border-border bg-surface text-foreground",
          )}
        >
          <h3
            className={cn(
              "font-heading text-xl font-semibold",
              c.highlight ? "text-aqua" : "text-foreground",
            )}
          >
            {c.title}
          </h3>
          <ul
            className={cn(
              "mt-4 space-y-2 text-sm",
              c.highlight ? "text-cloud/85" : "text-muted-foreground",
            )}
          >
            {c.lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
