import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";
import type { DeepLink } from "@guideless/types";
import { deepLinkToPath } from "@/lib/notifications/deep-links";
import { supabase } from "@/lib/supabase";

/**
 * Push registration (spec §27–28). Operational notifications ("Your train leaves in 45 minutes")
 * are the point; marketing pushes are opt-in via notification_preferences. Remote push needs a
 * development build (not Expo Go) and an EAS projectId; both absences are handled quietly.
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPush(userId: string): Promise<string | null> {
  if (!Device.isDevice) return null;
  const projectId: string | undefined =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null; // local dev without EAS: nothing to register against

  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("operational", {
        name: "Trip updates",
        importance: Notifications.AndroidImportance.HIGH,
        description: "Trains, check-ins, itinerary changes and support replies.",
      });
      await Notifications.setNotificationChannelAsync("social", {
        name: "Group",
        importance: Notifications.AndroidImportance.DEFAULT,
        description: "Messages and live moments from your group.",
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    const status = existing.granted
      ? existing.status
      : (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return null;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const platform = Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : "web";
    const { error } = await supabase.from("push_tokens").upsert(
      {
        user_id: userId,
        token,
        platform,
        device_name: Device.modelName ?? null,
        app_version: Constants.expoConfig?.version ?? null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "token" },
    );
    if (error) console.warn("push token save failed", error.message);
    return token;
  } catch (err) {
    console.warn("push registration skipped", (err as Error).message);
    return null;
  }
}

/** Registers on sign-in and routes notification taps to the right screen. */
export function usePushRegistration(userId: string | null): void {
  const router = useRouter();

  useEffect(() => {
    if (!userId) return;
    registerForPush(userId);
  }, [userId]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as
        { deepLink?: DeepLink } | undefined;
      const path = data?.deepLink ? deepLinkToPath(data.deepLink) : null;
      if (path) router.push(path as never);
    });
    return () => sub.remove();
  }, [router]);
}
