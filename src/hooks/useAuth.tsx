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
import {
  isStudioPreview,
  STUDIO_PREVIEW_SESSION,
  STUDIO_PREVIEW_USER,
  STUDIO_PREVIEW_PROFILE,
} from "@/lib/studio-preview";

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
  const preview = isStudioPreview();
  const [session, setSession] = useState<Session | null>(preview ? STUDIO_PREVIEW_SESSION : null);
  const [profile, setProfile] = useState<Profile | null>(preview ? (STUDIO_PREVIEW_PROFILE as Profile) : null);
  const [roles, setRoles] = useState<AppRole[]>(preview ? ["user"] : []);
  const [loading, setLoading] = useState(!preview);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hydrateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrateTokenRef = useRef(0);
  const initialSessionLoadedRef = useRef(false);

  const user = session?.user ?? null;
  const SUPER_ADMIN_EMAILS = ["jalwaapplive@gmail.com"];
  const isAdmin =
    !preview && (
      roles.includes("admin") ||
      roles.includes("super_admin") ||
      (user?.email ? SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase()) : false)
    );

  const hydrate = useCallback(async (nextSession: Session | null) => {
    if (isStudioPreview()) {
      setSession(STUDIO_PREVIEW_SESSION);
      setProfile(STUDIO_PREVIEW_PROFILE as Profile);
      setRoles(["user"]);
      setLoading(false);
      return;
    }
    setSession(nextSession);
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
    hydrateTimerRef.current = setTimeout(async () => {
      const [p, r] = await Promise.all([loadProfile(uid), loadRoles(uid)]);
      if (token !== hydrateTokenRef.current) return;
      setProfile(p);
      setRoles(r);
      if (p && !p.country) {
        try {
          const res = await fetch("https://ipapi.co/json/");
          if (res.ok) {
            const j = await res.json();
            const cn = (j?.country_name as string | undefined)?.trim();
            if (cn) {
              const { error: upErr } = await supabase
                .from("profiles").update({ country: cn }).eq("id", uid);
              if (!upErr && token === hydrateTokenRef.current) {
                setProfile((prev) => (prev ? { ...prev, country: cn } : prev));
              }
            }
          }
        } catch (e) {
          console.warn("[useAuth] country detect", e);
        }
      }
    }, 0);
  }, []);

  const loadInitialSession = useCallback(async () => {
    if (isStudioPreview()) {
      initialSessionLoadedRef.current = true;
      setSession(STUDIO_PREVIEW_SESSION);
      setProfile(STUDIO_PREVIEW_PROFILE as Profile);
      setRoles(["user"]);
      setLoading(false);
      return;
    }
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
    initialSessionLoadedRef.current = true;
    await hydrate(nextSession);
    setLoading(false);
  }, [hydrate]);

  const refresh = useCallback(async () => {
    if (isStudioPreview()) {
      setSession(STUDIO_PREVIEW_SESSION);
      setProfile(STUDIO_PREVIEW_PROFILE as Profile);
      setRoles(["user"]);
      return;
    }
    if (!user) return;
    const [p, r] = await Promise.all([loadProfile(user.id), loadRoles(user.id)]);
    setProfile(p);
    setRoles(r);
  }, [user]);

  const signOut = useCallback(async () => {
    if (isStudioPreview()) return;
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("[useAuth] signOut", e);
    }
    setSession(null);
    setProfile(null);
    setRoles([]);
    if (typeof window !== "undefined") window.location.replace("/auth");
  }, []);

  useEffect(() => {
    if (isStudioPreview()) {
      setSession(STUDIO_PREVIEW_SESSION);
      setProfile(STUDIO_PREVIEW_PROFILE as Profile);
      setRoles(["user"]);
      setLoading(false);
      return;
    }
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "INITIAL_SESSION" && !s && !initialSessionLoadedRef.current) return;
      void hydrate(s);
      if (event !== "SIGNED_OUT") setLoading(false);
    });
    void loadInitialSession();
    return () => sub.subscription.unsubscribe();
  }, [hydrate, loadInitialSession]);

  useEffect(() => {
    if (isStudioPreview() || !user) {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
      return;
    }
    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
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
    const onVisible = () => { if (document.visibilityState === "visible") tick(); };
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
    <AuthContext.Provider value={{ session, user, profile, roles, isAdmin, loading, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
