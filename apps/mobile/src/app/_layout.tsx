import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from "@expo-google-fonts/inter";
import {
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from "@expo-google-fonts/manrope";
import { useFonts } from "expo-font";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as Sentry from "@sentry/react-native";
import { PostHogProvider } from "posthog-react-native";
import { useEffect, type ReactNode } from "react";
import { useColorScheme } from "react-native";

import { ScreenTracker } from "@/components/screen-tracker";
import { Colors } from "@/constants/theme";
import { posthog } from "@/lib/analytics";
import { SessionProvider, useSession } from "@/lib/auth/session";
import { usePushRegistration } from "@/lib/notifications/push";
import { QueryProvider } from "@/lib/query";

SplashScreen.preventAutoHideAsync();

/**
 * Crash reporting (spec §85). No-op without a DSN; never sends PII — travelers are identified in
 * Sentry only by an opaque user id, and breadcrumbs skip request bodies.
 */
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    enableAutoSessionTracking: true,
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === "xhr" || breadcrumb.category === "fetch") {
        delete breadcrumb.data?.request_body;
        delete breadcrumb.data?.response_body;
      }
      return breadcrumb;
    },
  });
}

/** PostHog context (owned by the analytics module); a passthrough when no key is configured. */
function Analytics({ children }: { children: ReactNode }) {
  if (!posthog) return <>{children}</>;
  return (
    <PostHogProvider client={posthog} autocapture={false}>
      {children}
    </PostHogProvider>
  );
}

/** Sends signed-out users to /login and signed-in users away from the auth group. */
function AuthGate({ children }: { children: ReactNode }) {
  const { session, ready } = useSession();
  const segments = useSegments();
  const router = useRouter();
  const inAuthGroup = segments[0] === "(auth)" || segments[0] === "auth";

  useEffect(() => {
    if (!ready) return;
    if (!session && !inAuthGroup) router.replace("/login");
    else if (session && segments[0] === "(auth)") router.replace("/");
  }, [ready, session, inAuthGroup, segments, router]);

  usePushRegistration(session?.user.id ?? null);

  return <>{children}</>;
}

function RootLayout() {
  const scheme = useColorScheme();
  const dark = scheme === "dark";
  const c = Colors[dark ? "dark" : "light"];
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  const navTheme = {
    ...(dark ? DarkTheme : DefaultTheme),
    colors: {
      ...(dark ? DarkTheme : DefaultTheme).colors,
      primary: c.primary,
      background: c.background,
      card: c.backgroundElement,
      text: c.text,
      border: c.border,
    },
  };

  return (
    <Analytics>
      <QueryProvider>
        <SessionProvider>
          <ThemeProvider value={navTheme}>
            <StatusBar style={dark ? "light" : "dark"} />
            <ScreenTracker />
            <AuthGate>
              <Stack
                screenOptions={{
                  headerStyle: { backgroundColor: c.background },
                  headerTintColor: c.text,
                  headerTitleStyle: { fontFamily: "Manrope_700Bold" },
                  headerShadowVisible: false,
                  contentStyle: { backgroundColor: c.background },
                }}
              >
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
                <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
                <Stack.Screen name="itinerary/[tripId]" options={{ title: "Your Route" }} />
                <Stack.Screen name="item/[itemId]" options={{ title: "" }} />
                <Stack.Screen name="chat/[roomId]" options={{ title: "Chat" }} />
                <Stack.Screen
                  name="support/new"
                  options={{ title: "Contact Guideless", presentation: "modal" }}
                />
                <Stack.Screen name="support/[threadId]" options={{ title: "Support" }} />
                <Stack.Screen
                  name="moments/new"
                  options={{ title: "Suggest a moment", presentation: "modal" }}
                />
              </Stack>
            </AuthGate>
          </ThemeProvider>
        </SessionProvider>
      </QueryProvider>
    </Analytics>
  );
}

export default SENTRY_DSN ? Sentry.wrap(RootLayout) : RootLayout;
