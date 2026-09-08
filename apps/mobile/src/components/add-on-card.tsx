import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { View } from "react-native";
import { formatMoney, formatWallTime } from "@guideless/utils";
import type { Currency } from "@guideless/types";
import { Button, Card, H2, Muted, Pill } from "@/components/ui";
import { track } from "@/lib/analytics";
import {
  SITE_URL,
  addOnState,
  participantsLabel,
  purchaseUrl,
  type AddOnView,
} from "@/lib/add-ons/service";
import { useSession } from "@/lib/auth/session";
import { addOnRoomsService } from "@/lib/chat/add-on-rooms";

/**
 * One optional add-on on the itinerary: price, time, place, who from the group is in, and an
 * "Add" that opens the web purchase page (Stripe lives on the web; the app never sees a card).
 */
export function AddOnCard({
  addOn,
  bookingId,
  todayISO,
  tripId = null,
}: {
  addOn: AddOnView;
  bookingId: string | null;
  todayISO: string;
  /** Enables "Chat with who's going" once the traveler has bought this add-on. */
  tripId?: string | null;
}) {
  const { user } = useSession();
  const router = useRouter();
  const state = addOnState(addOn, todayISO);
  const who = participantsLabel(addOn.participants, user?.id ?? null);
  const price = formatMoney(
    { amount: addOn.price_amount, currency: addOn.currency as Currency },
    { compact: true },
  );
  const when = [addOn.start_time ? formatWallTime(addOn.start_time) : null, addOn.location_name]
    .filter(Boolean)
    .join(" · ");

  // The room is created on first use; a database without the feature simply never offers it.
  const openChat = useMutation({
    mutationFn: () => addOnRoomsService.ensureRoom(tripId!, addOn.id),
    onSuccess: (room) => {
      if (!room) return;
      track("add_on_chat_opened", { add_on_id: addOn.id });
      router.push(`/chat/${room.id}`);
    },
  });
  const canChat = state === "mine" && !!tripId && !addOnRoomsService.isUnavailable;

  return (
    <Card tone={state === "mine" ? "accent" : "default"}>
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
        <Pill>Optional add-on</Pill>
        {state === "mine" && <Pill tone="accent">You&rsquo;re in</Pill>}
        {state === "full" && <Pill tone="warning">Full</Pill>}
        {state === "closed" && <Pill>Closed</Pill>}
      </View>
      <H2>{addOn.title}</H2>
      {when ? <Muted>{when}</Muted> : null}
      {addOn.description ? <Muted style={{ fontSize: 14 }}>{addOn.description}</Muted> : null}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginTop: 4,
        }}
      >
        <View style={{ flex: 1 }}>
          <Muted style={{ fontSize: 13 }}>
            {price}
            {addOn.pricing_basis === "per_traveler" ? " per person" : " per booking"}
            {addOn.going > 0 ? ` · ${addOn.going} going` : ""}
          </Muted>
          {who && state !== "mine" ? <Muted style={{ fontSize: 13 }}>{who}</Muted> : null}
          {who && state === "mine" && who !== "You're in" ? (
            <Muted style={{ fontSize: 13 }}>{who}</Muted>
          ) : null}
        </View>
        {canChat && (
          <Button
            title={openChat.isPending ? "Opening…" : "Chat"}
            variant="secondary"
            icon="chatbubbles-outline"
            disabled={openChat.isPending}
            accessibilityLabel={`Chat with travelers going to ${addOn.title}`}
            style={{ minHeight: 40, paddingHorizontal: 14 }}
            onPress={() => openChat.mutate()}
          />
        )}
        {state === "open" && bookingId && (
          <Button
            title="Add"
            icon="add-circle-outline"
            style={{ minHeight: 40, paddingHorizontal: 16 }}
            onPress={() => {
              track("add_on_add_tapped", { departure_id: addOn.departure_id, add_on_id: addOn.id });
              WebBrowser.openBrowserAsync(purchaseUrl(bookingId, addOn.id, SITE_URL));
            }}
          />
        )}
      </View>
    </Card>
  );
}
