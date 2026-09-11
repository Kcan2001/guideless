"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Share2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ensureGroupCode, type GroupCodeInfo } from "@/lib/bookings/group-codes";

/**
 * "Bring friends along": the trip code for one booking. Friends enter it in the builder to join
 * the same departure and group with their own booking. Created lazily on first view; never shows
 * money. Renders nothing until the code exists (or when codes are not available yet).
 */
export function GroupCodeCard({
  bookingId,
  tourName,
  buildUrl,
}: {
  bookingId: string;
  tourName: string;
  /** Absolute builder URL for this departure, so the share text lands friends on the right dates. */
  buildUrl: string;
}) {
  const [info, setInfo] = useState<GroupCodeInfo | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    void ensureGroupCode(bookingId).then((r) => alive && setInfo(r));
    return () => {
      alive = false;
    };
  }, [bookingId]);

  if (!info) return null;
  const shareText = `Come to ${tourName} with me. Book your own spot and enter code ${info.code} to join my group: ${buildUrl}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(info!.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked; the code is visible to select */
    }
  }
  async function share() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: `Join my ${tourName} trip`,
          text: shareText,
          url: buildUrl,
        });
        return;
      } catch {
        /* dismissed */
      }
    }
    await copy();
  }

  return (
    <div className="rounded border border-border bg-surface p-6" data-testid="group-code-card">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Bring friends along
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Friends book their own spot and enter your code. Same dates, same group, separate payments.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <code className="rounded border border-border bg-cloud px-3 py-2 font-heading text-lg font-bold tracking-wide">
          {info.code}
        </code>
        <Button type="button" variant="secondary" size="sm" onClick={copy}>
          {copied ? (
            <Check className="h-4 w-4" aria-hidden />
          ) : (
            <Copy className="h-4 w-4" aria-hidden />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={share}>
          <Share2 className="h-4 w-4" aria-hidden /> Share
        </Button>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Users className="h-4 w-4" aria-hidden />
        {info.uses === 0
          ? "No friends have joined yet."
          : `${info.uses} ${info.uses === 1 ? "friend has" : "friends have"} joined`}
        {info.maxUses != null ? ` · up to ${info.maxUses}` : ""}
      </p>
    </div>
  );
}
