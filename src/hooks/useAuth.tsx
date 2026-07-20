import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar: string | null;
  frame: string | null;
  ring: string | null;
  bubble: string | null;
  car: string | null;
  entrance: string | null;
  special_id: string | null;
  data_card: string | null;
  bio: string | null;
  gender: string | null;
  country: string | null;
  coins: number;
  diamonds: number;
  level: number;
  xp: number;
  is_vip: boolean;
  vip_expiry: string | null;
  vip_level: number;
  status: string;
  theme_id: string | null;
  frame_expires_at: string | null;
  is_free: boolean;
  user_code: string | null;
  last_seen: string | null;
};

export type AppRole =
  | "user"
  | "host"
  | "agent"
  | "moderator"
  | "admin"
  | "super_admin";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  isAdmin: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function loadProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.error("[useAuth] loadProfile", error);
    return null;
  }
  return (data as Profile | null) ?? null;
}

async function loadRoles(userId: string): Promise<AppRole[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) {
    console.error("[useAuth] loadRoles", error);
    return [];
  }
  return (data ?? []).map((r) => r.role as AppRole);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hydrateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrateTokenRef = useRef(0);
  const initialSessionLoadedRef = useRef(false);

  const user = session?.user ?? null;
  const SUPER_ADMIN_EMAILS = ["jalwaapplive@gmail.com"];
  const isAdmin =
    roles.includes("admin") ||
    roles.includes("super_admin") ||
    (user?.email ? SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase()) : false);

  const hydrate = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    // Cancel any in-flight hydrate — otherwise a stale user's roles can
    // overwrite the freshly-signed-in user's state.
    if (hydrateTimerRef.current) {
      clearTimeout(hydrateTimerRef.current);
      hydrateTimerRef.current = null;
    }
    const token = ++hydrateTokenRef.current;
    if (!nextSession?.user) {
      setProfile(null);
      setRoles([]);
      return;
    }
    const uid = nextSession.user.id;
    // Defer supabase queries to avoid deadlock inside onAuthStateChange callback
    hydrateTimerRef.current = setTimeout(async () => {
      const [p, r] = await Promise.all([loadProfile(uid), loadRoles(uid)]);
      // Only apply if this call is still the latest.
      if (token !== hydrateTokenRef.current) return;
      setProfile(p);
      setRoles(r);
    }, 0);
  }, []);

  const loadInitialSession = useCallback(async () => {
    let nextSession: Session | null = null;
    for (const delay of [0, 150, 350, 700, 1200]) {
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      try {
        const { data } = await supabase.auth.getSession();
        nextSession = data.session;
        if (nextSession?.user) break;
      } catch (error) {
        console.warn("[useAuth] initial session", error);
      }
    }

    // Session persists until the user explicitly signs out.


    initialSessionLoadedRef.current = true;
    await hydrate(nextSession);
    setLoading(false);
  }, [hydrate]);


  const refresh = useCallback(async () => {
    if (!user) return;
    const [p, r] = await Promise.all([loadProfile(user.id), loadRoles(user.id)]);
    setProfile(p);
    setRoles(r);
  }, [user]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("[useAuth] signOut", e);
    }
    setSession(null);
    setProfile(null);
    setRoles([]);
    if (typeof window !== "undefined") {
      window.location.replace("/auth");
    }
  }, []);

  useEffect(() => {
    // 1. Subscribe FIRST so we don't miss any events
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // On a hard refresh, Supabase can emit INITIAL_SESSION before slow
      // mobile/native storage has returned the saved token. Let our retrying
      // loader decide first so the UI doesn't briefly become signed out.
      if (event === "INITIAL_SESSION" && !s && !initialSessionLoadedRef.current) return;
      void hydrate(s);
      if (event !== "SIGNED_OUT") setLoading(false);
    });
    // 2. Then check current session
    void loadInitialSession();
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [hydrate, loadInitialSession]);

  // Presence heartbeat — update profiles.last_seen AND user_presence every
  // 15s + on focus/visibility. user_presence powers online-only gates
  // (challenge picker, invites); profiles.last_seen powers list ordering.
  useEffect(() => {
    if (!user) {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
      return;
    }
    const tick = () => {
      supabase
        .from("profiles")
        .update({ last_seen: new Date().toISOString() })
        .eq("id", user.id)
        .then(({ error }) => {
          if (error) console.warn("[useAuth] heartbeat", error);
        });
      supabase.rpc("touch_presence").then(({ error }) => {
        if (error) console.warn("[useAuth] presence", error);
      });
    };
    tick();
    heartbeatRef.current = setInterval(tick, 15_000);
    const onFocus = () => tick();
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user]);

  return (
    <AuthContext.Provider
      value={{ session, user, profile, roles, isAdmin, loading, refresh, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
