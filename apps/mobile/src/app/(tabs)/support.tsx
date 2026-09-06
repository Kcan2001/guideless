import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { brand, emptyStates } from "@guideless/config";
import { formatDate } from "@guideless/utils";
import { Button, Card, Eyebrow, H1, H2, Loading, Muted, Pill, Row, Screen } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { useCurrentTrip } from "@/hooks/use-trip";
import { SUPPORT_CATEGORY_LABELS, supportService } from "@/lib/support/service";
import { currentDay } from "@/lib/trips/next-up";

const EMERGENCY_LABELS: Record<string, string> = {
  general: "Emergency",
  police: "Police",
  ambulance: "Ambulance",
  fire: "Fire",
};

/** Support + emergency (spec §29–30). Guideless is not an emergency service; local numbers first. */
export default function SupportScreen() {
  const router = useRouter();
  const { detail } = useCurrentTrip();
  const day = detail ? currentDay(detail.days, new Date()) : null;
  const destination = day?.destination ?? detail?.destinations[0] ?? null;
  const emergency = Object.entries(
    (destination?.emergency_numbers ?? {}) as Record<string, string>,
  );

  const threads = useQuery({
    queryKey: ["support-threads"],
    queryFn: supportService.listThreads,
    refetchInterval: 30_000,
  });

  return (
    <Screen>
      <Eyebrow>Support</Eyebrow>
      <H1>{emptyStates.noSupport.title}</H1>
      <Muted>
        Real people at Guideless. We see your trip and where you are, so you don&rsquo;t have to
        explain much.
      </Muted>

      <Card tone="inverse">
        <Eyebrow style={{ color: "#60E1BB" }}>Emergency</Eyebrow>
        <Text style={[styles.inverseBody, { color: "#F5F6F2" }]}>
          If you are in immediate danger, contact local emergency services first.
        </Text>
        {emergency.length > 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
            {emergency.map(([key, number]) => (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={`Call ${EMERGENCY_LABELS[key] ?? key} ${number}`}
                onPress={() => Linking.openURL(`tel:${number}`)}
                style={styles.emergencyButton}
              >
                <Ionicons name="call-outline" size={16} color="#0B2025" />
                <Text style={{ fontFamily: "Inter_600SemiBold", color: "#0B2025" }}>
                  {EMERGENCY_LABELS[key] ?? key} · {number}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={{ color: "#F5F6F2", opacity: 0.8 }}>
            Local numbers appear here once your trip is active. In the EU, 112 works everywhere.
          </Text>
        )}
        <Text style={{ color: "#F5F6F2", opacity: 0.8, fontSize: 13, marginTop: 4 }}>
          {destination ? `Numbers for ${destination.country_name}.` : ""} Then tell us — we&rsquo;ll
          help with everything after.
        </Text>
      </Card>

      <View style={{ flexDirection: "row", gap: Spacing.two }}>
        <Button
          title="New request"
          icon="chatbubble-ellipses-outline"
          style={{ flex: 1 }}
          onPress={() => router.push("/support/new")}
        />
        <Button
          title="Email"
          variant="secondary"
          icon="mail-outline"
          onPress={() => Linking.openURL(`mailto:${brand.supportEmail}`)}
        />
      </View>

      <View style={{ gap: Spacing.two }}>
        <Eyebrow>Your requests</Eyebrow>
        {threads.isPending ? (
          <Loading />
        ) : (threads.data ?? []).length === 0 ? (
          <Card>
            <H2>Nothing open.</H2>
            <Muted>{emptyStates.noSupport.body}</Muted>
          </Card>
        ) : (
          <Card style={{ paddingVertical: 0 }}>
            {(threads.data ?? []).map((t) => (
              <Row
                key={t.id}
                icon="help-buoy-outline"
                title={t.subject}
                subtitle={`${SUPPORT_CATEGORY_LABELS[t.category]} · ${formatDate(t.last_message_at.slice(0, 10))}`}
                right={
                  <Pill
                    tone={
                      t.status === "waiting_on_customer"
                        ? "accent"
                        : t.status === "resolved" || t.status === "closed"
                          ? "neutral"
                          : "warning"
                    }
                  >
                    {t.status.replace(/_/g, " ")}
                  </Pill>
                }
                onPress={() => router.push(`/support/${t.id}`)}
              />
            ))}
          </Card>
        )}
      </View>

      <View style={{ gap: Spacing.two }}>
        <Eyebrow>Common questions</Eyebrow>
        <Card>
          <H2 style={{ fontSize: 16 }}>Where do I meet the group?</H2>
          <Muted>
            Check the meeting point item on today&rsquo;s route — it has the exact spot and time.
          </Muted>
        </Card>
        <Card>
          <H2 style={{ fontSize: 16 }}>My train is late.</H2>
          <Muted>
            Reserved seats stay valid on the next service in most cases. Message us and we&rsquo;ll
            confirm with the operator.
          </Muted>
        </Card>
        <Card>
          <H2 style={{ fontSize: 16 }}>Do I have to join group moments?</H2>
          <Muted>No. Anything marked Optional is exactly that.</Muted>
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  inverseBody: { fontFamily: "Inter_500Medium", fontSize: 16, lineHeight: 22 },
  emergencyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#60E1BB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
