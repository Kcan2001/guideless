import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { brand, emptyStates } from "@guideless/config";
import { formatDate, formatDateRange, formatWallTime } from "@guideless/utils";
import { AddOnCard } from "@/components/add-on-card";
import { ItineraryItemRow, timeLabel } from "@/components/itinerary-item";
import { SyncBadge } from "@/components/sync-badge";
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
} from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { useInbox } from "@/hooks/use-inbox";
import { useTheme } from "@/hooks/use-theme";
import { useTripAddOns } from "@/hooks/use-add-ons";
import { useCurrentTrip } from "@/hooks/use-trip";
import { track } from "@/lib/analytics";
import {
  currentDay,
  greeting,
  localClock,
  minutesUntil,
  nextUp,
  tripPhase,
} from "@/lib/trips/next-up";

/** The screen that answers: where am I, what's next, what are my options? (spec §23) */
export default function TripHomeScreen() {
  const c = useTheme();
  const router = useRouter();
  const { trips, current, detail, offline, syncedAt, isPending, refetch } = useCurrentTrip();
  const inbox = useInbox();
  const { addOns, bookingId } = useTripAddOns(detail);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const openedTripId = detail?.trip.id;
  const openedTripStatus = detail?.trip.status;
  useEffect(() => {
    if (openedTripId) track("trip_opened", { trip_id: openedTripId, status: openedTripStatus });
  }, [openedTripId, openedTripStatus]);

  if (trips.isPending || (current && isPending && !detail)) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
        <Loading />
      </SafeAreaView>
    );
  }

  if (!current || !detail) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
        <View style={{ padding: Spacing.three, gap: Spacing.three }}>
          <HeaderActions unread={inbox.unread} />
          <H1>{brand.taglineSecondary}</H1>
          <EmptyState
            title={emptyStates.noTrips.title}
            body="Once you book a trip and your departure is activated, your route lives here — hotels, trains, what's next and your group."
            action={
              <Button
                title={emptyStates.noTrips.cta}
                variant="secondary"
                onPress={() => Linking.openURL("https://guidelesstours.com/tours")}
              />
            }
          />
        </View>
      </SafeAreaView>
    );
  }

  const { trip, days, accommodations, members } = detail;
  const todayISO = now.toISOString().slice(0, 10);
  const phase = tripPhase(trip, todayISO);
  const day = currentDay(days, now);
  const tz = day?.timezone ?? trip.timezone;
  const clock = localClock(now, tz);
  const {
    current: happening,
    next,
    optionalLater,
  } = day ? nextUp(day.items, clock) : { current: null, next: null, optionalLater: [] };
  const hotel = day
    ? (accommodations.find((a) => a.check_in_date <= day.date && a.check_out_date > day.date) ??
      null)
    : (accommodations[0] ?? null);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: c.background }}
      edges={["top", "left", "right"]}
    >
      <ScrollView
        contentContainerStyle={{
          padding: Spacing.three,
          paddingBottom: Spacing.six,
          gap: Spacing.three,
        }}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={() => refetch()} tintColor={c.accent} />
        }
      >
        <HeaderActions unread={inbox.unread} />
        <View style={{ gap: 4 }}>
          <Eyebrow>
            {phase === "during"
              ? greeting(clock)
              : phase === "before"
                ? "Coming up"
                : "Trip complete"}
          </Eyebrow>
          <H1>{day?.destination?.name ?? trip.name}</H1>
          <Muted>
            {day
              ? `${formatDate(day.date, "en-US", { weekday: "long", month: "long", day: "numeric" })} · Day ${day.day_number} of ${days.length}`
              : formatDateRange(trip.start_date, trip.end_date)}
          </Muted>
          <SyncBadge offline={offline} syncedAt={syncedAt} />
        </View>

        {phase === "before" && (
          <Card tone="accent">
            <Eyebrow>{trip.name}</Eyebrow>
            <H2>{formatDateRange(trip.start_date, trip.end_date)}</H2>
            <Body>
              Your route is ready. We&rsquo;ll send arrival instructions closer to the day — nothing
              to do now.
            </Body>
          </Card>
        )}

        {hotel && (
          <Card>
            <Eyebrow>Your hotel</Eyebrow>
            <H2>{hotel.name}</H2>
            {hotel.address && <Muted>{hotel.address}</Muted>}
            <Muted>
              Check-out {formatDate(hotel.check_out_date, "en-US", { weekday: "long" })}
              {hotel.check_out_time ? ` by ${formatWallTime(hotel.check_out_time)}` : ""}
            </Muted>
            {hotel.address && (
              <Pressable
                onPress={() => {
                  track("map_opened", { source: "accommodation" });
                  Linking.openURL(
                    `https://maps.google.com/?q=${encodeURIComponent(`${hotel.name}, ${hotel.address}`)}`,
                  );
                }}
                style={styles.inlineLink}
                accessibilityRole="link"
              >
                <Ionicons name="navigate-outline" size={16} color={c.link} />
                <Text style={{ color: c.link, fontFamily: "Inter_500Medium" }}>Open in Maps</Text>
              </Pressable>
            )}
          </Card>
        )}

        {happening && (
          <View style={{ gap: Spacing.one }}>
            <Eyebrow>Now</Eyebrow>
            <ItineraryItemRow item={happening} highlight />
          </View>
        )}

        {next && (
          <View style={{ gap: Spacing.one }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Eyebrow>Next</Eyebrow>
              {next.start_time && phase === "during" && (
                <Pill tone={minutesUntil(next.start_time, clock) <= 60 ? "warning" : "neutral"}>
                  in{" "}
                  {minutesUntil(next.start_time, clock) >= 60
                    ? `${Math.round(minutesUntil(next.start_time, clock) / 60)} h`
                    : `${minutesUntil(next.start_time, clock)} min`}
                </Pill>
              )}
            </View>
            <ItineraryItemRow item={next} highlight={!happening} />
          </View>
        )}

        {!happening && !next && day && day.items.length > 0 && (
          <Card tone="accent">
            <Eyebrow>Free time</Eyebrow>
            <Body>
              Nothing else is scheduled today.{" "}
              {day.destination ? `${day.destination.name} is yours.` : "The day is yours."}
            </Body>
          </Card>
        )}

        {day && addOns.some((a) => a.date === day.date) && (
          <View style={{ gap: Spacing.one }}>
            <Eyebrow>Add-ons today · optional</Eyebrow>
            {addOns
              .filter((a) => a.date === day.date)
              .map((a) => (
                <AddOnCard key={a.id} addOn={a} bookingId={bookingId} todayISO={todayISO} />
              ))}
          </View>
        )}

        {optionalLater.length > 0 && (
          <View style={{ gap: Spacing.one }}>
            <Eyebrow>Later today · optional</Eyebrow>
            {optionalLater.map((i) => (
              <Card key={i.id}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 16, color: c.text }}>
                  {i.title}
                </Text>
                <Muted>
                  {timeLabel(i)}
                  {i.location_name ? ` · ${i.location_name}` : ""}
                </Muted>
              </Card>
            ))}
          </View>
        )}

        <Card>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
          >
            <View>
              <Eyebrow>Your group</Eyebrow>
              <H2>
                {members.length} {members.length === 1 ? "traveler" : "travelers"}
              </H2>
            </View>
            <Button
              title="Open chat"
              variant="secondary"
              icon="chatbubbles-outline"
              onPress={() => router.push("/group")}
            />
          </View>
        </Card>

        <Link href="/documents" asChild>
          <Pressable
            style={({ pressed }) => [
              styles.routeLink,
              { borderColor: c.border, opacity: pressed ? 0.7 : 1 },
            ]}
            accessibilityRole="link"
          >
            <Ionicons name="document-text-outline" size={20} color={c.accent} />
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 16, color: c.text, flex: 1 }}>
              Documents · tickets, vouchers, confirmations
            </Text>
            <Ionicons name="chevron-forward" size={18} color={c.textSecondary} />
          </Pressable>
        </Link>

        <Link href={`/itinerary/${trip.id}`} asChild>
          <Pressable
            style={({ pressed }) => [
              styles.routeLink,
              { borderColor: c.border, opacity: pressed ? 0.7 : 1 },
            ]}
            accessibilityRole="link"
          >
            <Ionicons name="git-branch-outline" size={20} color={c.accent} />
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 16, color: c.text, flex: 1 }}>
              Your full route · {days.length} days
            </Text>
            <Ionicons name="chevron-forward" size={18} color={c.textSecondary} />
          </Pressable>
        </Link>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Inbox bell with unread count and the profile entry; the tab bar stays five wide. */
function HeaderActions({ unread }: { unread: number }) {
  const c = useTheme();
  const router = useRouter();
  return (
    <View style={styles.headerActions}>
      <Pressable
        onPress={() => router.push("/notifications")}
        accessibilityRole="button"
        accessibilityLabel={unread > 0 ? `Inbox, ${unread} unread` : "Inbox"}
        style={[styles.iconButton, { borderColor: c.border, backgroundColor: c.backgroundElement }]}
      >
        <Ionicons name="notifications-outline" size={20} color={c.text} />
        {unread > 0 && (
          <View style={[styles.badge, { backgroundColor: c.accent }]}>
            <Text style={styles.badgeText}>{unread > 9 ? "9+" : unread}</Text>
          </View>
        )}
      </Pressable>
      <Pressable
        onPress={() => router.push("/profile")}
        accessibilityRole="button"
        accessibilityLabel="Profile"
        style={[styles.iconButton, { borderColor: c.border, backgroundColor: c.backgroundElement }]}
      >
        <Ionicons name="person-circle-outline" size={20} color={c.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  inlineLink: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  headerActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#0B2025" },
  routeLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
});
