import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { INTERESTS } from "@guideless/validation";
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
import { avatarErrorMessage, pickAndUploadAvatar } from "@/lib/profile/avatar";
import { PARTY_LABEL, PARTY_TYPES, type PartyType } from "@/lib/profile/extras";
import { onboardingSchema } from "@/lib/profile/onboarding";
import { profileService } from "@/lib/profile/service";

/**
 * First run after sign-in. Everything except a name is optional, and "Do this later" is a real
 * exit — it stamps `onboarded_at` so the traveler is never asked twice.
 */
export default function OnboardingScreen() {
  const c = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useSession();
  const userId = user?.id ?? "";

  const profile = useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: () => profileService.getProfile(userId),
  });

  const [displayName, setDisplayName] = useState("");
  const [travelingFrom, setTravelingFrom] = useState("");
  const [excitedAbout, setExcitedAbout] = useState("");
  const [partyType, setPartyType] = useState<PartyType | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [pickingPhoto, setPickingPhoto] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seed once from the server copy without an effect.
  if (!seeded && profile.data) {
    setDisplayName(profile.data.display_name || "");
    setInterests(profile.data.interests ?? []);
    setAvatarUrl(profile.data.avatar_url);
    setSeeded(true);
  }

  const done = () => {
    qc.invalidateQueries({ queryKey: ["profile", userId] });
    router.replace("/");
  };

  const save = useMutation({
    mutationFn: async () => {
      const parsed = onboardingSchema.safeParse({
        displayName,
        travelingFrom,
        excitedAbout,
        partyType,
        interests,
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Check your details");
      const v = parsed.data;
      await profileService.updateProfile(userId, {
        display_name: v.displayName,
        traveling_from: v.travelingFrom ?? null,
        excited_about: v.excitedAbout ?? null,
        party_type: v.partyType,
        interests: v.interests,
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
        onboarded_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      track("onboarding_completed", {
        has_photo: Boolean(avatarUrl),
        has_traveling_from: travelingFrom.trim().length > 0,
        has_excited_about: excitedAbout.trim().length > 0,
        interests: interests.length,
      });
      done();
    },
    onError: (e: Error) => setError(e.message || "Couldn't save. Try again."),
  });

  const skip = useMutation({
    mutationFn: () =>
      profileService.updateProfile(userId, { onboarded_at: new Date().toISOString() }),
    onSettled: () => {
      track("onboarding_skipped");
      done();
    },
  });

  if (profile.isPending) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const busy = save.isPending || skip.isPending;

  const choosePhoto = async () => {
    if (pickingPhoto) return;
    setPickingPhoto(true);
    setError(null);
    const result = await pickAndUploadAvatar(userId);
    setPickingPhoto(false);
    if (result.ok) {
      setAvatarUrl(result.url);
      track("avatar_set", { source: "onboarding" });
      return;
    }
    if (result.reason !== "cancelled") setError(avatarErrorMessage(result.reason));
  };

  return (
    <Screen>
      <Eyebrow>Welcome</Eyebrow>
      <H1>Say hello to your group.</H1>
      <Body>
        Only what you choose to share is visible, and you can change any of it later in your
        profile.
      </Body>

      <Card>
        <View style={{ alignItems: "center", gap: Spacing.two }}>
          <Pressable
            onPress={choosePhoto}
            disabled={pickingPhoto || busy}
            accessibilityRole="button"
            accessibilityLabel={avatarUrl ? "Change your photo" : "Add a photo"}
            style={{
              width: 88,
              height: 88,
              borderRadius: 44,
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              backgroundColor: c.backgroundSelected,
              borderWidth: 1,
              borderColor: c.border,
            }}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={{ width: 88, height: 88 }} />
            ) : (
              <Text style={{ fontSize: 28, color: c.textSecondary }}>
                {(displayName.trim()[0] ?? "?").toUpperCase()}
              </Text>
            )}
          </Pressable>
          <Pressable
            onPress={choosePhoto}
            disabled={pickingPhoto || busy}
            accessibilityRole="button"
          >
            <Muted>
              {pickingPhoto
                ? "Adding photo…"
                : avatarUrl
                  ? "Change photo"
                  : "Add a photo (optional)"}
            </Muted>
          </Pressable>
        </View>
        <View>
          <Label>Name</Label>
          <Input
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Kyle"
            autoComplete="name"
            accessibilityLabel="Your name"
          />
        </View>
        <View>
          <Label>Traveling from (optional)</Label>
          <Input
            value={travelingFrom}
            onChangeText={setTravelingFrom}
            placeholder="Santa Monica, California"
            accessibilityLabel="Where you are traveling from"
          />
        </View>
        <View>
          <Label>What are you most excited about? (optional)</Label>
          <Input
            value={excitedAbout}
            onChangeText={setExcitedAbout}
            placeholder="The Friday boat, and eating everything in Nice."
            multiline
            accessibilityLabel="What you are excited about"
          />
        </View>
        <View style={{ gap: 6 }}>
          <Label>Who are you traveling with? (optional)</Label>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {PARTY_TYPES.map((p) => (
              <Chip
                key={p}
                label={PARTY_LABEL[p]}
                active={partyType === p}
                onPress={() => setPartyType(partyType === p ? null : p)}
              />
            ))}
          </View>
        </View>
        <View style={{ gap: 6 }}>
          <Label>Into (optional, pick up to 12)</Label>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {INTERESTS.map((i) => (
              <Chip
                key={i}
                label={i.replace(/_/g, " ")}
                active={interests.includes(i)}
                onPress={() =>
                  setInterests((cur) =>
                    cur.includes(i)
                      ? cur.filter((x) => x !== i)
                      : cur.length >= 12
                        ? cur
                        : [...cur, i],
                  )
                }
              />
            ))}
          </View>
        </View>
        <ErrorNote message={error} />
        <Button
          title={save.isPending ? "Saving…" : "Done"}
          loading={save.isPending}
          disabled={busy}
          onPress={() => save.mutate()}
        />
        <Button
          title="Do this later"
          variant="ghost"
          disabled={busy}
          onPress={() => skip.mutate()}
        />
      </Card>

      <Muted style={{ fontSize: 13 }}>
        Email, phone and booking details are never shown to other travelers.
      </Muted>
      <View style={{ height: Spacing.four }} />
    </Screen>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        paddingHorizontal: 12,
        minHeight: 40,
        justifyContent: "center",
        borderRadius: 999,
        borderWidth: 1,
        backgroundColor: active ? c.primary : c.backgroundElement,
        borderColor: active ? c.primary : c.border,
      }}
    >
      <Text
        style={{
          fontFamily: "Inter_500Medium",
          fontSize: 13,
          color: active ? c.primaryText : c.text,
          textTransform: "capitalize",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
