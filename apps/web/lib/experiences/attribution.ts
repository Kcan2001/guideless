/**
 * Partner attribution on a link out to the operator.
 *
 * We sell most bought-in experiences ourselves and fulfil them afterwards, but a traveler who would
 * rather book it directly should be able to — and when they do, the referral should count. That is
 * both fair and the thing the affiliate relationship is actually for.
 *
 * Pure and tested because it is easy to get quietly wrong: an unattributed link earns nothing and
 * looks identical to one that works, so the failure is invisible until a commission statement is
 * empty months later.
 */

/** Guideless' Viator partner id. Not a secret — it is in every outbound link by design. */
export const VIATOR_PARTNER_ID = "P00319201";

export interface AttributionOptions {
  /** Where on our site the link was clicked, so the reporting can tell them apart. */
  campaign?: string;
  partnerId?: string;
}

/**
 * Append partner attribution to an operator URL.
 *
 * Existing query parameters are preserved and ours win on collision, because a supplier URL that
 * already carries somebody else's `pid` would otherwise credit them for our traveler.
 */
export function attributeViatorUrl(url: string, options: AttributionOptions = {}): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // A malformed URL is dropped rather than rendered: a broken link is worse than no link.
    return null;
  }
  // Only ever rewrite links that are actually theirs.
  if (!/(^|\.)viator\.com$/i.test(parsed.hostname)) return null;

  parsed.searchParams.set("pid", options.partnerId ?? VIATOR_PARTNER_ID);
  parsed.searchParams.set("medium", "api");
  parsed.searchParams.set("version", "2.0");
  if (options.campaign) parsed.searchParams.set("campaign", options.campaign);

  return parsed.toString();
}

/**
 * What a traveler is told about who runs an experience.
 *
 * Deliberately plain. We are not hiding that a ticket was bought in, so the wording names the
 * operator rather than saying "our partner" and hoping nobody asks.
 */
export function operatorNotice(operatedBy: string): string {
  return `Operated by ${operatedBy}. We book it for you and it runs under ${operatedBy}'s terms.`;
}
