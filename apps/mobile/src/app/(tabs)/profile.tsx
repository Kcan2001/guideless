import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import { useState } from "react";
import { Image, Linking, Pressable, Share, Switch, Text, View } from "react-native";
import { brand } from "@guideless/config";
import { INTERESTS, TRAVEL_STYLES, groupProfileSchema } from "@guideless/validation";
import { formatMoney } from "@guideless/utils";
import {
  Button,
  Card,
  ErrorNote,
  Eyebrow,
  H1,
  H2,
  Input,
  Label,
  Loading,
  Muted,
  Row,
  Screen,
} from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { track } from "@/lib/analytics";
import { authService } from "@/lib/auth/service";
import { avatarErrorMessage, pickAndUploadAvatar } from "@/lib/profile/avatar";
import { useSession } from "@/lib/auth/session";
import { PARTY_LABEL, PARTY_TYPES, type PartyType } from "@/lib/profile/extras";
import { profileService, type Profile } from "@/lib/profile/service";
import { tripCache } from "@/lib/trips/cache";

const STYLE_LABEL = { relaxed: "Relaxed", balanced: "Balanced", active: "Active" } as const;

export default function ProfileScreen() {
  const c = useTheme();
  const { user } = useSession();
  const qc = useQueryClient();
  const userId = user?.id ?? "";

  const profile = useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: () => profileService.getProfile(userId),
  });
  const prefs = useQuery({
    queryKey: ["prefs", userId],
    enabled: !!userId,
    queryFn: () => profileService.getPrefs(userId),
  });
  const referral = useQuery({
    queryKey: ["referral", userId],
    enabled: !!userId,
    queryFn: () => profileService.referral(userId),
  });

  const togglePref = useMutation({
    mutationFn: (patch: Parameters<typeof profileService.updatePrefs>[1]) =>
      profileService.updatePrefs(userId, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prefs", userId] }),
  });

  return (
    <Screen>
      <Eyebrow>Profile</Eyebrow>
      <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.two }}>
        <AvatarPicker
          userId={userId}
          url={profile.data?.avatar_url ?? null}
          name={profile.data?.display_name || ""}
          onChanged={() => qc.invalidateQueries({ queryKey: ["profile", userId] })}
        />
        <View style={{ flex: 1 }}>
          <H1>{profile.data?.display_name || "You"}</H1>
          <Muted>{user?.email}</Muted>
        </View>
      </View>

      {profile.isPending || !profile.data ? (
        <Loading />
      ) : (
        // Keyed by updated_at so a fresh server copy re-seeds the form without effects.
        <ProfileForm key={profile.data.updated_at} userId={userId} profile={profile.data} />
      )}

      {referral.data?.code && (
        <Card tone="accent">
          <Eyebrow>Bring a friend</Eyebrow>
          <H2>{referral.data.code}</H2>
          <Muted style={{ fontSize: 14 }}>
            A friend books with your code and gets 5% off the trip. You earn credit toward your next
            one once they&rsquo;ve paid.
          </Muted>
          {referral.data.credit > 0 && (
            <Muted>
              Credit available:{" "}
              {formatMoney({ amount: referral.data.credit, currency: "USD" }, { compact: true })} —
              applied automatically at checkout.
            </Muted>
          )}
          <Button
            title="Share your code"
            variant="secondary"
            icon="share-outline"
            onPress={() =>
              Share.share({
                message: `Come on a Guideless trip with me. Use ${referral.data!.code} at guidelesstravel.com for 5% off.`,
              })
            }
          />
        </Card>
      )}

      <Card>
        <H2>Notifications</H2>
        <Muted style={{ fontSize: 13 }}>
          Trip updates — trains, check-ins, itinerary changes — always arrive while you&rsquo;re
          traveling.
        </Muted>
        {prefs.isPending ? (
          <Loading />
        ) : (
          <>
            <Row
              title="Group messages"
              subtitle="Push when someone writes in your group"
              right={
                <Switch
                  value={prefs.data?.social_push ?? true}
                  onValueChange={(v) => togglePref.mutate({ social_push: v })}
                  trackColor={{ true: c.accent }}
                />
              }
            />
            <Row
              title="Trip emails"
              subtitle="Confirmations and changes by email too"
              right={
                <Switch
                  value={prefs.data?.operational_email ?? true}
                  onValueChange={(v) => togglePref.mutate({ operational_email: v })}
                  trackColor={{ true: c.accent }}
                />
              }
            />
            <Row
              title="New trips & offers"
              subtitle="Occasional. Off by default."
              right={
                <Switch
                  value={prefs.data?.marketing_push ?? false}
                  onValueChange={(v) => togglePref.mutate({ marketing_push: v })}
                  trackColor={{ true: c.accent }}
                />
              }
            />
          </>
        )}
      </Card>

      <Card>
        <H2>Account</H2>
        <Row
          icon="receipt-outline"
          title="Bookings, add-ons & payments"
          subtitle="Managed on the website"
          onPress={() => Linking.openURL("https://guidelesstravel.com/account")}
        />
        <Row
          icon="document-text-outline"
          title="Terms & privacy"
          subtitle={`Terms version ${brand.termsVersion}`}
          onPress={() => Linking.openURL("https://guidelesstravel.com/how-it-works")}
        />
        <Row
          icon="mail-outline"
          title={brand.supportEmail}
          onPress={() => Linking.openURL(`mailto:${brand.supportEmail}`)}
        />
        <Button
          title="Sign out"
          variant="secondary"
          onPress={async () => {
            await tripCache.clear();
            qc.clear();
            await authService.signOut();
          }}
        />
      </Card>

      <Muted style={{ fontSize: 12, textAlign: "center" }}>
        {brand.name} · v{Constants.expoConfig?.version ?? "dev"}
      </Muted>
    </Screen>
  );
}

