export interface LegalSection {
  id: string;
  title: string;
  paragraphs?: string[];
  list?: string[];
}

export interface LegalDocument {
  slug: "terms" | "privacy" | "booking-agreement";
  title: string;
  lede: string;
  /** Matches brand.termsVersion; stored on each booking as the accepted version. */
  version: string;
  /** ISO date. */
  lastUpdated: string;
  sections: LegalSection[];
}
