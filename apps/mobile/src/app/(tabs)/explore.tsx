import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { emptyStates } from "@guideless/config";
import { AddOnCard } from "@/components/add-on-card";
import { Card, EmptyState, Eyebrow, H1, H2, Loading, Muted, Pill, Screen } from "@/components/ui";
import { Radius, Spacing } from "@/constants/theme";
import { useTripAddOns } from "@/hooks/use-add-ons";
import { useTheme } from "@/hooks/use-theme";
import { useCurrentTrip } from "@/hooks/use-trip";
import { track } from "@/lib/analytics";
import { exploreService } from "@/lib/explore/service";
import { currentDay } from "@/lib/trips/next-up";

/**
 * What you can add, and where to go: bookable add-ons for the trip first, then curated
 * destination recommendations for the stop you are on (spec §21). Curated, not generated.
 */
export default function ExploreScreen() {
  const c = useTheme();
  const { detail } = useCurrentTrip();
  const { addOns, bookingId } = useTripAddOns(detail);
  const now = new Date();
  const todayISO = now.toISOString().slice(0, 10);
  const day = detail ? currentDay(detail.days, now) : null;
  const destinations = detail?.destinations ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  const destinationId = selected ?? day?.destination?.id ?? destinations[0]?.id ?? null;
  const destination = destinations.find((d) => d.id === destinationId) ?? null;
  // Still buyable, soonest first; anything already bought or closed stays on the itinerary.
  const openAddOns = addOns
    .filter((a) => !a.mine && todayISO <= a.bookableUntil)
    .sort((a, b) => a.date.localeCompare(b.date));

  const recs = useQuery({
    queryKey: ["recommendations", destinationId],
    enabled: !!destinationId,
    queryFn: () => exploreService.listForDestination(destinationId!),
  });

  return (
    <Screen>
      <Eyebrow>Explore</Eyebrow>
      <H1>{destination?.name ?? "Your destinations"}</H1>
      {destinations.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {destinations.map((d) => (
            <Pressable
              key={d.id}
              onPress={() => setSelected(d.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: d.id === destinationId }}
              style={[
                styles.chip,
                {
                  backgroundColor: d.id === destinationId ? c.primary : c.backgroundElement,
                  borderColor: c.border,
                },
              ]}
            >
              <Text
                style={{
                  color: d.id === destinationId ? c.primaryText : c.text,
                  fontFamily: "Inter_500Medium",
                }}
              >
                {d.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {detail && openAddOns.length > 0 && (
        <View style={{ gap: Spacing.two }}>
          <Eyebrow>Add to your trip</Eyebrow>
          <Muted style={{ fontSize: 13 }}>
            Optional, priced per person unless noted, and yours to skip.
          </Muted>
          {openAddOns.map((a) => (
            <AddOnCard
              key={a.id}
              addOn={a}
              bookingId={bookingId}
              todayISO={todayISO}
              tripId={detail.trip.id}
            />
          ))}
        </View>
      )}

      {detail && <Eyebrow>Where to go</Eyebrow>}

      {!detail ? (
        <EmptyState
          title="No trip yet"
          body="Recommendations appear once your trip is activated."
        />
      ) : recs.isPending ? (
        <Loading />
      ) : (recs.data ?? []).length === 0 ? (
        <EmptyState
          icon="star-outline"
          title={emptyStates.noRecommendations.title}
          body={emptyStates.noRecommendations.body}
        />
      ) : (
        <View style={{ gap: Spacing.two }}>
          {(recs.data ?? []).map((r) => (
            <Card key={r.id}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {r.categories.map((cat) => (
                  <Pill key={cat} tone="accent">
                    {cat.replace("_", " ")}
                  </Pill>
                ))}
                {r.price_level && <Pill>{"€".repeat(r.price_level)}</Pill>}
              </View>
              <H2>{r.title}</H2>
              {r.description && <Muted>{r.description}</Muted>}
              {r.neighborhood && <Muted style={{ fontSize: 13 }}>{r.neighborhood}</Muted>}
              {(r.maps_url || r.address) && (
                <Pressable
                  accessibilityRole="link"
                  onPress={() => {
                    track("recommendation_opened", {
                      recommendation_id: r.id,
                      category: r.categories[0],
                    });
                    Linking.openURL(
                      r.maps_url ??
                        `https://maps.google.com/?q=${encodeURIComponent(`${r.title} ${r.address ?? ""}`)}`,
                    );
                  }}
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Ionicons name="navigate-outline" size={16} color={c.link} />
                  <Text style={{ color: c.link, fontFamily: "Inter_500Medium" }}>Directions</Text>
                </Pressable>
              )}
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chip: { borderRadius: Radius.xl, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
});
