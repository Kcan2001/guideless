import { useQuery } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { View } from "react-native";
import {
  Card,
  EmptyState,
  ErrorNote,
  Eyebrow,
  H1,
  Loading,
  Muted,
  Row,
  Screen,
} from "@/components/ui";
import { SyncBadge } from "@/components/sync-badge";
import { Spacing } from "@/constants/theme";
import { useCurrentTrip } from "@/hooks/use-trip";
import { track } from "@/lib/analytics";
import { documentsService, groupDocuments, type TripDocument } from "@/lib/documents/service";

const KIND_ICON = {
  ticket: "ticket-outline",
  voucher: "pricetag-outline",
  hotel_confirmation: "bed-outline",
  insurance: "shield-checkmark-outline",
  guide: "book-outline",
  map: "map-outline",
  other: "document-text-outline",
} as const;

/** Tickets, vouchers and confirmations for the current trip. The list works offline; files need signal. */
export default function DocumentsScreen() {
  const { detail } = useCurrentTrip();
  const tripId = detail?.trip.id ?? null;
  const [cached, setCached] = useState<TripDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tripId) return;
    let alive = true;
    documentsService.cached(tripId).then((c) => alive && setCached(c));
    return () => {
      alive = false;
    };
  }, [tripId]);

  const docs = useQuery({
    queryKey: ["documents", tripId],
    enabled: !!tripId,
    queryFn: () => documentsService.list(tripId!),
  });
  const list = docs.data ?? cached ?? [];
  const offline = !docs.data && !!cached && (docs.isError || docs.isPending);

  async function open(doc: TripDocument) {
    setError(null);
    try {
      const url = await documentsService.signedUrl(doc);
      track("document_opened", { document_id: doc.id, kind: doc.kind });
      await WebBrowser.openBrowserAsync(url);
    } catch {
      setError("Couldn't open that file. Check your connection and try again.");
    }
  }

  if (!detail) {
    return (
      <Screen>
        <Eyebrow>Documents</Eyebrow>
        <H1>Your papers</H1>
        <EmptyState
          icon="document-text-outline"
          title="Nothing here yet"
          body="Tickets, vouchers and hotel confirmations appear once your trip is open."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Eyebrow>Documents</Eyebrow>
      <H1>Your papers</H1>
      <Muted>
        Everything we have booked for you, in one place. Open a file to save it to your phone.
      </Muted>
      <SyncBadge offline={offline} syncedAt={docs.data ? new Date().toISOString() : null} />
      <ErrorNote message={error} />
      {docs.isPending && !cached ? (
        <Loading />
      ) : list.length === 0 ? (
        <EmptyState
          icon="document-text-outline"
          title="No documents yet"
          body="Train tickets and hotel confirmations are added about a week before departure."
        />
      ) : (
        groupDocuments(list).map((group) => (
          <View key={group.kind} style={{ gap: Spacing.two }}>
            <Eyebrow>{group.label}</Eyebrow>
            <Card style={{ padding: 0 }}>
              <View style={{ paddingHorizontal: Spacing.three }}>
                {group.docs.map((d) => (
                  <Row
                    key={d.id}
                    icon={KIND_ICON[d.kind as keyof typeof KIND_ICON] ?? "document-text-outline"}
                    title={d.title}
                    subtitle={d.for_user_id ? "Yours" : "Whole group"}
                    onPress={() => open(d)}
                  />
                ))}
              </View>
            </Card>
          </View>
        ))
      )}
    </Screen>
  );
}
