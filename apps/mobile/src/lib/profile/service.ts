import type { Tables } from "@guideless/types";
import { supabase } from "@/lib/supabase";

export type Profile = Tables<"profiles">;
export type NotificationPrefs = Tables<"notification_preferences">;

const DEFAULT_PREFS: Omit<NotificationPrefs, "user_id" | "updated_at"> = {
  operational_email: true,
  social_push: true,
  social_email: false,
  marketing_push: false,
  marketing_email: false,
  quiet_hours_start: null,
  quiet_hours_end: null,
};

export type ProfilePatch = Partial<
  Pick<
    Profile,
    | "display_name"
    | "bio"
    | "home_country"
    | "interests"
    | "travel_style"
    | "languages"
    | "show_home_country"
    | "show_bio"
    | "show_interests"
  >
>;

export const profileService = {
  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async updateProfile(userId: string, patch: ProfilePatch): Promise<void> {
    const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
    if (error) throw error;
  },

  async getPrefs(userId: string): Promise<NotificationPrefs> {
    const { data, error } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data ?? { user_id: userId, updated_at: new Date().toISOString(), ...DEFAULT_PREFS };
  },

  async updatePrefs(
    userId: string,
    patch: Partial<Omit<NotificationPrefs, "user_id" | "updated_at">>,
  ): Promise<void> {
    const { error } = await supabase
      .from("notification_preferences")
      .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
    if (error) throw error;
  },

  /** Your GL-XXXXXX code (created with the profile) and earned credit in the given currency. */
  async referral(
    userId: string,
    currency = "USD",
  ): Promise<{ code: string | null; credit: number }> {
    const [{ data: code }, { data: credit }] = await Promise.all([
      supabase.from("referral_codes").select("code").eq("user_id", userId).maybeSingle(),
      supabase.rpc("account_credit_balance", { p_user_id: userId, p_currency: currency }),
    ]);
    return { code: code?.code ?? null, credit: Number(credit ?? 0) };
  },
};
