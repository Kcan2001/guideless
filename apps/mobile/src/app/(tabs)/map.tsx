import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import MapView, { Callout, Marker } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatDate } from "@guideless/utils";
import { EmptyState, Eyebrow, H1, Muted } from "@/components/ui";
import { Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useTripAddOns } from "@/hooks/use-add-ons";
import { useCurrentTrip } from "@/hooks/use-trip";
import { track } from "@/lib/analytics";
import { useSession } from "@/lib/auth/session";
import { exploreService } from "@/lib/explore/service";
import {
  MARKER_COLOR,
  buildMarkers,
  directionsUrl,
  filterMarkers,
  regionFor,
  type MapMarker,
} from "@/lib/map/markers";
import { momentsService } from "@/lib/moments/service";
import { currentDay } from "@/lib/trips/next-up";

/** Where everything is: hotels, your route, the group's moments, recommendations, add-ons. */
export default function MapScreen() {
  const c = useTheme();
  const router = useRouter();
  const { user } = useSession();
  const { detail } = useCurrentTrip();
  const { addOns } = useTripAddOns(detail);
  const mapRef = useRef<MapView>(null);
  const today = detail ? currentDay(detail.days, new Date()) : null;
  const [dayFilter, setDayFilter] = useState<"all" | string>(() => today?.date ?? "all");

  const destinationId = today?.destination?.id ?? detail?.destinations[0]?.id ?? null;
  const recommendations = useQuery({
    queryKey: ["recommendations", destinationId],
    enabled: !!destinationId,
    queryFn: () => exploreService.listForDestination(destinationId!),
  });
  const moments = useQuery({
    queryKey: ["moments", detail?.trip.id],
    enabled: !!detail && !!user,
    queryFn: () => momentsService.list(detail!.trip.id, user!.id),
  });

  const markers = useMemo(
    () =>
      detail
        ? buildMarkers({
            days: detail.days,
            accommodations: detail.accommodations,
            recommendations: recommendations.data ?? [],
            moments: moments.data ?? [],
            addOns,
            tripStartDate: detail.trip.start_date,
          })
        : [],
    [detail, recommendations.data, moments.data, addOns],
  );
  const visible = useMemo(() => filterMarkers(markers, dayFilter), [markers, dayFilter]);
  const destination = today?.destination ?? detail?.destinations[0] ?? null;
  const region = useMemo(
    () =>
      regionFor(
        visible,
        destination?.latitude != null && destination?.longitude != null
          ? { latitude: destination.latitude, longitude: destination.longitude }
          : undefined,
      ),
    [visible, destination],
  );

  useEffect(() => {
    if (visible.length > 1) {
      mapRef.current?.fitToCoordinates(
        visible.map((m) => ({ latitude: m.latitude, longitude: m.longitude })),
        { edgePadding: { top: 80, right: 60, bottom: 120, left: 60 }, animated: true },
      );
    } else if (region) {
      mapRef.current?.animateToRegion(region, 400);
    }
  }, [visible, region]);

  if (!detail) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={["top"]}>
        <View style={{ padding: Spacing.three, gap: Spacing.three }}>
          <Eyebrow>Map</Eyebrow>
          <H1>Your places</H1>
          <EmptyState
            icon="map-outline"
            title="No trip on the map yet"
            body="Hotels, your route and the group's moments appear here once your trip is open."
          />
        </View>
      </SafeAreaView>
    );
  }

  const open = (m: MapMarker) => {
    track("map_opened", { source: "map_tab", kind: m.kind });
    Linking.openURL(directionsUrl(m));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={["top"]}>
      <View style={{ paddingHorizontal: Spacing.three, paddingTop: Spacing.two, gap: 4 }}>
        <Eyebrow>Map</Eyebrow>
        <H1>{destination?.name ?? detail.trip.name}</H1>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          gap: 8,
          paddingHorizontal: Spacing.three,
          paddingVertical: Spacing.two,
        }}
        style={{ flexGrow: 0 }}
      >
        <Chip label="All days" active={dayFilter === "all"} onPress={() => setDayFilter("all")} />
        {detail.days.map((d) => (
          <Chip
            key={d.id}
            label={
              today?.id === d.id
                ? "Today"
                : formatDate(d.date, "en-US", { weekday: "short", day: "numeric" })
            }
            active={dayFilter === d.date}
            onPress={() => setDayFilter(d.date)}
          />
        ))}
      </ScrollView>

      {region ? (
        <View style={{ flex: 1 }}>
          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            initialRegion={region}
            showsUserLocation
            showsMyLocationButton
            accessibilityLabel="Map of your trip"
          >
            {visible.map((m) => (
              <Marker
                key={m.id}
                coordinate={{ latitude: m.latitude, longitude: m.longitude }}
                pinColor={MARKER_COLOR[m.kind]}
                title={m.title}
                description={m.subtitle ?? undefined}
              >
                <Callout onPress={() => open(m)} tooltip={false}>
                  <View style={{ maxWidth: 240, gap: 2, padding: 4 }}>
                    <Text
                      style={{ fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#0B2025" }}
                    >
                      {m.title}
                    </Text>
                    {m.subtitle ? (
                      <Text
                        style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#4D575B" }}
                      >
                        {m.subtitle}
                      </Text>
                    ) : null}
                    <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: "#0B6680" }}>
                      Directions ›
                    </Text>
                  </View>
                </Callout>
              </Marker>
            ))}
          </MapView>
          <View
            style={[styles.legend, { backgroundColor: c.backgroundElement, borderColor: c.border }]}
          >
            {(["hotel", "anchor", "item", "moment", "add_on", "recommendation"] as const).map(
              (k) => (
                <View key={k} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: MARKER_COLOR[k],
                    }}
                  />
                  <Text
                    style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: c.textSecondary }}
                  >
                    {LEGEND[k]}
                  </Text>
                </View>
              ),
            )}
          </View>
          {visible.length === 0 && (
            <View
              style={[
                styles.notice,
                { backgroundColor: c.backgroundElement, borderColor: c.border },
              ]}
            >
              <Ionicons name="information-circle-outline" size={16} color={c.textSecondary} />
              <Muted style={{ fontSize: 13, flex: 1 }}>
                Nothing on the map for this day yet. Places appear as the route gets pinned.
              </Muted>
            </View>
          )}
        </View>
      ) : (
        <View style={{ padding: Spacing.three }}>
          <EmptyState
            icon="map-outline"
            title="No places pinned yet"
            body="Your hotels and stops will show here once they have coordinates."
          />
        </View>
      )}
      <Pressable
        onPress={() => router.push("/explore")}
        accessibilityRole="button"
        style={[styles.exploreLink, { borderColor: c.border, backgroundColor: c.background }]}
      >
        <Ionicons name="compass-outline" size={18} color={c.accent} />
        <Text style={{ fontFamily: "Inter_600SemiBold", color: c.text }}>
          Recommendations nearby
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}

const LEGEND = {
  hotel: "Hotel",
  anchor: "Welcome",
  item: "Route",
  moment: "Moments",
  add_on: "Add-ons",
  recommendation: "Explore",
} as const;

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[
        styles.chip,
        {
          backgroundColor: active ? c.primary : c.backgroundElement,
          borderColor: active ? c.primary : c.border,
        },
      ]}
    >
      <Text
        style={{
          fontFamily: "Inter_600SemiBold",
          fontSize: 13,
          color: active ? c.primaryText : c.text,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    minHeight: 36,
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
  },
  legend: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    padding: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  notice: {
    position: "absolute",
    bottom: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    padding: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  exploreLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    borderTopWidth: 1,
  },
});
