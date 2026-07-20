import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { TheatreCard, TheatreDivider, TheatreRow } from "@/components/theatre/TheatreCard";
import { Trophy, Swords } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pk-history")({ component: Page });

function Page() {
  const { user } = useAuth();
  const { data: battles } = useQuery({
    queryKey: ["pk", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("pk_battles")
        .select("*")
        .eq("host_id", user!.id)
        .order("started_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const wins = (battles ?? []).filter((b) => b.result === "win").length;
  const losses = (battles ?? []).filter((b) => b.result === "loss").length;
  const draws = (battles ?? []).filter((b) => b.result === "draw").length;

  return (
    <>
      <AppShell title="PK History">
        <TheatreCard>
          <div className="px-6 pt-8 pb-4 text-center">
            <div className="relative mx-auto w-fit">
              <Swords
                className="h-12 w-12 text-[#ffd66a] drop-shadow-[0_0_16px_rgba(255,200,80,0.9)]"
                strokeWidth={2}
              />
              <div className="absolute -inset-3 rounded-full bg-[#ffd66a]/25 blur-2xl" />
            </div>
            <p className="mt-3 text-xl font-black tracking-wide text-white">Battle Record</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-[#ffcf6a]/70">
              Your last 50 PK matches
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 px-4 pb-2">
            <Stat label="Wins" value={wins} tone="win" />
            <Stat label="Losses" value={losses} tone="loss" />
            <Stat label="Draws" value={draws} tone="draw" />
          </div>

          <TheatreDivider label="Matches" />

          <div className="space-y-2 px-3 pt-5 pb-6">
            {(battles ?? []).map((b) => (
              <TheatreRow key={b.id}>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-bold text-white">{b.room_title}</p>
                  <ResultBadge result={b.result} />
                </div>
                <p className="mt-1 text-[11px] text-white/70">
                  You{" "}
                  <span className="font-black text-[#ffcf6a]">
                    {b.my_score.toLocaleString()}
                  </span>{" "}
                  vs {b.opponent_name}{" "}
                  <span className="font-black text-white/80">
                    {b.opponent_score.toLocaleString()}
                  </span>
                </p>
                <p className="text-[10px] text-white/45">
                  {new Date(b.started_at).toLocaleString()}
                </p>
              </TheatreRow>
            ))}
            {(battles ?? []).length === 0 && (
              <div className="py-10 text-center">
                <Trophy className="mx-auto mb-2 h-8 w-8 text-[#ffcf6a]/40" />
                <p className="text-xs text-white/50">No PK battles yet</p>
              </div>
            )}
          </div>
        </TheatreCard>
      </AppShell>
      <BottomNav />
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "win" | "loss" | "draw" }) {
  const colors =
    tone === "win"
      ? { text: "text-[#7dffb0]", from: "#0f3a1e", to: "#082010" }
      : tone === "loss"
      ? { text: "text-[#ff8fa0]", from: "#3a0f18", to: "#20080d" }
      : { text: "text-[#ffcf6a]", from: "#3a2810", to: "#20140a" };
  return (
    <div
      className="rounded-2xl border border-[#ffcf6a]/20 py-3 text-center"
      style={{ background: `linear-gradient(180deg,${colors.from},${colors.to})` }}
    >
      <p className={`text-2xl font-black ${colors.text} drop-shadow-[0_0_10px_currentColor]`}>{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">{label}</p>
    </div>
  );
}

function ResultBadge({ result }: { result: string }) {
  const style =
    result === "win"
      ? "bg-emerald-500/25 text-emerald-300 border-emerald-400/40"
      : result === "loss"
      ? "bg-red-500/25 text-red-300 border-red-400/40"
      : "bg-white/10 text-white/60 border-white/20";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${style}`}>
      {result}
    </span>
  );
}
