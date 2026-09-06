import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import { useState } from "react";
import { Linking, Switch, View } from "react-native";
import { brand } from "@guideless/config";
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
import { authService } from "@/lib/auth/service";
import { useSession } from "@/lib/auth/session";
import { profileService, type Profile } from "@/lib/profile/service";
import { tripCache } from "@/lib/trips/cache";

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

  const togglePref = useMutation({
    mutationFn: (patch: Parameters<typeof profileService.updatePrefs>[1]) =>
      profileService.updatePrefs(userId, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prefs", userId] }),
  });

  return (
    <Screen>
      <Eyebrow>Profile</Eyebrow>
      <H1>{profile.data?.display_name || "You"}</H1>
      <Muted>{user?.email}</Muted>

      {profile.isPending || !profile.data ? (
        <Loading />
      ) : (
        // Keyed by updated_at so a fresh server copy re-seeds the form without effects.
        <ProfileForm key={profile.data.updated_at} userId={userId} profile={profile.data} />
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
          title="Bookings & payments"
          subtitle="Managed on the website"
          onPress={() => Linking.openURL("https://guidelesstours.com/account")}
        />
        <Row
          icon="document-text-outline"
          title="Terms & privacy"
          subtitle={`Terms version ${brand.termsVersion}`}
          onPress={() => Linking.openURL("https://guidelesstours.com/how-it-works")}
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

/** Editable public profile. State is seeded once from props; the parent re-keys on server changes. */
function ProfileForm({ userId, profile }: { userId: string; profile: Profile }) {
  const c = useTheme();
  const qc = useQueryClient();
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [homeCountry, setHomeCountry] = useState(profile.home_country ?? "");

  const save = useMutation({
    mutationFn: () =>
      profileService.updateProfile(userId, {
        display_name: displayName.trim().slice(0, 80),
        bio: bio.trim() ? bio.trim().slice(0, 500) : null,
        home_country: homeCountry.trim() ? homeCountry.trim().toUpperCase().slice(0, 2) : null,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile", userId] }),
  });

  const toggleVisibility = useMutation({
    mutationFn: (patch: { show_home_country?: boolean; show_bio?: boolean }) =>
      profileService.updateProfile(userId, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile", userId] }),
  });

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
      <ErrorNote message={save.isError ? "Couldn't save. Try again." : null} />
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
          title="Show my bio to my group"
          right={
            <Switch
              value={profile.show_bio}
              onValueChange={(v) => toggleVisibility.mutate({ show_bio: v })}
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
