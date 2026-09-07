import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Extends app.json. Firebase (GA4 for the app) is opt-in by file presence: drop
 * google-services.json + GoogleService-Info.plist next to this file (git-ignored; in CI they come
 * from EAS file environment variables) and the config plugins + native modules are included in
 * the next prebuild / EAS build. Without them the app builds exactly as before and
 * src/lib/analytics.ts skips the Firebase sink. See docs/marketing.md.
 */
// On EAS the files arrive as *file* environment variables: the variable holds a path to a temp
// file, so honour it before falling back to the local copies.
const ANDROID_SERVICES = process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json";
const IOS_SERVICES = process.env.GOOGLE_SERVICE_INFO_PLIST ?? "./GoogleService-Info.plist";

export default ({ config }: ConfigContext): ExpoConfig => {
  const hasAndroid = existsSync(resolve(__dirname, ANDROID_SERVICES));
  const hasIos = existsSync(resolve(__dirname, IOS_SERVICES));
  const firebase = hasAndroid || hasIos;

  return {
    ...config,
    name: config.name ?? "Guideless",
    slug: config.slug ?? "guideless",
    android: {
      ...config.android,
      ...(hasAndroid ? { googleServicesFile: ANDROID_SERVICES } : {}),
    },
    ios: {
      ...config.ios,
      ...(hasIos ? { googleServicesFile: IOS_SERVICES } : {}),
    },
    plugins: [
      ...(config.plugins ?? []),
      ...(firebase
        ? [
            "@react-native-firebase/app",
            ["@react-native-firebase/analytics", { withoutAdIdSupport: true }],
            // RN Firebase needs static frameworks on iOS (rnfirebase.io → Expo).
            ["expo-build-properties", { ios: { useFrameworks: "static" } }],
          ]
        : []),
    ] as ExpoConfig["plugins"],
    extra: {
      ...config.extra,
      firebaseAnalytics: firebase,
    },
  };
};
