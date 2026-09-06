import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { formatDate } from "@guideless/utils";
import { ItineraryItemRow } from "@/components/itinerary-item";
import { SyncBadge } from "@/components/sync-badge";
import { EmptyState, Eyebrow, H1, H2, Loading, Muted, Screen } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { useTrip } from "@/hooks/use-trip";
import { currentDay } from "@/lib/trips/next-up";

/** The whole route, day by day. Free time is shown deliberately, not hidden (spec §20). */
export default function ItineraryScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { detail, isPending, offline, syncedAt } = useTrip(tripId ?? null);

  if (isPending && !detail) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  if (!detail) {
    return (
      <Screen>
        <EmptyState
          title="Route not available"
          body="You may not be on this trip, or it hasn't been activated yet."
        />
      </Screen>
    );
  }

  const today = currentDay(detail.days, new Date());

  return (
    <Screen>
      <Eyebrow>Your route</Eyebrow>
      <H1>{detail.trip.name}</H1>
      <Muted>
        {detail.days.length} days · {detail.destinations.map((d) => d.name).join(" → ")}
      </Muted>
      <SyncBadge offline={offline} syncedAt={syncedAt} />

      {detail.days.map((day) => (
        <View key={day.id} style={{ gap: Spacing.two, marginTop: Spacing.two }}>
          <View>
            <Eyebrow style={today?.id === day.id ? { color: "#17B1DF" } : undefined}>
              Day {day.day_number} ·{" "}
              {formatDate(day.date, "en-US", { weekday: "short", month: "short", day: "numeric" })}
              {day.destination ? ` · ${day.destination.name}` : ""}
              {today?.id === day.id ? " · Today" : ""}
            </Eyebrow>
            <H2>{day.title}</H2>
            {day.summary && <Muted>{day.summary}</Muted>}
          </View>
          {day.items.length === 0 ? (
            <Muted>Nothing scheduled. The day is yours.</Muted>
          ) : (
            day.items.map((item) => <ItineraryItemRow key={item.id} item={item} />)
          )}
        </View>
      ))}
    </Screen>
  );
}
