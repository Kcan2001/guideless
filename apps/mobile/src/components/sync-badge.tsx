import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/hooks/use-theme";
import { syncedAgo } from "@/lib/trips/cache";

/** "Last synced 8 minutes ago" — shown instead of silently failing (spec §49). */
export function SyncBadge({ offline, syncedAt }: { offline: boolean; syncedAt: string | null }) {
  const c = useTheme();
  if (!offline || !syncedAt) return null;
  return (
    <View style={[styles.badge, { backgroundColor: c.backgroundSelected }]}>
      <Ionicons name="cloud-offline-outline" size={14} color={c.textSecondary} />
      <Text style={[styles.text, { color: c.textSecondary }]}>
        Offline · last synced {syncedAgo(syncedAt)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: { fontFamily: "Inter_500Medium", fontSize: 12 },
});
