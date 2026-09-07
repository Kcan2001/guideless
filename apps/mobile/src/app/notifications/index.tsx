import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { DeepLink } from "@guideless/types";
import { Button, Card, EmptyState, Eyebrow, H1, Loading, Muted, Screen } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { useInbox } from "@/hooks/use-inbox";
import { useTheme } from "@/hooks/use-theme";
import { deepLinkToPath } from "@/lib/notifications/deep-links";
import { relativeTime, type Notification } from "@/lib/notifications/inbox";

const CATEGORY_ICON = {
  operational: "train-outline",
  social: "people-outline",
  marketing: "sparkles-outline",
} as const;

/** Everything Guideless and your group have told you, newest unread first. */
export default function InboxScreen() {
  const c = useTheme();
  const router = useRouter();
  const inbox = useInbox();

  function open(n: Notification) {
    if (!n.read_at) inbox.markRead.mutate(n.id);
    const path = n.deep_link ? deepLinkToPath(n.deep_link as unknown as DeepLink) : null;
    if (path) router.push(path as never);
  }

  return (
    <Screen>
      <View
        style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}
      >
        <View>
          <Eyebrow>Updates</Eyebrow>
          <H1>Inbox</H1>
        </View>
        {inbox.unread > 0 && (
          <Button
            title="Mark all read"
            variant="ghost"
            onPress={() => inbox.markAllRead.mutate()}
            loading={inbox.markAllRead.isPending}
          />
        )}
      </View>
      {inbox.isPending ? (
        <Loading />
      ) : (inbox.data ?? []).length === 0 ? (
        <EmptyState
          icon="notifications-outline"
          title="Nothing yet"
          body="Trip updates, group messages and moments land here. Quiet is good."
        />
      ) : (
        <Card style={{ padding: 0 }}>
          {(inbox.data ?? []).map((n, i) => {
            const unread = !n.read_at;
            return (
              <Pressable
                key={n.id}
                onPress={() => open(n)}
                accessibilityRole="button"
                accessibilityLabel={`${unread ? "Unread: " : ""}${n.title}`}
                style={({ pressed }) => [
                  styles.row,
                  i > 0 && { borderTopWidth: 1, borderTopColor: c.border },
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <View
                  style={[
                    styles.icon,
                    { backgroundColor: unread ? c.accent : c.backgroundSelected },
                  ]}
                >
                  <Ionicons
                    name={CATEGORY_ICON[n.category] ?? "notifications-outline"}
                    size={18}
                    color={unread ? "#0B2025" : c.textSecondary}
                  />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    style={{
                      fontFamily: unread ? "Inter_600SemiBold" : "Inter_500Medium",
                      fontSize: 16,
                      color: c.text,
                    }}
                  >
                    {n.title}
                  </Text>
                  {n.body ? <Muted style={{ fontSize: 14 }}>{n.body}</Muted> : null}
                  <Muted style={{ fontSize: 12 }}>{relativeTime(n.created_at)}</Muted>
                </View>
                {n.deep_link ? (
                  <Ionicons name="chevron-forward" size={18} color={c.textSecondary} />
                ) : null}
              </Pressable>
            );
          })}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.three,
    padding: Spacing.three,
  },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});
