import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Body, Button, Card, Eyebrow, H1, Loading, Muted } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { track } from "@/lib/analytics";
import {
  fetchNearby,
  locationService,
  positionErrorMessage,
  type NearbyPlace,
  type Position,
} from "@/lib/location/service";

/**
 * What is good near me, right now.
 *
 * The screen's one editorial rule: never blur the line between something a person at Guideless
 * chose and something a search API returned. Our picks are labelled and carry the sentence somebody
 * wrote; live results are labelled as a live search. A traveler who follows a bad suggestion should
 * be able to tell instantly whose fault it was.
 *
 * Nothing here is stored. The position is asked for when the screen opens, used for one request,
 * and forgotten. Sharing with the group is a separate opt-in on the map.
 */
export default function NearbyScreen() {
  const c = useTheme();
  const router = useRouter();
  const [position, setPosition] = useState<Position | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await locationService.current();
      if (cancelled) return;
      if (result.ok) setPosition(result.position);
      else setError(positionErrorMessage(result.reason));
      setLocating(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const nearby = useQuery({
    queryKey: ["nearby", position?.latitude, position?.longitude],
    queryFn: () => fetchNearby(position!),
    enabled: Boolean(position),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (nearby.data) track("nearby_viewed", { results: nearby.data.places.length });
  }, [nearby.data]);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: c.background }}
      edges={["top", "left", "right"]}
    >
      <ScrollView contentContainerStyle={{ padding: Spacing.three, gap: Spacing.three }}>
        <Eyebrow>Around you</Eyebrow>
        <H1>Near me</H1>

        {locating && <Loading />}

        {error && (
          <Card>
            <Body>{error}</Body>
            <Button title="Back" variant="secondary" onPress={() => router.back()} />
          </Card>
        )}

        {position && nearby.isPending && <Loading />}

        {nearby.data?.liveUnavailable && nearby.data.places.length > 0 && (
          <Muted>
            A live check wasn&rsquo;t possible just now, so this is what we recommend rather than
            what&rsquo;s open.
          </Muted>
        )}

        {nearby.data?.places.length === 0 && !nearby.isPending && (
          <Card>
            <Body>Nothing of ours within a short walk of here.</Body>
            <Muted>
              Try the Explore tab for everything we recommend in this destination, or ask the
              assistant.
            </Muted>
          </Card>
        )}

        {nearby.data?.places.map((place) => (
          <PlaceRow key={place.id} place={place} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function PlaceRow({ place }: { place: NearbyPlace }) {
  const c = useTheme();
  const walk =
    place.distanceMeters !== null ? Math.max(1, Math.round(place.distanceMeters / 80)) : null;

  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.two }}>
        <Text style={{ color: c.text, fontFamily: "Inter_600SemiBold", fontSize: 16, flex: 1 }}>
          {place.name}
        </Text>
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 999,
            backgroundColor: place.source === "curated" ? c.backgroundSelected : "transparent",
            borderWidth: place.source === "curated" ? 0 : 1,
            borderColor: c.border,
          }}
        >
          <Text
            style={{ color: place.source === "curated" ? c.text : c.textSecondary, fontSize: 11 }}
          >
            {place.source === "curated" ? "Our pick" : "Live search"}
          </Text>
        </View>
      </View>

      <Muted>
        {[
          walk !== null ? `${walk} min walk` : null,
          // Unknown hours must read as unknown. "Closed" for a place we simply have no data on
          // would send somebody somewhere else for no reason.
          place.openNow === true ? "open now" : place.openNow === false ? "closed now" : null,
          place.priceLevel ? "€".repeat(place.priceLevel) : null,
          place.rating !== null ? `${place.rating}/5` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </Muted>

      {place.description && <Body>{place.description}</Body>}

      {place.matchedTaste.length > 0 && (
        <Muted>Because you like {place.matchedTaste.slice(0, 2).join(" and ")}.</Muted>
      )}

      <Pressable
        onPress={() => {
          track("map_opened", { source: "nearby" });
          Linking.openURL(
            place.mapsUrl ??
              `https://maps.google.com/?q=${encodeURIComponent(`${place.name} ${place.address ?? ""}`)}`,
          );
        }}
        accessibilityRole="link"
        style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
      >
        <Ionicons name="navigate-outline" size={16} color={c.link} />
        <Text style={{ color: c.link, fontFamily: "Inter_500Medium" }}>Directions</Text>
      </Pressable>
    </Card>
  );
}
