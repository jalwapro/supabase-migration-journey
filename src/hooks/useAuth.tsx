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
  bio: string | null;
  gender: string | null;
  country: string | null;
  coins: number;
  diamonds: number;
  level: number;
  xp: number;
  is_vip: boolean;
  vip_expiry: string | null;
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

  const user = session?.user ?? null;
  const isAdmin = roles.includes("admin") || roles.includes("super_admin");

  const hydrate = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    if (!nextSession?.user) {
      setProfile(null);
      setRoles([]);
      return;
    }
    const uid = nextSession.user.id;
    // Defer supabase queries to avoid deadlock inside onAuthStateChange callback
    setTimeout(async () => {
      const [p, r] = await Promise.all([loadProfile(uid), loadRoles(uid)]);
      setProfile(p);
      setRoles(r);
    }, 0);
  }, []);

  const refresh = useCallback(async () => {
    if (!user) return;
    const [p, r] = await Promise.all([loadProfile(user.id), loadRoles(user.id)]);
    setProfile(p);
    setRoles(r);
  }, [user]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  useEffect(() => {
    // 1. Subscribe FIRST so we don't miss any events
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      void hydrate(s);
    });
    // 2. Then check current session
    supabase.auth.getSession().then(({ data }) => {
      void hydrate(data.session);
      setLoading(false);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [hydrate]);

  // Presence heartbeat — update last_seen every 30s while signed in
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
    };
    tick();
    heartbeatRef.current = setInterval(tick, 30_000);
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
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
