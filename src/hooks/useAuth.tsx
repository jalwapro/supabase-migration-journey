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
import { getDevicePosition } from "@/lib/device-location";

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
  country_code?: string | null;
  city?: string | null;
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

export type AppRole = "user" | "host" | "agent" | "moderator" | "finance_operator" | "admin" | "super_admin";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  adminPermissions: string[];
  canAccessAdmin: boolean;
  isAdmin: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function isStudioPreview(): boolean {
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).get("studioPreview") === "1";
}

function demoProfile(userId: string): Profile {
  return {
    id: userId, username: "Jalwa User", full_name: "Jalwa User", avatar: null, frame: null,
    ring: null, bubble: null, car: null, entrance: null, special_id: null, data_card: null,
    bio: null, gender: null, country: "Pakistan", coins: 12500, diamonds: 2500, level: 12,
    xp: 2400, is_vip: false, vip_expiry: null, vip_level: 0, status: "online", theme_id: null,
    frame_expires_at: null, is_free: false, user_code: "JALWA001", last_seen: new Date().toISOString(),
  };
}

async function loadProfile(userId: string): Promise<Profile | null> {
  if (isStudioPreview()) return demoProfile(userId);
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) {
    console.error("[useAuth] loadProfile", error);
    return null;
  }
  return (data as Profile | null) ?? null;
}

async function loadRoles(userId: string): Promise<AppRole[]> {
  if (isStudioPreview()) return ["user"];
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) {
    console.error("[useAuth] loadRoles", error);
    return [];
  }
  return (data ?? []).map((r) => r.role as AppRole);
}

async function loadAdminPermissions(): Promise<string[]> {
  if (isStudioPreview()) return [];
  const { data, error } = await supabase.rpc("get_my_admin_permissions");
  if (error) {
    console.error("[useAuth] loadAdminPermissions", error);
    return [];
  }
  return Array.isArray(data) ? data.filter((value): value is string => typeof value === "string") : [];
}

const IDLE_LOGOUT_MS = 7 * 24 * 60 * 60 * 1000;

