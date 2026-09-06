import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@guideless/types";

/**
 * Mobile Supabase client. Anon key only — every query is subject to RLS.
 * The service role key must NEVER appear in this app.
 *
 * Do not scatter raw queries through components. Feature modules under src/lib/
 * (trips/, chat/, support/, …) wrap this client behind small service functions.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to apps/mobile/.env.",
  );
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Deep links (guideless://…) complete OAuth / magic-link flows; no URL session detection.
    detectSessionInUrl: false,
  },
});
