import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Body, Button, Card, Eyebrow, H2, Muted } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { positionErrorMessage } from "@/lib/location/service";
import type { useLocationSharing } from "@/hooks/use-location-sharing";

/**
 * Turning location sharing on and off.
 *
 * Three things this screen has to get right, all of them about trust rather than pixels:
 *
 * 1. Nobody shares by accident. It is off, it says what it does before you tap, and turning it on
 *    is a choice of duration rather than a switch with no end.
 * 2. Stopping is one tap, always visible, and never behind a confirmation. A person who wants to
 *    stop being visible should not have to answer a question first.
 * 3. It says when it will stop by itself, because "until I remember" is not a duration.
 */

const DURATIONS = [
  { hours: 2, label: "2 hours" },
  { hours: 6, label: "6 hours" },
  { hours: 12, label: "Rest of the day" },
] as const;

export function LocationSharing({
  sharing,
  count,
}: {
  sharing: ReturnType<typeof useLocationSharing>;
  /** How many other people are visible right now — the reason to bother turning it on. */
  count: number;
}) {
  const c = useTheme();
  const [expanded, setExpanded] = useState(false);

  const until = sharing.sharingUntil ? new Date(sharing.sharingUntil) : null;
  const untilLabel = until
    ? until.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  if (sharing.sharing) {
    return (
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.two }}>
          <Ionicons name="radio-outline" size={18} color={c.accent} />
          <Text style={{ color: c.text, fontFamily: "Inter_500Medium", flex: 1 }}>
            Your group can see you until {untilLabel}
          </Text>
        </View>
        <Muted>
          {count === 0
            ? "Nobody else is sharing right now."
            : count === 1
              ? "One other person is sharing."
              : `${count} others are sharing.`}
        </Muted>
        <Button
          title={sharing.stop.isPending ? "Stopping…" : "Stop sharing"}
          variant="secondary"
          loading={sharing.stop.isPending}
          onPress={() => sharing.stop.mutate()}
        />
      </Card>
    );
  }

  if (!expanded) {
    return (
      <Pressable
        onPress={() => setExpanded(true)}
        accessibilityRole="button"
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: Spacing.two,
          paddingHorizontal: Spacing.three,
          paddingVertical: Spacing.two,
        }}
      >
        <Ionicons name="people-outline" size={18} color={c.link} />
        <Text style={{ color: c.link, fontFamily: "Inter_500Medium" }}>
          {count > 0 ? `Share your location (${count} sharing)` : "Share your location"}
        </Text>
      </Pressable>
    );
  }

  return (
    <Card>
      <Eyebrow>Sharing</Eyebrow>
      <H2>Let the group see where you are</H2>
      <Body>
        Useful for finding each other. Only people on this trip can see it, only while you have it
        on, and it stops by itself at the time you pick.
      </Body>
      <Muted>
        We never share your location when the app is closed, and stopping deletes it rather than
        hiding it.
      </Muted>

      <View style={{ flexDirection: "row", gap: Spacing.two, marginTop: Spacing.two }}>
        {DURATIONS.map((d) => (
          <Pressable
            key={d.hours}
            onPress={() =>
              sharing.start.mutate(d.hours, {
                onError: (err: Error) => {
                  const reason = err.message as "denied" | "disabled" | "unavailable";
                  Alert.alert("Not sharing", positionErrorMessage(reason));
                },
                onSuccess: () => setExpanded(false),
              })
            }
            disabled={sharing.start.isPending}
            accessibilityRole="button"
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: c.border,
              alignItems: "center",
              opacity: sharing.start.isPending ? 0.6 : 1,
            }}
          >
            <Text style={{ color: c.text, fontSize: 13 }}>{d.label}</Text>
          </Pressable>
        ))}
      </View>

      <Button title="Not now" variant="secondary" onPress={() => setExpanded(false)} />
    </Card>
  );
}