/** End only rooms owned by this account before revoking its active session. */
async function endOwnedRooms(userId: string): Promise<void> {
  try {
    const { data, error } = await supabase
      .from("live_rooms")
      .select("id")
      .eq("host_id", userId)
      .in("status", ["live", "host_disconnected"])
      .limit(20);
    if (error) throw error;
    for (const room of data ?? []) {
      const { error: endError } = await supabase.rpc("end_room", { _room_id: room.id });
      if (endError) console.warn("[useAuth] unable to end owned room before logout", room.id, endError);
    }
  } catch (error) {
    // Do not trap a user in their account when connectivity or RLS is unavailable.
    // The database inactivity reaper is the fallback for rooms that could not be ended.
    console.warn("[useAuth] endOwnedRooms", error);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastHeartbeatAtRef = useRef(0);
  const hydrateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrateTokenRef = useRef(0);
  const initialSessionLoadedRef = useRef(false);

  const user = session?.user ?? null;
  const SUPER_ADMIN_EMAILS = ["jalwaapplive@gmail.com"];
  const isAdmin = !isStudioPreview() && (roles.includes("admin") || roles.includes("super_admin") || (user?.email ? SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase()) : false));
  const canAccessAdmin = !isStudioPreview() && adminPermissions.includes("dashboard.view");

  const hydrate = useCallback(async (nextSession: Session | null, enforceIdleTimeout = false) => {
    setSession(nextSession);
    if (hydrateTimerRef.current) {
      clearTimeout(hydrateTimerRef.current);
      hydrateTimerRef.current = null;
    }
    const token = ++hydrateTokenRef.current;
    if (!nextSession?.user) {
      setProfile(null);
      setRoles([]);
      setAdminPermissions([]);
      setLoading(false);
      return;
    }
    const uid = nextSession.user.id;
    hydrateTimerRef.current = setTimeout(async () => {
      const [p, r, permissions] = await Promise.all([loadProfile(uid), loadRoles(uid), loadAdminPermissions()]);
      if (token !== hydrateTokenRef.current) return;
      if (p?.status === "banned") {
        try {
          localStorage.setItem("jalwa_ban_notice", JSON.stringify({
            userId: uid, email: nextSession.user.email ?? "",
            reason: (p as Profile & { ban_reason?: string | null }).ban_reason ?? "",
          }));
        } catch {}
        await endOwnedRooms(uid);
        await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
        setRoles([]);
        setAdminPermissions([]);
        setLoading(false);
        if (typeof window !== "undefined" && window.location.pathname !== "/auth") {
          window.location.replace("/auth?reason=banned");
        }
        return;
      }

      // Only enforce the inactivity window when restoring an existing persisted
      // session at app startup. A fresh, explicit login must never be rejected
      // because this account's previous last_seen value is old.
      const lastSeenMs = p?.last_seen ? Date.parse(p.last_seen) : NaN;
      if (enforceIdleTimeout && Number.isFinite(lastSeenMs) && Date.now() - lastSeenMs >= IDLE_LOGOUT_MS) {
        await endOwnedRooms(uid);
        await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
        setRoles([]);
        setAdminPermissions([]);
        setLoading(false);
        if (typeof window !== "undefined" && window.location.pathname !== "/auth") {
          window.location.replace("/auth?reason=inactive");
        }
        return;
      }

      setProfile(p);
      setRoles(r);
      setAdminPermissions(permissions);
      setLoading(false);
    }, 0);
  }, []);

  const loadInitialSession = useCallback(async () => {
    let nextSession: Session | null = null;
    try {
      const { data } = await supabase.auth.getSession();
      nextSession = data.session;
    } catch (error) {
      console.warn("[useAuth] initial session", error);
    }
    initialSessionLoadedRef.current = true;
    await hydrate(nextSession, true);
  }, [hydrate]);

  const refresh = useCallback(async () => {
    if (!user) return;
    const [p, r, permissions] = await Promise.all([loadProfile(user.id), loadRoles(user.id), loadAdminPermissions()]);
    setProfile(p);
    setRoles(r);
    setAdminPermissions(permissions);
  }, [user]);

  // Automatically detect a coarse country/city for signed-in profiles using
  // Capacitor's native GPS bridge on Android and browser geolocation on web.
  useEffect(() => {
    if (!user || !profile || profile.country || profile.country_code || isStudioPreview()) return;
    let cancelled = false;
    void (async () => {
      try {
        const position = await getDevicePosition({
          enableHighAccuracy: false,
          timeout: 12000,
          maximumAge: 300000,
        });
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${position.coords.latitude}&lon=${position.coords.longitude}&zoom=10&addressdetails=1`;
        const response = await fetch(url, { headers: { Accept: "application/json" } });
        if (!response.ok) return;
        const result = await response.json();
        if (cancelled) return;
        const address = result?.address ?? {};
        const detectedCountry = typeof address.country === "string" ? address.country : "";
        const detectedCode = typeof address.country_code === "string" ? address.country_code.toUpperCase() : "";
        const detectedCity = typeof (address.city ?? address.town ?? address.village ?? address.municipality ?? address.county) === "string"
          ? (address.city ?? address.town ?? address.village ?? address.municipality ?? address.county) as string
          : null;
        if (!detectedCountry || !detectedCode) return;
        const { error } = await supabase.from("profiles").update({
          country: detectedCountry,
          country_code: detectedCode,
          city: detectedCity,
        }).eq("id", user.id);
        if (error) {
          console.warn("[useAuth] initial GPS country save", error);
          return;
        }
        if (!cancelled) await refresh();
      } catch (error) {
        if (!cancelled) console.warn("[useAuth] GPS country detection", error);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, profile?.id, profile?.country, profile?.country_code, refresh]);

  const signOut = useCallback(async () => {
    if (user?.id) await endOwnedRooms(user.id);
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("[useAuth] signOut", e);
    }
    setSession(null);
    setProfile(null);
    setRoles([]);
    setAdminPermissions([]);
    if (typeof window !== "undefined") window.location.replace("/auth");
  }, [user?.id]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // loadInitialSession performs the one startup restore and idle-timeout check.
      if (event === "INITIAL_SESSION") return;
      void hydrate(s);
    });
    void loadInitialSession();
    return () => sub.subscription.unsubscribe();
  }, [hydrate, loadInitialSession]);

  useEffect(() => {
    if (loading || !user || isStudioPreview()) {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
      return;
    }
    const enforceBan = (reason?: string | null) => {
      try {
        localStorage.setItem("jalwa_ban_notice", JSON.stringify({ userId: user.id, email: user.email ?? "", reason: reason ?? "" }));
      } catch {}
      void supabase.auth.signOut();
      setSession(null);
      setProfile(null);
      setRoles([]);
      setAdminPermissions([]);
      if (typeof window !== "undefined" && window.location.pathname !== "/auth") window.location.replace("/auth?reason=banned");
    };
    const banChannel = supabase.channel(`auth-ban-status:${user.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` }, (payload) => {
        const updated = payload.new as { status?: string; ban_reason?: string | null; coins?: number | null; diamonds?: number | null };
        if (updated.status === "banned") {
          enforceBan(updated.ban_reason);
          return;
        }
        // Keep the visible wallet balance in sync with atomic server-side coin transfers.
        // Return the existing object when balances did not change to avoid extra app-wide renders.
        setProfile((previous) => {
          if (!previous) return previous;
          const coins = typeof updated.coins === "number" ? updated.coins : previous.coins;
          const diamonds = typeof updated.diamonds === "number" ? updated.diamonds : previous.diamonds;
          if (coins === previous.coins && diamonds === previous.diamonds) return previous;
          return { ...previous, coins, diamonds };
        });
      }).subscribe();

    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      const now = Date.now();
      if (now - lastHeartbeatAtRef.current < 30_000) return;
      lastHeartbeatAtRef.current = now;
      const seenAt = new Date(now).toISOString();
      supabase.from("profiles").update({ last_seen: seenAt }).eq("id", user.id).then(({ error }) => {
        if (error) console.warn("[useAuth] heartbeat", error);
      });
      supabase.rpc("touch_presence").then(({ error }) => {
        if (error) console.warn("[useAuth] presence", error);
      });
    };
    lastHeartbeatAtRef.current = 0;
    heartbeatRef.current = setInterval(tick, 90_000);
    const onFocus = () => tick();
    const onVisible = () => { if (document.visibilityState === "visible") tick(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
      lastHeartbeatAtRef.current = 0;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(banChannel);
    };
  }, [user, loading]);

  return <AuthContext.Provider value={{ session, user, profile, roles, adminPermissions, canAccessAdmin, isAdmin, loading, refresh, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
