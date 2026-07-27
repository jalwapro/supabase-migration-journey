import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

type Anim = {
  id: string;
  name: string;
  label: string;
  overlay_asset_url: string | null;
  bg_animation_url: string | null;
  duration_ms: number;
};

type Trigger = {
  id: string;
  user_id: string;
  room_id: string | null;
  animation_id: string | null;
  label_override: string | null;
  triggered_at: string;
};

type SpotlightEvent = Trigger & {
  anim: Anim | null;
  user: { username: string | null; avatar: string | null } | null;
};

export function ProfileSpotlight({ roomId }: { roomId: string }) {
  const [queue, setQueue] = useState<SpotlightEvent[]>([]);
  const currentRef = useRef<SpotlightEvent | null>(null);
  const [current, setCurrent] = useState<SpotlightEvent | null>(null);
  const animsRef = useRef<Map<string, Anim>>(new Map());

  // Preload animations
  useEffect(() => {
    void supabase
      .from("spotlight_animations")
      .select("id,name,label,overlay_asset_url,bg_animation_url,duration_ms")
      .eq("is_active", true)
      .then(({ data }) => {
        for (const a of (data ?? []) as Anim[]) animsRef.current.set(a.id, a);
      });
  }, []);

  // Realtime subscribe
  useEffect(() => {
    if (!roomId) return;
    const ch = supabase
      .channel(`spotlight-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "spotlight_triggers",
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          const t = payload.new as Trigger;
          // Ignore stale (> 60s old)
          if (Date.now() - new Date(t.triggered_at).getTime() > 60_000) return;
          const anim = t.animation_id ? animsRef.current.get(t.animation_id) ?? null : null;
          const { data: userRow } = await supabase
            .from("profiles")
            .select("username,avatar")
            .eq("id", t.user_id)
            .maybeSingle();
          setQueue((q) => [
            ...q,
            {
              ...t,
              anim,
              user: userRow as SpotlightEvent["user"],
            },
          ]);
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [roomId]);

  // Process queue
  useEffect(() => {
    if (currentRef.current || queue.length === 0) return;
    const next = queue[0];
    currentRef.current = next;
    setCurrent(next);
    setQueue((q) => q.slice(1));
    const dur = next.anim?.duration_ms ?? 3500;
    const timer = setTimeout(() => {
      currentRef.current = null;
      setCurrent(null);
    }, dur);
    return () => clearTimeout(timer);
  }, [queue]);

  if (!current) return null;

  const label = current.label_override ?? current.anim?.label ?? "🌟 Featured";
  const avatar = current.user?.avatar;
  const username = current.user?.username ?? "Star";

  return (
    <div
      data-jalwa-overlay="true"
      className="pointer-events-none fixed inset-0 z-[80] grid place-items-center"
      style={{ animation: "spotlightFade 0.4s ease-out" }}
    >
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" style={{ animation: "spotlightBg 0.5s ease-out" }} />

      {/* bg animation */}
      {current.anim?.bg_animation_url && (
        <video
          src={current.anim.bg_animation_url}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover opacity-70"
        />
      )}

      {/* aura */}
      <div className="absolute inset-0 grid place-items-center">
        <div
          className="h-[280px] w-[280px] rounded-full opacity-60"
          style={{
            background:
              "conic-gradient(from 0deg, #ffd700, #ff2d95, #a855f7, #ffd700)",
            filter: "blur(30px)",
            animation: "spotlightSpin 4s linear infinite",
          }}
        />
      </div>

      {/* Avatar + label */}
      <div className="relative flex flex-col items-center" style={{ animation: "spotlightPop 0.6s cubic-bezier(0.34,1.56,0.64,1)" }}>
        <div className="relative">
          {current.anim?.overlay_asset_url && (
            <img
              src={current.anim.overlay_asset_url}
              alt=""
              className="absolute -inset-4 h-[calc(100%+2rem)] w-[calc(100%+2rem)] object-contain"
              style={{ animation: "spotlightSpin 8s linear infinite" }}
            />
          )}
          <div className="relative h-40 w-40 overflow-hidden rounded-full border-4 border-amber-300 shadow-[0_0_80px_20px_rgba(255,215,0,0.6)]">
            {avatar ? (
              <img src={avatar} alt={username} className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center bg-gradient-to-br from-fuchsia-500 to-purple-800 text-5xl font-black text-white">
                {username.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
        </div>
        <div className="mt-4 rounded-full bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-400 px-6 py-2 text-lg font-black text-black shadow-2xl">
          {label}
        </div>
        <div className="mt-2 text-base font-black text-white drop-shadow-lg">@{username}</div>
      </div>

      <style>{`
        @keyframes spotlightFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes spotlightBg { from { opacity: 0 } to { opacity: 1 } }
        @keyframes spotlightPop {
          0% { transform: scale(0.3); opacity: 0 }
          60% { transform: scale(1.1); opacity: 1 }
          100% { transform: scale(1); opacity: 1 }
        }
        @keyframes spotlightSpin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  );
}
