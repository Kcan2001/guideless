import { type EmailInput, paragraphs, renderEmail, type RenderedEmail } from "@/lib/email/layout";

/**
 * The template behind anything Kyle writes in `/admin/email`.
 *
 * He writes plain text with blank lines between paragraphs and this puts it in the shell. There is
 * deliberately no rich text editor and no HTML field: an admin textarea that accepts markup is how
 * you end up with an email that renders in Gmail and nowhere else, and the brand voice does not
 * need bold text as much as it needs short sentences.
 */
export function campaignEmail(p: {
  subject: string;
  preheader: string | null;
  body: string;
  cta: { label: string; url: string } | null;
  unsubscribeUrl: string;
  reason: string;
}): RenderedEmail & { subject: string } {
  const input: EmailInput = {
    kind: "marketing",
    heading: p.subject,
    ...(p.preheader ? { eyebrow: p.preheader } : {}),
    blocks: paragraphs(p.body),
    ...(p.cta ? { cta: p.cta } : {}),
    unsubscribeUrl: p.unsubscribeUrl,
    reason: p.reason,
  };
  return { subject: p.subject, ...renderEmail(input) };
}

/**
 * Told to Kyle, not to a customer, so it says the useful thing rather than the nice thing: what
 * arrived, who from, and the one link that lets him act on it.
 */
export function staffAlertEmail(p: {
  what: string;
  who: string;
  detail: string;
  url: string;
}): RenderedEmail & { subject: string } {
  return {
    subject: `${p.what} — ${p.who}`,
    ...renderEmail({
      kind: "transactional",
      eyebrow: "Admin",
      heading: p.what,
      blocks: [
        { kind: "facts", rows: [["From", p.who]] },
        { kind: "quote", value: p.detail },
      ],
      cta: { label: "Open it in admin", url: p.url },
    }),
  };
}
