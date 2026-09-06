import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { identify, reset } from "@/lib/analytics";
import { supabase } from "@/lib/supabase";

interface SessionState {
  session: Session | null;
  user: User | null;
  /** false until the persisted session has been read from AsyncStorage. */
  ready: boolean;
}

const SessionContext = createContext<SessionState>({ session: null, user: null, ready: false });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ session: null, user: null, ready: false });

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setState({ session: data.session, user: data.session?.user ?? null, ready: true });
      if (data.session?.user) identify(data.session.user.id);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      setState({ session, user: session?.user ?? null, ready: true });
      // Product analytics identity follows the auth session (ids only, never PII).
      if (event === "SIGNED_IN" && session?.user) identify(session.user.id);
      if (event === "SIGNED_OUT") reset();
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  return useContext(SessionContext);
}
