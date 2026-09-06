import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { emptyStates } from "@guideless/config";
import {
  Card,
  EmptyState,
  Eyebrow,
  H1,
  H2,
  Loading,
  Muted,
  Pill,
  Row,
  Screen,
} from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useCurrentTrip } from "@/hooks/use-trip";
import { useSession } from "@/lib/auth/session";
import { chatService } from "@/lib/chat/service";

const ROOM_ICON = {
  trip_group: "chatbubbles-outline",
  announcements: "megaphone-outline",
  optional_activities: "sparkles-outline",
} as const;
const ROOM_HINT = {
  trip_group: "Everyone on your trip.",
  announcements: "Updates from Guideless. Read-only.",
  optional_activities: "Who's up for what.",
} as const;

export default function GroupScreen() {
  const c = useTheme();
  const router = useRouter();
  const { user } = useSession();
  const { detail } = useCurrentTrip();
  const tripId = detail?.trip.id ?? null;

  const rooms = useQuery({
    queryKey: ["rooms", tripId],
    enabled: !!tripId,
    queryFn: () => chatService.listRooms(tripId!),
    refetchInterval: 30_000,
  });

  if (!detail) {
    return (
      <Screen>
        <Eyebrow>Your group</Eyebrow>
        <H1>Group</H1>
        <EmptyState
          icon="people-outline"
          title="No group yet"
          body="Your group appears once your trip is activated."
        />
      </Screen>
    );
  }

  const members = detail.members.filter((m) => !m.removed_at);

  return (
    <Screen>
      <Eyebrow>Your group</Eyebrow>
      <H1>{members.length} travelers</H1>
      <Muted>Social, but optional. Say hello — or don&rsquo;t.</Muted>

      <View style={{ gap: Spacing.two }}>
        <Eyebrow>Chat</Eyebrow>
        {rooms.isPending ? (
          <Loading />
        ) : (
          (rooms.data ?? []).map((room) => (
            <Card key={room.id} style={{ padding: 0 }}>
              <View style={{ paddingHorizontal: Spacing.three }}>
                <Row
                  icon={ROOM_ICON[room.type]}
                  title={room.name}
                  subtitle={
                    room.lastMessage ? room.lastMessage.body : (ROOM_HINT[room.type] ?? null)
                  }
                  right={
                    room.unread > 0 ? (
                      <Pill tone="accent">{room.unread} new</Pill>
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color={c.textSecondary} />
                    )
                  }
                  onPress={() => router.push(`/chat/${room.id}`)}
                />
              </View>
            </Card>
          ))
        )}
        {rooms.data?.length === 0 && <Muted>{emptyStates.noMessages.title}</Muted>}
      </View>

      <View style={{ gap: Spacing.two }}>
        <Eyebrow>Travelers</Eyebrow>
        <Card>
          {members.map((m, i) => {
            const name = m.profile?.display_name || "Traveler";
            return (
              <View
                key={m.user_id}
                style={[styles.member, i > 0 && { borderTopWidth: 1, borderTopColor: c.border }]}
              >
                <View style={[styles.avatar, { backgroundColor: c.accent }]}>
                  <Text style={{ fontFamily: "Manrope_700Bold", color: "#0B2025" }}>
                    {name.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <H2 style={{ fontSize: 16, lineHeight: 20 }}>
                    {name}
                    {m.user_id === user?.id ? " (you)" : ""}
                  </H2>
                  {m.profile?.show_home_country && m.profile.home_country ? (
                    <Muted style={{ fontSize: 13 }}>{m.profile.home_country}</Muted>
                  ) : null}
                  {m.profile?.show_bio && m.profile.bio ? (
                    <Muted style={{ fontSize: 13 }}>{m.profile.bio}</Muted>
                  ) : null}
                </View>
                {m.member_role === "staff" && <Pill>Guideless</Pill>}
              </View>
            );
          })}
        </Card>
        <Muted style={{ fontSize: 13 }}>
          Only what each traveler chose to share. Emails and phone numbers stay private.
        </Muted>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  member: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
