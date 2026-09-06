import * as Linking from "expo-linking";
import { supabase } from "@/lib/supabase";

/** Deep link Supabase redirects back to after a magic link / OAuth. Registered as `guideless://`. */
export function authRedirectUrl(): string {
  return Linking.createURL("/auth/callback");
}

const friendly = (message: string): string => {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "That email and password don't match.";
  if (m.includes("rate limit")) return "Too many attempts. Wait a minute and try again.";
  if (m.includes("registered"))
    return "There is already an account for that email. Sign in instead.";
  if (m.includes("network")) return "You seem to be offline. Try again when you have signal.";
  return "Something went wrong. Please try again.";
};

export const authService = {
  async signInWithPassword(email: string, password: string): Promise<{ error?: string }> {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    return error ? { error: friendly(error.message) } : {};
  },

  async signUp(
    email: string,
    password: string,
    fullName: string,
  ): Promise<{ error?: string; needsConfirmation?: boolean }> {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { full_name: fullName.trim() }, emailRedirectTo: authRedirectUrl() },
    });
    if (error) return { error: friendly(error.message) };
    return { needsConfirmation: !data.session };
  },

  async sendMagicLink(email: string): Promise<{ error?: string }> {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: authRedirectUrl() },
    });
    return error ? { error: friendly(error.message) } : {};
  },

  /**
   * Completes a magic-link / confirmation deep link. Supabase may send a PKCE `code` or, for
   * implicit flows, `access_token` + `refresh_token` in the URL fragment.
   */
  async completeFromUrl(url: string): Promise<{ error?: string }> {
    const parsed = Linking.parse(url);
    const params = { ...(parsed.queryParams ?? {}) } as Record<string, string | undefined>;
    const hash = url.split("#")[1];
    if (hash) for (const [k, v] of new URLSearchParams(hash)) params[k] = v;

    if (params.code) {
      const { error } = await supabase.auth.exchangeCodeForSession(params.code);
      return error ? { error: "That sign-in link has expired or was already used." } : {};
    }
    if (params.access_token && params.refresh_token) {
      const { error } = await supabase.auth.setSession({
        access_token: params.access_token,
        refresh_token: params.refresh_token,
      });
      return error ? { error: "That sign-in link has expired or was already used." } : {};
    }
    return { error: "That link didn't contain a sign-in code." };
  },

  async signOut(): Promise<void> {
    await supabase.auth.signOut();
  },
};
