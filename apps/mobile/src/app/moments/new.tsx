import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { toLocalDate } from "@guideless/utils";
import { Button, ErrorNote, Eyebrow, H1, Input, Label, Muted, Screen } from "@/components/ui";
import { useCurrentTrip } from "@/hooks/use-trip";
import { useSession } from "@/lib/auth/session";
import { momentsService } from "@/lib/moments/service";
import { currentDay } from "@/lib/trips/next-up";

/** Traveler-suggested Live Moment: "Anyone want to join dinner?" (spec §24). */
export default function NewMomentScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useSession();
  const { detail } = useCurrentTrip();
  const day = detail ? currentDay(detail.days, new Date()) : null;
  const timezone = day?.timezone ?? detail?.trip.timezone ?? "Europe/Paris";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(day?.date ?? toLocalDate(new Date(), timezone));
  const [time, setTime] = useState("19:00");
  const [location, setLocation] = useState(day?.destination?.name ?? "");
  const [capacity, setCapacity] = useState("");

  const valid =
    title.trim().length >= 3 &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(time);

  const create = useMutation({
    mutationFn: () =>
      momentsService.create({
        tripId: detail!.trip.id,
        userId: user!.id,
        title,
        description,
        date,
        time,
        timezone,
        locationName: location,
        capacity: capacity.trim() ? Number(capacity) : null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["moments", detail?.trip.id] });
      router.back();
    },
  });

  if (!detail || !user) {
    return (
      <Screen>
        <Muted>Your trip needs to be active to suggest a moment.</Muted>
      </Screen>
    );
  }

  return (
    <Screen>
      <Eyebrow>Live Moment</Eyebrow>
      <H1>Suggest a moment.</H1>
      <Muted>Optional for everyone, including you. Your group gets a heads-up.</Muted>

      <View>
        <Label>What</Label>
        <Input
          value={title}
          onChangeText={setTitle}
          placeholder="Sunset walk to Castle Hill"
          maxLength={120}
        />
      </View>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Label>Date</Label>
          <Input
            value={date}
            onChangeText={setDate}
            placeholder="2027-05-15"
            autoCapitalize="none"
          />
        </View>
        <View style={{ width: 120 }}>
          <Label>Time (local)</Label>
          <Input
            value={time}
            onChangeText={setTime}
            placeholder="19:45"
            keyboardType="numbers-and-punctuation"
          />
        </View>
      </View>
      <View>
        <Label>Where</Label>
        <Input
          value={location}
          onChangeText={setLocation}
          placeholder="Hotel lobby"
          maxLength={200}
        />
      </View>
      <View>
        <Label>Details (optional)</Label>
        <Input
          value={description}
          onChangeText={setDescription}
          multiline
          placeholder="Meet by the fountain. Back by 9."
          maxLength={2000}
        />
      </View>
      <View style={{ width: 160 }}>
        <Label>Max people (optional)</Label>
        <Input
          value={capacity}
          onChangeText={setCapacity}
          keyboardType="number-pad"
          placeholder="6"
        />
      </View>
      <Muted style={{ fontSize: 13 }}>Times are in {timezone.replace("_", " ")}.</Muted>

      <ErrorNote
        message={create.isError ? "Couldn't post. Check your connection and try again." : null}
      />
      <Button
        title="Post to the group"
        loading={create.isPending}
        disabled={!valid}
        onPress={() => create.mutate()}
      />
      <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
