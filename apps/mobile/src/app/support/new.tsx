import { useMutation, useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SUPPORT_CATEGORIES, type SupportCategory } from "@guideless/types";
import { Button, ErrorNote, Eyebrow, H1, Input, Label, Muted, Screen } from "@/components/ui";
import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { track } from "@/lib/analytics";
import { useSession } from "@/lib/auth/session";
import { useCurrentTrip } from "@/hooks/use-trip";
import { SUPPORT_CATEGORY_LABELS, supportService } from "@/lib/support/service";

export default function NewSupportRequestScreen() {
  const c = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useSession();
  const { detail } = useCurrentTrip();
  const params = useLocalSearchParams<{ itemId?: string; subject?: string }>();

  const [category, setCategory] = useState<SupportCategory>(params.itemId ? "itinerary" : "other");
  const [subject, setSubject] = useState(params.subject ? `About: ${params.subject}` : "");
  const [body, setBody] = useState("");

  const create = useMutation({
    mutationFn: () =>
      supportService.createThread({
        customerId: user!.id,
        category,
        subject,
        body,
        tripId: detail?.trip.id ?? null,
        context: { itineraryItemId: params.itemId, appVersion: Constants.expoConfig?.version },
      }),
    onSuccess: (thread) => {
      track("support_started", { category });
      qc.invalidateQueries({ queryKey: ["support-threads"] });
      router.replace(`/support/${thread.id}`);
    },
  });

  return (
    <Screen>
      <Eyebrow>Support</Eyebrow>
      <H1>What&rsquo;s going on?</H1>
      <Muted>We already see your trip and today&rsquo;s route, so keep it short.</Muted>

      <View>
        <Label>Topic</Label>
        <View style={styles.chips}>
          {SUPPORT_CATEGORIES.map((cat) => (
            <Pressable
              key={cat}
              accessibilityRole="radio"
              accessibilityState={{ checked: category === cat }}
              onPress={() => setCategory(cat)}
              style={[
                styles.chip,
                {
                  borderColor: cat === "emergency" ? "#C9484D" : c.border,
                  backgroundColor:
                    category === cat
                      ? cat === "emergency"
                        ? "#C9484D"
                        : c.primary
                      : c.backgroundElement,
                },
              ]}
            >
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  color: category === cat ? "#FFFFFF" : cat === "emergency" ? "#9B2F33" : c.text,
                }}
              >
                {SUPPORT_CATEGORY_LABELS[cat]}
              </Text>
            </Pressable>
          ))}
        </View>
        {category === "emergency" && (
          <Muted style={{ marginTop: 6, fontSize: 13 }}>
            If anyone is in danger, call local emergency services first (112 in the EU). We&rsquo;ll
            prioritise this.
          </Muted>
        )}
      </View>

      <View>
        <Label>Subject</Label>
        <Input
          value={subject}
          onChangeText={setSubject}
          placeholder="Hotel says they have no booking"
          maxLength={200}
        />
      </View>
      <View>
        <Label>Tell us more</Label>
        <Input
          value={body}
          onChangeText={setBody}
          multiline
          style={{ minHeight: 120, paddingTop: 12 }}
          placeholder="Where you are, what happened, what would help."
          maxLength={8000}
        />
      </View>

      <ErrorNote
        message={create.isError ? "Couldn't send. Check your connection and try again." : null}
      />
      <Button
        title="Send to Guideless"
        loading={create.isPending}
        disabled={!user || subject.trim().length < 1 || body.trim().length < 1}
        onPress={() => create.mutate()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 40,
    justifyContent: "center",
  },
});
