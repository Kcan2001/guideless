import { Image } from "expo-image";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { brand } from "@guideless/config";
import { Body, Button, ErrorNote, H1, Input, Label, Muted, Screen } from "@/components/ui";
import { Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { authService } from "@/lib/auth/service";

type Mode = "magic" | "password" | "signup";

export default function LoginScreen() {
  const c = useTheme();
  const [mode, setMode] = useState<Mode>("magic");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === "magic") {
        const r = await authService.sendMagicLink(email);
        if (r.error) setError(r.error);
        else setMessage("Check your inbox — tap the link on this phone to sign in.");
      } else if (mode === "password") {
        const r = await authService.signInWithPassword(email, password);
        if (r.error) setError(r.error);
      } else {
        const r = await authService.signUp(email, password, name);
        if (r.error) setError(r.error);
        else if (r.needsConfirmation)
          setMessage("Almost there — confirm your email from the link we just sent.");
      }
    } finally {
      setBusy(false);
    }
  }

  const tabs: [Mode, string][] = [
    ["magic", "Email link"],
    ["password", "Password"],
    ["signup", "New account"],
  ];

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ gap: Spacing.three }}
      >
        <View style={{ alignItems: "flex-start", gap: Spacing.two, marginTop: Spacing.five }}>
          <Image
            source={require("@/assets/images/icon.png")}
            style={{ width: 56, height: 56, borderRadius: 14 }}
          />
          <H1>{brand.tagline}</H1>
          <Muted>Sign in to see your trip, your group and your route.</Muted>
        </View>

        <View
          style={[styles.tabs, { backgroundColor: c.backgroundSelected }]}
          accessibilityRole="tablist"
        >
          {tabs.map(([value, label]) => (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === value }}
              onPress={() => {
                setMode(value);
                setError(null);
                setMessage(null);
              }}
              style={[styles.tab, mode === value && { backgroundColor: c.backgroundElement }]}
            >
              <Text style={[styles.tabText, { color: mode === value ? c.text : c.textSecondary }]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {mode === "signup" && (
          <View>
            <Label>Your name</Label>
            <Input value={name} onChangeText={setName} autoComplete="name" textContentType="name" />
          </View>
        )}
        <View>
          <Label>Email</Label>
          <Input
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder="you@example.com"
          />
        </View>
        {mode !== "magic" && (
          <View>
            <Label>Password</Label>
            <Input
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              textContentType={mode === "signup" ? "newPassword" : "password"}
            />
            {mode === "signup" && (
              <Muted style={{ fontSize: 13, marginTop: 4 }}>
                At least 10 characters with letters and numbers.
              </Muted>
            )}
          </View>
        )}

        <ErrorNote message={error} />
        {message && (
          <View style={[styles.note, { backgroundColor: c.backgroundSelected }]}>
            <Body>{message}</Body>
          </View>
        )}

        <Button
          title={
            mode === "magic"
              ? "Email me a sign-in link"
              : mode === "password"
                ? "Sign in"
                : "Create account"
          }
          onPress={submit}
          loading={busy}
          disabled={!email || (mode !== "magic" && !password) || (mode === "signup" && !name)}
        />
        <Muted style={{ fontSize: 13 }}>
          Booking a trip happens on the website; this app is your companion once you have.
        </Muted>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", borderRadius: Radius.md, padding: 4, gap: 4 },
  tab: { flex: 1, borderRadius: Radius.sm, paddingVertical: 10, alignItems: "center" },
  tabText: { fontFamily: "Inter_500Medium", fontSize: 14 },
  note: { borderRadius: Radius.md, padding: Spacing.three },
});
