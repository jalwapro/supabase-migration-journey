import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Loader2, Trophy, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/games/daily-spin")({
  component: DailySpin,
});

type Prize = {
  id: string;
  label: string;
  kind: string;
  color: string;
  sort: number;
};
type SpinResult = {
  id: string;
  reward_kind: string;
  reward_amount: number;
  reward_label: string;
  granted_theme_id: string | null;
  next_spin_at: string;
  prize_id: string;
};

// Casino alternating palette (overrides DB color for consistent Vegas look)
const CASINO_COLORS = ["#b91c1c", "#f5c542", "#7f1d1d", "#eab308"];

function fmtLeft(ms: number) {
  if (ms <= 0) return "Ready!";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function LedRim({ count = 24 }: { count?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {Array.from({ length: count }).map((_, i) => {
        const angle = (360 / count) * i;
        return (
          <div
            key={i}
            className="absolute left-1/2 top-1/2"
            style={{ transform: `rotate(${angle}deg) translateY(-49%)` }}
          >
            <div
              className="h-2 w-2 -translate-x-1/2 rounded-full bg-[#fff2a8] shadow-[0_0_8px_2px_rgba(255,220,120,0.9)]"
              style={{ animation: `ledBlink 1.4s ${i * 0.08}s infinite ease-in-out` }}
            />
          </div>
        );
      })}
      <style>{`@keyframes ledBlink { 0%,100%{opacity:1} 50%{opacity:.35} }`}</style>
    </div>
  );
}

function DailySpin() {
  const { refresh } = useAuth();
  const qc = useQueryClient();
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [last, setLast] = useState<SpinResult | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const prizes = useQuery({
    queryKey: ["spin_prizes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spin_prizes")
        .select("id,label,kind,color,sort")
        .eq("is_active", true)
        .order("sort");
      if (error) throw error;
      return (data ?? []) as Prize[];
    },
  });

  const nextAt = useQuery({
    queryKey: ["next_spin_at"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("next_spin_at");
      if (error) throw error;
      return data as string | null;
    },
  });

  const spin = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("spin_daily_wheel");
      if (error) throw error;
      return data as SpinResult;
    },
    onSuccess: (r) => {
      const list = prizes.data ?? [];
      const idx = Math.max(0, list.findIndex((p) => p.id === r.prize_id));
      const seg = 360 / list.length;
      const target = 360 * 6 + (360 - (idx * seg + seg / 2));
      setSpinning(true);
      setRotation((prev) => prev + target);
      setTimeout(async () => {
        setSpinning(false);
        setLast(r);
        toast.success(`You won: ${r.reward_label}!`);
        await refresh();
        qc.invalidateQueries({ queryKey: ["next_spin_at"] });
      }, 4200);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const readyAt = nextAt.data ? new Date(nextAt.data).getTime() : 0;
  const remaining = readyAt - now;
  const ready = remaining <= 0;
  const list = prizes.data ?? [];

  return (
    <>
      <div
        className="min-h-screen pb-24"
        style={{
          background:
            "radial-gradient(circle at 50% 20%, #4a0d10 0%, #1a0405 55%, #050101 100%)",
        }}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 pt-4">
          <Link
            to="/games"
            aria-label="Back"
            className="grid h-10 w-10 place-items-center rounded-full border border-[#f5c542]/40 bg-black/40 text-[#f5c542]"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="rounded-full border border-[#f5c542]/40 bg-black/60 px-3 py-1 text-xs font-bold text-[#f5c542]">
            🪙 Daily Bonus
          </div>
        </div>

        {/* Title */}
        <div className="mt-4 text-center">
          <h1
            className="font-serif text-5xl font-black leading-none tracking-tight"
            style={{
              background: "linear-gradient(180deg,#fff2a8 0%,#f5c542 45%,#a06a10 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              textShadow: "0 2px 12px rgba(245,197,66,0.35)",
            }}
          >
            LUCKY
          </h1>
          <h1
            className="-mt-1 font-serif text-5xl font-black leading-none tracking-tight"
            style={{
              background: "linear-gradient(180deg,#fff2a8 0%,#f5c542 45%,#a06a10 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              textShadow: "0 2px 12px rgba(245,197,66,0.35)",
            }}
          >
            WHEEL
          </h1>
          <div className="mx-auto mt-2 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-[#f5c542]/80">
            <span>✦</span>
            <span>Spin daily · Win big</span>
            <span>✦</span>
          </div>
        </div>

        {/* Wheel */}
        <div className="mt-6 px-4">
          <div className="relative mx-auto aspect-square w-80 max-w-full">
            {/* Outer gold ring w/ LED bulbs */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  "conic-gradient(from 0deg, #8a5a10, #f5c542, #8a5a10, #f5c542, #8a5a10, #f5c542, #8a5a10)",
                boxShadow:
                  "0 0 80px -10px rgba(245,197,66,0.6), inset 0 0 20px rgba(0,0,0,0.4)",
              }}
            />
            <div className="absolute inset-[4%] rounded-full bg-[#1a0405]" />
            <LedRim count={24} />

            {/* Pointer */}
            <div className="absolute left-1/2 top-[2%] z-20 -translate-x-1/2">
              <div
                className="h-0 w-0 border-x-[14px] border-t-[24px] border-x-transparent"
                style={{ borderTopColor: "#f5c542", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.6))" }}
              />
              <div className="mx-auto -mt-1 h-3 w-3 rounded-full bg-[#dc2626] shadow-[0_0_8px_rgba(220,38,38,0.9)]" />
            </div>

            {/* Segments */}
            <div
              className="absolute inset-[9%] rounded-full border-2 border-[#f5c542]/60 transition-transform"
              style={{
                transform: `rotate(${rotation}deg)`,
                transitionDuration: spinning ? "4s" : "0.4s",
                transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                background:
                  list.length > 0
                    ? `conic-gradient(${list
                        .map((_, i) => {
                          const seg = 360 / list.length;
                          const c = CASINO_COLORS[i % CASINO_COLORS.length];
                          return `${c} ${i * seg}deg ${(i + 1) * seg}deg`;
                        })
                        .join(",")})`
                    : "conic-gradient(#333 0deg 360deg)",
                boxShadow: "inset 0 0 30px rgba(0,0,0,0.5)",
              }}
            >
              {/* segment dividers */}
              {list.map((_, i) => {
                const seg = 360 / list.length;
                return (
                  <div
                    key={`div-${i}`}
                    className="pointer-events-none absolute inset-0"
                    style={{ transform: `rotate(${i * seg}deg)` }}
                  >
                    <div className="absolute left-1/2 top-0 h-1/2 w-px -translate-x-1/2 bg-[#f5c542]/70" />
                  </div>
                );
              })}

              {/* labels — radial center */}
              {list.map((p, i) => {
                const seg = 360 / list.length;
                const angle = i * seg + seg / 2;
                return (
                  <div
                    key={p.id}
                    className="pointer-events-none absolute inset-0"
                    style={{ transform: `rotate(${angle}deg)` }}
                  >
                    <div
                      className="absolute left-1/2 top-[10%] -translate-x-1/2 text-center text-[11px] font-black uppercase leading-tight tracking-wide text-[#fff8dc] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                      style={{ maxWidth: "70px" }}
                    >
                      {p.label}
                    </div>
                  </div>
                );
              })}

              {/* Center hub */}
              <div
                className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-[#f5c542] text-2xl shadow-[0_0_20px_rgba(245,197,66,0.6)]"
                style={{
                  background: "radial-gradient(circle,#7f1d1d 0%,#3a0808 100%)",
                }}
              >
                ⭐
              </div>
            </div>
          </div>

          {last && (
            <p className="mt-4 text-center text-sm font-bold text-[#f5c542]">
              🎉 You won: {last.reward_label}
            </p>
          )}

          {/* Spin CTA */}
          <div className="mt-6">
            {ready ? (
              <button
                onClick={() => spin.mutate()}
                disabled={spinning || spin.isPending || list.length === 0}
                className="relative flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#f5c542] py-4 text-lg font-black uppercase tracking-[0.3em] text-[#fff8dc] shadow-[0_6px_0_#5a0808,0_10px_30px_rgba(220,38,38,0.5)] transition-all active:translate-y-1 active:shadow-[0_2px_0_#5a0808] disabled:opacity-50"
                style={{
                  background:
                    "linear-gradient(180deg,#dc2626 0%,#991b1b 50%,#7f1d1d 100%)",
                  textShadow: "0 2px 4px rgba(0,0,0,0.6)",
                }}
              >
                {spinning || spin.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : null}
                Spin
              </button>
            ) : (
              <div className="rounded-2xl border border-[#f5c542]/40 bg-black/60 px-4 py-3 text-center">
                <p className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.3em] text-[#f5c542]/80">
                  <Clock className="h-3 w-3" /> Next free spin in
                </p>
                <p className="mt-1 font-mono text-2xl font-black text-[#f5c542]">
                  {fmtLeft(remaining)}
                </p>
              </div>
            )}
          </div>

          {/* Prizes */}
          <div className="mt-5 rounded-2xl border border-[#f5c542]/30 bg-black/50 p-4">
            <p className="mb-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.3em] text-[#f5c542]">
              <Trophy className="h-3 w-3" /> Prizes on the wheel
            </p>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              {list.map((p, i) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 rounded-lg border border-[#f5c542]/20 bg-gradient-to-r from-[#2a0708] to-[#1a0405] px-2.5 py-2"
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full border border-[#f5c542]/50"
                    style={{ background: CASINO_COLORS[i % CASINO_COLORS.length] }}
                  />
                  <span className="truncate font-bold text-[#fff8dc]">{p.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <BottomNav />
    </>
  );
}
