import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ItineraryItemType } from "@guideless/types";
import { formatWallTime } from "@guideless/utils";
import { Pill } from "@/components/ui";
import { Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import type { TripItem } from "@/lib/trips/service";

type IconName = ComponentProps<typeof Ionicons>["name"];

export const ITEM_ICON: Record<ItineraryItemType, IconName> = {
  hotel: "bed-outline",
  transfer: "car-outline",
  train: "train-outline",
  flight: "airplane-outline",
  activity: "sparkles-outline",
  meal: "restaurant-outline",
  free_time: "sunny-outline",
  recommendation: "star-outline",
  meeting_point: "location-outline",
  check_in: "log-in-outline",
  check_out: "log-out-outline",
  live_moment: "flash-outline",
  custom: "flag-outline",
};

export const ITEM_LABEL: Record<ItineraryItemType, string> = {
  hotel: "Hotel",
  transfer: "Transfer",
  train: "Train",
  flight: "Flight",
  activity: "Experience",
  meal: "Meal",
  free_time: "Free time",
  recommendation: "Recommendation",
  meeting_point: "Meeting point",
  check_in: "Check-in",
  check_out: "Check-out",
  live_moment: "Live Moment",
  custom: "Note",
};

export function timeLabel(item: Pick<TripItem, "start_time" | "end_time">): string {
  if (item.start_time && item.end_time)
    return `${formatWallTime(item.start_time)} – ${formatWallTime(item.end_time)}`;
  if (item.start_time) return formatWallTime(item.start_time);
  if (item.end_time) return `by ${formatWallTime(item.end_time)}`;
  return "Anytime";
}

export function ItineraryItemRow({
  item,
  highlight = false,
}: {
  item: TripItem;
  highlight?: boolean;
}) {
  const c = useTheme();
  const router = useRouter();
  const isFree = item.type === "free_time";
  const cancelled = item.status === "cancelled";

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/item/${item.id}`)}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: isFree ? c.backgroundSelected : c.backgroundElement,
          borderColor: highlight ? c.accent : isFree ? c.accent : c.border,
          borderStyle: isFree ? "dashed" : "solid",
          opacity: pressed ? 0.8 : cancelled ? 0.5 : 1,
        },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: isFree ? c.accent : c.backgroundSelected }]}>
        <Ionicons name={ITEM_ICON[item.type]} size={18} color={isFree ? "#0B2025" : c.text} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.time, { color: c.textSecondary }]}>
          {timeLabel(item)} · {ITEM_LABEL[item.type]}
        </Text>
        <Text
          style={[
            styles.title,
            { color: c.text, textDecorationLine: cancelled ? "line-through" : "none" },
          ]}
        >
          {item.title}
        </Text>
        {item.location_name ? (
          <Text style={[styles.sub, { color: c.textSecondary }]}>{item.location_name}</Text>
        ) : null}
        <View style={styles.pills}>
          {item.is_optional && <Pill>Optional</Pill>}
          <Pill tone={item.responsibility === "guideless" ? "accent" : "neutral"}>
            {item.responsibility === "guideless" ? "Guideless handles" : "You book"}
          </Pill>
          {item.status === "changed" && <Pill tone="warning">Updated</Pill>}
          {cancelled && <Pill tone="danger">Cancelled</Pill>}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
  },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  time: { fontFamily: "Inter_500Medium", fontSize: 13 },
  title: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  sub: { fontFamily: "Inter_400Regular", fontSize: 13 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
});
