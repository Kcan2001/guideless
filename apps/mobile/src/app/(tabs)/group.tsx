import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Image, StyleSheet, Text, View } from "react-native";
import { emptyStates } from "@guideless/config";
import { formatDate, formatDateRange, formatWallTime } from "@guideless/utils";
import {
  Body,
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
import { MomentCard } from "@/components/moment-card";
import { Spacing } from "@/constants/theme";
import { useMoments } from "@/hooks/use-moments";
import { useTheme } from "@/hooks/use-theme";
import { useCurrentTrip } from "@/hooks/use-trip";
import { track } from "@/lib/analytics";
import { useSession } from "@/lib/auth/session";
import { chatService } from "@/lib/chat/service";
import { groupService, rosterLine, type ItemRsvpStatus } from "@/lib/group/service";
import { PARTY_LABEL, type PartyType } from "@/lib/profile/extras";

const ROOM_ICON: Record<string, ComponentProps<typeof Ionicons>["name"]> = {
  trip_group: "chatbubbles-outline",
  announcements: "megaphone-outline",
  optional_activities: "sparkles-outline",
};
const ROOM_HINT: Record<string, string> = {
  trip_group: "Everyone on your trip.",
  announcements: "Updates from Guideless. Read-only.",
  optional_activities: "Who's up for what.",
};
const STYLE_LABEL = { relaxed: "Relaxed pace", balanced: "Balanced", active: "Active" } as const;

export default function GroupScreen() {
  const c = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useSession();
  const { detail, trips } = useCurrentTrip();
  const tripId = detail?.trip.id ?? null;

  const rooms = useQuery({
    queryKey: ["rooms", tripId],
    enabled: !!tripId,
    queryFn: () => chatService.listRooms(tripId!),
    refetchInterval: 30_000,
  });

  const { moments, isPending: momentsPending, toggle } = useMoments(tripId, { realtime: true });

  // Before the trip exists: the booking's departure and its anonymized roster.
  const upcoming = useQuery({
    queryKey: ["upcoming-booking", user?.id],
    enabled: !!user && !tripId && !trips.isPending,
    queryFn: () => groupService.upcomingBooking(),
  });

  const anchor = detail?.days.flatMap((d) => d.items).find((i) => i.is_anchor) ?? null;
  const anchorDay = anchor ? detail?.days.find((d) => d.id === anchor.trip_day_id) : null;
  const rsvps = useQuery({
    queryKey: ["rsvps", anchor?.id, user?.id],
    enabled: !!anchor && !!user,
    queryFn: async () => ({
      counts: await groupService.rsvpCounts([anchor!.id]),
      mine: await groupService.myRsvps([anchor!.id], user!.id),
    }),
  });
  const rsvp = useMutation({
    mutationFn: (status: ItemRsvpStatus) => groupService.rsvp(anchor!.id, user!.id, status),
    onSuccess: (_, status) => {
      if (status === "going")
        track("live_moment_joined", { kind: "anchor_rsvp", item_id: anchor!.id });
      qc.invalidateQueries({ queryKey: ["rsvps", anchor?.id, user?.id] });
    },
  });

  if (!detail) {
    const up = upcoming.data;
    return (
      <Screen>
        <Eyebrow>Your group</Eyebrow>
        <H1>Group</H1>
        {upcoming.isPending || trips.isPending ? (
          <Loading />
        ) : up ? (
          <>
            <Card tone="accent">
              <Eyebrow>{up.tourName}</Eyebrow>
              <H2>
                {up.stats?.groupOpen
                  ? "Your group is opening"
                  : `Opens ${formatDate(up.stats?.groupOpensOn ?? up.startDate, "en-US", { month: "long", day: "numeric" })}`}
              </H2>
              <Body>
                {up.stats?.groupOpen
                  ? "Your route and chat are being prepared. Pull to refresh in a moment."
                  : "Chat, the roster and the welcome plan open together so nobody arrives to an empty room. Until then, here's who's coming."}
              </Body>
            </Card>
            {up.stats && (
              <Card>
                <Eyebrow>Who&rsquo;s coming</Eyebrow>
                <H2>{rosterLine(up.stats)}</H2>
                <Muted>
                  {formatDateRange(up.startDate, up.endDate)}
                  {up.stats.spotsLeft > 0 ? ` · ${up.stats.spotsLeft} spots left` : " · Full"}
                </Muted>
                <Muted style={{ fontSize: 13 }}>
                  Names and profiles appear when the group opens. Solo means booked alone; pairs are
                  two travelers on one booking.
                </Muted>
              </Card>
            )}
          </>
        ) : (
          <EmptyState
            icon="people-outline"
            title="No group yet"
            body="Your group appears once you have a confirmed booking."
          />
        )}
      </Screen>
    );
  }

  const members = detail.members.filter((m) => !m.removed_at);
  const anchorCounts = anchor ? rsvps.data?.counts.get(anchor.id) : null;
  const myRsvp = anchor ? rsvps.data?.mine.get(anchor.id) : undefined;

  return (
    <Screen>
      <Eyebrow>Your group</Eyebrow>
      <H1>{members.length} travelers</H1>
      <Muted>Social, but optional. Say hello — or don&rsquo;t.</Muted>

      {anchor && (
        <Card tone="accent">
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            <Pill tone="accent">Everyone&rsquo;s invited</Pill>
            {anchorDay && (
              <Pill>
                {formatDate(anchorDay.date, "en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </Pill>
            )}
          </View>
          <H2>{anchor.title}</H2>
          <Muted>
            {anchor.start_time ? formatWallTime(anchor.start_time) : "Time to follow"}
            {anchor.location_name ? ` · ${anchor.location_name}` : ""}
          </Muted>
          {anchor.description && <Muted style={{ fontSize: 14 }}>{anchor.description}</Muted>}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              marginTop: 4,
            }}
          >
            <Muted style={{ fontSize: 13 }}>
              {anchorCounts?.going ?? 0} going
              {anchorCounts?.maybe ? ` · ${anchorCounts.maybe} maybe` : ""}
            </Muted>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button
                title={myRsvp === "going" ? "I'll be there ✓" : "I'll be there"}
                variant={myRsvp === "going" ? "secondary" : "primary"}
                disabled={rsvp.isPending}
                onPress={() => rsvp.mutate(myRsvp === "going" ? "not_going" : "going")}
                style={{ minHeight: 40, paddingHorizontal: 14 }}
              />
              <Button
                title={myRsvp === "maybe" ? "Maybe ✓" : "Maybe"}
                variant="ghost"
                disabled={rsvp.isPending}
                onPress={() => rsvp.mutate(myRsvp === "maybe" ? "not_going" : "maybe")}
                style={{ minHeight: 40, paddingHorizontal: 10 }}
              />
            </View>
          </View>
        </Card>
      )}

      <View style={{ gap: Spacing.two }}>
        <View
          style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
        >
          <Eyebrow style={{ flexShrink: 1 }}>Live Moments</Eyebrow>
          <Button
            title="Suggest one"
            variant="ghost"
            icon="add-circle-outline"
            onPress={() => router.push("/moments/new")}
          />
        </View>
        {momentsPending ? (
          <Loading />
        ) : moments.length === 0 ? (
          <Card>
            <H2 style={{ fontSize: 16 }}>Nothing planned right now.</H2>
            <Muted>Coffee at ten? A sunset walk? Suggest a moment and see who&rsquo;s in.</Muted>
          </Card>
        ) : (
          moments.map((m) => (
            <MomentCard
              key={m.id}
              moment={m}
              disabled={toggle.isPending}
              onToggle={(going) => toggle.mutate({ momentId: m.id, going })}
            />
          ))
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
            const p = m.profile;
            const interests = p?.show_interests && p.interests?.length ? p.interests : [];
            // "Traveling from" has its own visibility switch; home country is the fallback.
            const where =
              p?.show_traveling_from && p.traveling_from
                ? p.traveling_from
                : p?.show_home_country && p.home_country
                  ? p.home_country
                  : null;
            const excited = p?.excited_about?.trim() || null;
            const party = (p?.party_type ?? null) as PartyType | null;
            return (
              <View
                key={m.user_id}
                style={[styles.member, i > 0 && { borderTopWidth: 1, borderTopColor: c.border }]}
              >
                {p?.avatar_url ? (
                  <Image
                    source={{ uri: p.avatar_url }}
                    style={styles.avatar}
                    accessibilityIgnoresInvertColors
                    accessible
                    accessibilityLabel={`${name}'s photo`}
                  />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: c.accent }]}>
                    <Text style={{ fontFamily: "Manrope_700Bold", color: "#0B2025" }}>
                      {name.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1, gap: 2 }}>
                  <H2 style={{ fontSize: 16, lineHeight: 20 }}>
                    {name}
                    {m.user_id === user?.id ? " (you)" : ""}
                  </H2>
                  {where ? <Muted style={{ fontSize: 13 }}>{where}</Muted> : null}
                  {p?.show_bio && p.bio ? <Muted style={{ fontSize: 13 }}>{p.bio}</Muted> : null}
                  {excited ? (
                    <Muted style={{ fontSize: 13, fontStyle: "italic" }}>
                      Excited about {excited}
                    </Muted>
                  ) : null}
                  {(interests.length > 0 || party || (p?.show_interests && p.travel_style)) && (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
                      {party ? <Pill>{PARTY_LABEL[party]}</Pill> : null}
                      {p?.show_interests && p.travel_style ? (
                        <Pill>
                          {STYLE_LABEL[p.travel_style as keyof typeof STYLE_LABEL] ??
                            p.travel_style}
                        </Pill>
                      ) : null}
                      {interests.slice(0, 5).map((it) => (
                        <Pill key={it}>{it.replace(/_/g, " ")}</Pill>
                      ))}
                    </View>
                  )}
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
