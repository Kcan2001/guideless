/**
 * Shared mailboxes on guidelesstravel.com.
 *
 * Each address is a Google Workspace group, so mail is kept even as people are added to it
 * (docs/business-readiness.md §1). Use the address that matches what the reader needs: a traveler
 * whose flight lands in four hours should not queue behind a hotel contract.
 *
 * `brand.supportEmail` stays the general address, so anything that has no better home keeps
 * working. `bookings` is an operations mailbox — supplier confirmations, manifests, roster
 * changes — and is deliberately not published on customer pages.
 */
export const emails = {
  /** Before booking: trips, dates, hotel tiers, traveling with friends. Press too. */
  hello: "hello@guidelesstravel.com",
  /** A booking that already exists, or a trip already under way. */
  support: "support@guidelesstravel.com",
  /** Booking operations: supplier confirmations, manifests, roster changes. Internal. */
  bookings: "bookings@guidelesstravel.com",
  /** Hotels, transport, activity operators, and anyone proposing to work with us. */
  partners: "partners@guidelesstravel.com",
  /** Payments, refunds, invoices, and anything that shows up on a card statement. */
  finance: "finance@guidelesstravel.com",
} as const;

export type MailboxName = keyof typeof emails;
