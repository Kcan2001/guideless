import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { Linking, View } from "react-native";
import { formatDate } from "@guideless/utils";
import {
  ITEM_ICON,
  ITEM_LABEL,
  changeNoteOf,
  replacementIdOf,
  timeLabel,
} from "@/components/itinerary-item";
import {
  Body,
  Button,
  Card,
  EmptyState,
  Eyebrow,
  H1,
  Loading,
  Muted,
  Pill,
  Screen,
} from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { track } from "@/lib/analytics";
import { tripService } from "@/lib/trips/service";

/** One itinerary item: what, when (local), where, who arranges it, and how to get help. */
export default function ItemScreen() {
  const c = useTheme();
  const router = useRouter();
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const item = useQuery({
    queryKey: ["item", itemId],
    enabled: !!itemId,
    queryFn: () => tripService.getItem(itemId!),
  });
  const itemType = item.data?.type;
  useEffect(() => {
    if (itemId && itemType) track("itinerary_item_viewed", { item_id: itemId, type: itemType });
  }, [itemId, itemType]);

  if (item.isPending) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  if (!item.data) {
    return (
      <Screen>
        <EmptyState title="Not found" body="This item may have been removed from your route." />
      </Screen>
    );
  }

  const i = item.data;
  const mapsQuery = [i.location_name, i.address].filter(Boolean).join(", ");
  const changeNote = changeNoteOf(i);
  const replacementId = replacementIdOf(i);

  return (
    <Screen>
      <Stack.Screen options={{ title: ITEM_LABEL[i.type] }} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.two }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: c.backgroundSelected,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={ITEM_ICON[i.type]} size={22} color={c.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Eyebrow>
            {ITEM_LABEL[i.type]}
            {i.day ? ` · Day ${i.day.day_number}` : ""}
          </Eyebrow>
          <Muted>
            {i.day
              ? formatDate(i.day.date, "en-US", { weekday: "long", month: "long", day: "numeric" })
              : ""}
          </Muted>
        </View>
      </View>
      <H1>{i.title}</H1>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        <Pill tone={i.responsibility === "guideless" ? "accent" : "neutral"}>
          {i.responsibility === "guideless" ? "Guideless handles" : "You book"}
        </Pill>
        {i.is_optional && <Pill>Optional</Pill>}
        {i.status === "changed" && <Pill tone="warning">Updated</Pill>}
        {i.status === "cancelled" && <Pill tone="danger">Cancelled</Pill>}
      </View>

      {changeNote && (
        <Card tone="accent">
          <Eyebrow>What changed</Eyebrow>
          <Body>{changeNote}</Body>
          {replacementId && (
            <Button
              title="Open the replacement"
              variant="secondary"
              icon="arrow-forward-outline"
              onPress={() => router.push(`/item/${replacementId}`)}
            />
          )}
        </Card>
      )}

      <Card>
        <Eyebrow>When</Eyebrow>
        <Body style={{ fontFamily: "Inter_600SemiBold", fontSize: 18 }}>{timeLabel(i)}</Body>
        <Muted style={{ fontSize: 13 }}>Local time · {i.timezone.replace("_", " ")}</Muted>
      </Card>

      {(i.location_name || i.address) && (
        <Card>
          <Eyebrow>Where</Eyebrow>
          {i.location_name && (
            <Body style={{ fontFamily: "Inter_600SemiBold" }}>{i.location_name}</Body>
          )}
          {i.address && <Muted>{i.address}</Muted>}
          <Button
            title="Open in Maps"
            variant="secondary"
            icon="navigate-outline"
            onPress={() => {
              track("map_opened", { source: "item", type: i.type });
              Linking.openURL(
                i.latitude && i.longitude
                  ? `https://maps.google.com/?q=${i.latitude},${i.longitude}`
                  : `https://maps.google.com/?q=${encodeURIComponent(mapsQuery)}`,
              );
            }}
          />
        </Card>
      )}

      {i.description && (
        <Card>
          <Eyebrow>About</Eyebrow>
          <Body>{i.description}</Body>
        </Card>
      )}

      {i.instructions && (
        <Card tone="accent">
          <Eyebrow>Instructions</Eyebrow>
          <Body>{i.instructions}</Body>
        </Card>
      )}

      <Button
        title="Need a hand with this?"
        variant="ghost"
        icon="help-buoy-outline"
        onPress={() =>
          router.push({ pathname: "/support/new", params: { itemId: i.id, subject: i.title } })
        }
      />
    </Screen>
  );
}