/** Editable group profile. State is seeded once from props; the parent re-keys on server changes. */
function ProfileForm({ userId, profile }: { userId: string; profile: Profile }) {
  const c = useTheme();
  const qc = useQueryClient();
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [homeCountry, setHomeCountry] = useState(profile.home_country ?? "");
  const [interests, setInterests] = useState<string[]>(profile.interests ?? []);
  const [travelStyle, setTravelStyle] = useState<string | null>(profile.travel_style ?? null);
  const [languages, setLanguages] = useState((profile.languages ?? []).join(", "));
  const [travelingFrom, setTravelingFrom] = useState(profile.traveling_from ?? "");
  const [excitedAbout, setExcitedAbout] = useState(profile.excited_about ?? "");
  const [partyType, setPartyType] = useState<PartyType | null>(
    (profile.party_type ?? null) as PartyType | null,
  );
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const parsed = groupProfileSchema.safeParse({
        displayName,
        bio,
        homeCountry,
        interests,
        travelStyle,
        languages: languages
          .split(",")
          .map((l) => l.trim())
          .filter(Boolean),
        showHomeCountry: profile.show_home_country,
        showBio: profile.show_bio,
        showInterests: profile.show_interests,
      });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Check your details");
      }
      const v = parsed.data;
      await profileService.updateProfile(userId, {
        display_name: v.displayName,
        bio: v.bio ?? null,
        home_country: v.homeCountry ?? null,
        interests: v.interests,
        travel_style: v.travelStyle,
        languages: v.languages,
        traveling_from: travelingFrom.trim() || null,
        excited_about: excitedAbout.trim() || null,
        party_type: partyType,
      });
    },
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ["profile", userId] });
    },
    onError: (e: Error) => setError(e.message || "Couldn't save. Try again."),
  });

  const toggleVisibility = useMutation({
    mutationFn: (patch: {
      show_home_country?: boolean;
      show_bio?: boolean;
      show_interests?: boolean;
      show_traveling_from?: boolean;
    }) => profileService.updateProfile(userId, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile", userId] }),
  });

  const toggleInterest = (i: string) =>
    setInterests((cur) =>
      cur.includes(i) ? cur.filter((x) => x !== i) : cur.length >= 12 ? cur : [...cur, i],
    );

  return (
    <Card>
      <H2>How your group sees you</H2>
      <View>
        <Label>Name</Label>
        <Input value={displayName} onChangeText={setDisplayName} autoComplete="name" />
      </View>
      <View>
        <Label>A line about you (optional)</Label>
        <Input
          value={bio}
          onChangeText={setBio}
          placeholder="First time in France. Coffee before anything."
          multiline
        />
      </View>
      <View>
        <Label>Home country (2-letter code)</Label>
        <Input
          value={homeCountry}
          onChangeText={setHomeCountry}
          placeholder="US"
          autoCapitalize="characters"
          maxLength={2}
        />
      </View>
      <View>
        <Label>Traveling from (optional)</Label>
        <Input
          value={travelingFrom}
          onChangeText={setTravelingFrom}
          placeholder="Santa Monica, California"
        />
      </View>
      <View>
        <Label>Excited about (optional)</Label>
        <Input
          value={excitedAbout}
          onChangeText={setExcitedAbout}
          placeholder="The Friday boat."
          multiline
        />
      </View>
      <View style={{ gap: 6 }}>
        <Label>Traveling as</Label>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {PARTY_TYPES.map((pt) => (
            <Chip
              key={pt}
              label={PARTY_LABEL[pt]}
              active={partyType === pt}
              onPress={() => setPartyType(partyType === pt ? null : pt)}
            />
          ))}
        </View>
      </View>
      <View style={{ gap: 6 }}>
        <Label>Travel style</Label>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {TRAVEL_STYLES.map((s) => (
            <Chip
              key={s}
              label={STYLE_LABEL[s]}
              active={travelStyle === s}
              onPress={() => setTravelStyle(travelStyle === s ? null : s)}
            />
          ))}
        </View>
      </View>
      <View style={{ gap: 6 }}>
        <Label>Into (pick up to 12)</Label>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {INTERESTS.map((i) => (
            <Chip
              key={i}
              label={i.replace(/_/g, " ")}
              active={interests.includes(i)}
              onPress={() => toggleInterest(i)}
            />
          ))}
        </View>
      </View>
      <View>
        <Label>Languages (comma-separated)</Label>
        <Input value={languages} onChangeText={setLanguages} placeholder="English, some French" />
      </View>
      <ErrorNote message={error} />
      <Button
        title={save.isPending ? "Saving…" : "Save"}
        loading={save.isPending}
        onPress={() => save.mutate()}
      />
      <View style={{ gap: 4, marginTop: Spacing.two }}>
        <Row
          title="Show my home country to my group"
          right={
            <Switch
              value={profile.show_home_country}
              onValueChange={(v) => toggleVisibility.mutate({ show_home_country: v })}
              trackColor={{ true: c.accent }}
            />
          }
        />
        <Row
          title="Show where I'm traveling from"
          right={
            <Switch
              value={profile.show_traveling_from ?? true}
              onValueChange={(v) => toggleVisibility.mutate({ show_traveling_from: v })}
              trackColor={{ true: c.accent }}
            />
          }
        />
        <Row
          title="Show my bio to my group"
          right={
            <Switch
              value={profile.show_bio}
              onValueChange={(v) => toggleVisibility.mutate({ show_bio: v })}
              trackColor={{ true: c.accent }}
            />
          }
        />
        <Row
          title="Show interests and travel style"
          right={
            <Switch
              value={profile.show_interests}
              onValueChange={(v) => toggleVisibility.mutate({ show_interests: v })}
              trackColor={{ true: c.accent }}
            />
          }
        />
      </View>
      <Muted style={{ fontSize: 13 }}>
        Email, phone, passport and date of birth are never shown to other travelers.
      </Muted>
    </Card>
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
        minHeight: 36,
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

/** Tap to replace your profile photo; the group roster shows it. Cancelling changes nothing. */
function AvatarPicker({
  userId,
  url,
  name,
  onChanged,
}: {
  userId: string;
  url: string | null;
  name: string;
  onChanged: () => void;
}) {
  const c = useTheme();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shown = preview ?? url;

  const choose = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await pickAndUploadAvatar(userId);
    if (result.ok) {
      setPreview(result.url);
      try {
        await profileService.updateProfile(userId, { avatar_url: result.url });
        track("avatar_set", { source: "profile" });
        onChanged();
      } catch {
        setError("Could not save that photo. Try again.");
      }
    } else if (result.reason !== "cancelled") {
      setError(avatarErrorMessage(result.reason));
    }
    setBusy(false);
  };

  return (
    <View style={{ alignItems: "center", gap: 4 }}>
      <Pressable
        onPress={choose}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={shown ? "Change your photo" : "Add a photo"}
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: c.backgroundSelected,
          borderWidth: 1,
          borderColor: c.border,
        }}
      >
        {shown ? (
          <Image source={{ uri: shown }} style={{ width: 64, height: 64 }} />
        ) : (
          <Text style={{ fontSize: 22, color: c.textSecondary }}>
            {(name.trim()[0] ?? "?").toUpperCase()}
          </Text>
        )}
      </Pressable>
      <Pressable onPress={choose} disabled={busy} accessibilityRole="button">
        <Muted style={{ fontSize: 12 }}>{busy ? "Saving…" : shown ? "Change" : "Add photo"}</Muted>
      </Pressable>
      {error && <ErrorNote message={error} />}
    </View>
  );
}
