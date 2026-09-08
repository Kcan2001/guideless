import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  Body,
  Button,
  Card,
  ErrorNote,
  Eyebrow,
  H1,
  Input,
  Label,
  Loading,
  Muted,
  Screen,
} from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { track } from "@/lib/analytics";
import { useSession } from "@/lib/auth/session";
import { photoErrorMessage, reviewService } from "@/lib/reviews/service";

/**
 * "How was it?" — one screen, reachable only for a trip that has already ended. Rating and a
 * few words is the whole ask; a photo is optional and uploaded straight away so a slow connection
 * never costs someone the words they just typed.
 */
export default function ReviewScreen() {
  const c = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useSession();
  const userId = user?.id ?? "";
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();

  const [rating, setRating] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [wouldRepeat, setWouldRepeat] = useState<boolean | null>(null);
  const [photos, setPhotos] = useState(0);
  const [busyPhoto, setBusyPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reviewable = useQuery({
    queryKey: ["reviewable"],
    queryFn: () => reviewService.reviewable(),
  });
  const trip = reviewable.data?.find((t) => t.bookingId === bookingId);

  const save = useMutation({
    mutationFn: async () => {
      if (!rating) throw new Error("Pick a rating first.");
      if (body.trim().length < 20) throw new Error("A sentence or two, so it is useful.");
      await reviewService.submit({
        bookingId: String(bookingId),
        rating,
        body: body.trim(),
        title: title.trim() || undefined,
        wouldRepeat: wouldRepeat ?? undefined,
      });
    },
    onSuccess: () => {
      track("review_submitted", { rating: rating ?? 0, has_photo: photos > 0 });
      qc.invalidateQueries({ queryKey: ["reviewable"] });
      qc.invalidateQueries({ queryKey: ["my-reviews"] });
      router.back();
    },
    onError: (e: Error) => setError(e.message),
  });

  const addPhoto = async () => {
    if (!trip || busyPhoto) return;
    setBusyPhoto(true);
    setError(null);
    const result = await reviewService.addPhoto(trip, userId);
    setBusyPhoto(false);
    if (result.ok) {
      setPhotos((n) => n + 1);
      track("trip_photo_added", {});
      return;
    }
    if (result.reason !== "cancelled") setError(photoErrorMessage(result.reason));
  };

  if (reviewable.isPending) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  if (!trip) {
    return (
      <Screen>
        <H1>Nothing to review</H1>
        <Muted>
          You can write about a trip once it has ended. If you already have, thank you — we read
          every one before it goes up.
        </Muted>
        <Button title="Back" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Eyebrow>Your trip</Eyebrow>
      <H1>How was {trip.tourName}?</H1>
      <Body>
        Published with your first name once we have read it. Say what worked, what did not, and who
        the trip would suit.
      </Body>

      <Card>
        <View>
          <Label>Rating</Label>
          <View style={{ flexDirection: "row", gap: Spacing.two, marginTop: 4 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={n}
                onPress={() => setRating(n)}
                accessibilityRole="radio"
                accessibilityState={{ selected: rating === n }}
                accessibilityLabel={`${n} out of 5`}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: rating === n ? c.accent : c.border,
                  backgroundColor: rating === n ? c.backgroundSelected : "transparent",
                }}
              >
                <Text style={{ color: rating === n ? c.text : c.textSecondary, fontWeight: "600" }}>
                  {n}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View>
          <Label>Headline (optional)</Label>
          <Input
            value={title}
            onChangeText={setTitle}
            maxLength={120}
            placeholder="What you would tell a friend in one line"
            accessibilityLabel="Headline"
          />
        </View>

        <View>
          <Label>Your review</Label>
          <Input
            value={body}
            onChangeText={setBody}
            multiline
            numberOfLines={6}
            maxLength={4000}
            style={{ minHeight: 120, textAlignVertical: "top", paddingTop: 10 }}
            placeholder="The trains were booked, the welcome drinks were real…"
            accessibilityLabel="Your review"
          />
        </View>

        <View>
          <Label>Would you travel Guideless again?</Label>
          <View style={{ flexDirection: "row", gap: Spacing.two, marginTop: 4 }}>
            {[
              { value: true, label: "Yes" },
              { value: false, label: "No" },
            ].map((option) => (
              <Pressable
                key={option.label}
                onPress={() => setWouldRepeat(option.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: wouldRepeat === option.value }}
                style={{
                  paddingHorizontal: Spacing.three,
                  paddingVertical: 10,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: wouldRepeat === option.value ? c.accent : c.border,
                  backgroundColor:
                    wouldRepeat === option.value ? c.backgroundSelected : "transparent",
                }}
              >
                <Text style={{ color: c.text }}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Card>

      <Card>
        <Label>Photos (optional)</Label>
        <Muted>
          {photos === 0
            ? "Add a photo from the trip. We check them before any appear."
            : `${photos} photo${photos === 1 ? "" : "s"} sent for review.`}
        </Muted>
        <Button
          title={busyPhoto ? "Adding…" : "Add a photo"}
          variant="secondary"
          loading={busyPhoto}
          disabled={busyPhoto}
          onPress={addPhoto}
        />
      </Card>

      <ErrorNote message={error} />

      <Button
        title={save.isPending ? "Sending…" : "Send review"}
        loading={save.isPending}
        disabled={save.isPending}
        onPress={() => save.mutate()}
      />
      <Button title="Not now" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}
