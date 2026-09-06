import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { emptyStates } from "@guideless/config";
import { formatInZone } from "@guideless/utils";
import {
  Button,
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
import { track } from "@/lib/analytics";
import { useSession } from "@/lib/auth/session";
import { chatService } from "@/lib/chat/service";
import { momentsService } from "@/lib/moments/service";
import { supabase } from "@/lib/supabase";

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
  const qc = useQueryClient();
  const { user } = useSession();
  const { detail } = useCurrentTrip();
  const tripId = detail?.trip.id ?? null;

  const rooms = useQuery({
    queryKey: ["rooms", tripId],
    enabled: !!tripId,
    queryFn: () => chatService.listRooms(tripId!),
    refetchInterval: 30_000,
  });

  const moments = useQuery({
    queryKey: ["moments", tripId],
    enabled: !!tripId && !!user,
    queryFn: () => momentsService.list(tripId!, user!.id),
  });

  useEffect(() => {
    if (!tripId) return;
    const channel = momentsService.subscribe(tripId, () =>
      qc.invalidateQueries({ queryKey: ["moments", tripId] }),
    );
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tripId, qc]);

  const toggle = useMutation({
    mutationFn: async ({ momentId, going }: { momentId: string; going: boolean }) => {
      if (going) {
        await momentsService.join(momentId, user!.id);
        track("live_moment_joined", { moment_id: momentId });
      } else {
        await momentsService.leave(momentId, user!.id);
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["moments", tripId] }),
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
        <View
          style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
        >
          <Eyebrow>Live Moments</Eyebrow>
          <Button
            title="Suggest one"
            variant="ghost"
            icon="add-circle-outline"
            onPress={() => router.push("/moments/new")}
          />
        </View>
        {moments.isPending ? (
          <Loading />
        ) : (moments.data ?? []).length === 0 ? (
          <Card>
            <H2 style={{ fontSize: 16 }}>Nothing planned right now.</H2>
            <Muted>Coffee at ten? A sunset walk? Suggest a moment and see who&rsquo;s in.</Muted>
          </Card>
        ) : (
          (moments.data ?? []).map((m) => {
            const going = m.mine === "joined";
            const full = m.capacity != null && m.joined >= m.capacity && !going;
            return (
              <Card key={m.id} tone={m.status === "live" ? "accent" : "default"}>
                <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                  {m.is_official ? (
                    <Pill tone="accent">Guideless</Pill>
                  ) : (
                    <Pill>Traveler suggested</Pill>
                  )}
                  {m.status === "live" && <Pill tone="warning">Happening now</Pill>}
                </View>
                <H2>{m.title}</H2>
                <Muted>
                  {formatInZone(m.start_at, m.timezone)}
                  {m.location_name ? ` · ${m.location_name}` : ""}
                </Muted>
                {m.description && <Muted style={{ fontSize: 14 }}>{m.description}</Muted>}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginTop: 4,
                  }}
                >
                  <Muted style={{ fontSize: 13 }}>
                    {m.joined} going{m.capacity ? ` · ${m.capacity} max` : ""}
                  </Muted>
                  <Button
                    title={going ? "I'm going ✓" : full ? "Full" : "Join"}
                    variant={going ? "secondary" : "primary"}
                    disabled={full || toggle.isPending}
                    onPress={() => toggle.mutate({ momentId: m.id, going: !going })}
                    style={{ minHeight: 40, paddingHorizontal: 16 }}
                  />
                </View>
              </Card>
            );
          })
        )}
      </View>

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
