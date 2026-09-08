import Link from "next/link";
import type { Route } from "next";
import type { Block, Inline } from "@/lib/content/markdown";
import { parseMarkdown } from "@/lib/content/markdown";
import { cn } from "@/lib/utils";

/**
 * Renders the Markdown subset (lib/content/markdown.ts) as React elements. Text is escaped by
 * React, so a body can never inject markup — there is deliberately no `dangerouslySetInnerHTML`.
 */

function InlineRun({ content }: { content: Inline[] }) {
  return (
    <>
      {content.map((part, i) => {
        switch (part.type) {
          case "bold":
            return <strong key={i}>{part.value}</strong>;
          case "italic":
            return <em key={i}>{part.value}</em>;
          case "link":
            return part.href.startsWith("/") ? (
              <Link key={i} href={part.href as Route}>
                {part.value}
              </Link>
            ) : (
              <a key={i} href={part.href} target="_blank" rel="noopener noreferrer">
                {part.value}
              </a>
            );
          default:
            return <span key={i}>{part.value}</span>;
        }
      })}
    </>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "heading":
      return block.level === 2 ? (
        <h2 className="mt-10 font-heading text-2xl font-bold first:mt-0">
          <InlineRun content={block.content} />
        </h2>
      ) : (
        <h3 className="mt-8 font-heading text-lg font-semibold first:mt-0">
          <InlineRun content={block.content} />
        </h3>
      );
    case "quote":
      return (
        <blockquote className="my-6 border-l-2 border-aqua pl-5 font-heading text-xl">
          <InlineRun content={block.content} />
        </blockquote>
      );
    case "list":
      return block.ordered ? (
        <ol className="my-4 list-decimal space-y-1 pl-5">
          {block.items.map((item, i) => (
            <li key={i}>
              <InlineRun content={item} />
            </li>
          ))}
        </ol>
      ) : (
        <ul className="my-4 list-disc space-y-1 pl-5">
          {block.items.map((item, i) => (
            <li key={i}>
              <InlineRun content={item} />
            </li>
          ))}
        </ul>
      );
    default:
      return (
        <p className="my-4 leading-relaxed">
          <InlineRun content={block.content} />
        </p>
      );
  }
}

/** Long-form staff copy. `max-w-prose` keeps the measure readable regardless of the container. */
export function Prose({ markdown, className }: { markdown: string; className?: string }) {
  const blocks = parseMarkdown(markdown);
  if (!blocks.length) return null;
  return (
    <div className={cn("max-w-prose text-base text-foreground", className)}>
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </div>
  );
}
