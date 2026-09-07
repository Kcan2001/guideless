import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Tables } from "@guideless/types";
import { supabase } from "@/lib/supabase";

export type TripDocument = Tables<"trip_documents">;

export const DOCUMENT_KINDS = [
  "ticket",
  "voucher",
  "hotel_confirmation",
  "insurance",
  "guide",
  "map",
  "other",
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const DOCUMENT_KIND_LABEL: Record<DocumentKind, string> = {
  ticket: "Tickets",
  voucher: "Vouchers",
  hotel_confirmation: "Hotel confirmations",
  insurance: "Insurance",
  guide: "Guides",
  map: "Maps",
  other: "Other",
};

const KEY = (tripId: string) => `guideless:documents:${tripId}`;

/** Group documents by kind in the display order, dropping empty groups. Pure, for tests and UI. */
export function groupDocuments(
  docs: TripDocument[],
): { kind: DocumentKind; label: string; docs: TripDocument[] }[] {
  return DOCUMENT_KINDS.map((kind) => ({
    kind,
    label: DOCUMENT_KIND_LABEL[kind],
    docs: docs.filter((d) => (d.kind as DocumentKind) === kind),
  })).filter((g) => g.docs.length > 0);
}

/**
 * Trip documents (spec: tickets, vouchers, confirmations). RLS returns the group's documents plus
 * the ones addressed to this traveler. The list is cached so it opens offline; the files themselves
 * open through short-lived signed URLs.
 */
export const documentsService = {
  async list(tripId: string): Promise<TripDocument[]> {
    const { data, error } = await supabase
      .from("trip_documents")
      .select("*")
      .eq("trip_id", tripId)
      .order("kind")
      .order("title");
    if (error) throw error;
    try {
      await AsyncStorage.setItem(KEY(tripId), JSON.stringify(data));
    } catch {
      /* best effort */
    }
    return data;
  },

  async cached(tripId: string): Promise<TripDocument[] | null> {
    try {
      const raw = await AsyncStorage.getItem(KEY(tripId));
      return raw ? (JSON.parse(raw) as TripDocument[]) : null;
    } catch {
      return null;
    }
  },

  /** A five-minute URL to the file; opened in the in-app browser / system viewer. */
  async signedUrl(doc: Pick<TripDocument, "bucket" | "storage_path">): Promise<string> {
    const { data, error } = await supabase.storage
      .from(doc.bucket)
      .createSignedUrl(doc.storage_path, 300);
    if (error) throw error;
    return data.signedUrl;
  },
};
