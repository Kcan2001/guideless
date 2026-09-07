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

/**
 * One optional add-on on the itinerary: price, time, place, who from the group is in, and an
 * "Add" that opens the web purchase page (Stripe lives on the web; the app never sees a card).
 */
export function AddOnCard({
  addOn,
  bookingId,
  todayISO,
}: {
  addOn: AddOnView;
  bookingId: string | null;
  todayISO: string;
}) {
  const { user } = useSession();
  const state = addOnState(addOn, todayISO);
  const who = participantsLabel(addOn.participants, user?.id ?? null);
  const price = formatMoney(
    { amount: addOn.price_amount, currency: addOn.currency as Currency },
    { compact: true },
  );
  const when = [addOn.start_time ? formatWallTime(addOn.start_time) : null, addOn.location_name]
    .filter(Boolean)
    .join(" · ");

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
