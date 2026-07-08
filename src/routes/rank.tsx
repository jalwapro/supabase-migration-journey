import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { Crown, Trophy, Heart, Coins, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";


export const Route = createFileRoute("/rank")({
  component: RankPage,
  head: () => ({
    meta: [
      { title: "Leaderboard — Jalwa" },
      {
        name: "description",
        content:
          "See Jalwa's top hosts and gifters. Weekly, monthly, and all-time star rankings.",
      },
    ],
  }),
});

type Board = "hosts" | "gifters";
type Period = "weekly" | "monthly" | "alltime";

type Entry = {
  id: string;
  username: string | null;
  avatar: string | null;
  coins: number | null;
  vip_level?: number | null;
};

function RankPage() {
  const [board, setBoard] = useState<Board>("hosts");
  const [period, setPeriod] = useState<Period>("weekly");

  const q = useQuery({
    queryKey: ["rank", board, period],
    queryFn: async () => {
      // Try full select; if vip_level column missing, retry without it.
      let { data, error } = await supabase
        .from("profiles")
        .select("id,username,avatar,coins,vip_level")
        .order("coins", { ascending: false })
        .limit(50);
      if (error) {
        const res = await supabase
          .from("profiles")
          .select("id,username,avatar,coins")
          .order("coins", { ascending: false })
          .limit(50);
        if (res.error) throw res.error;
        data = res.data as unknown as typeof data;
      }
      return (data ?? []) as unknown as Entry[];
    },
    staleTime: 30_000,
  });


  const list = q.data ?? [];
  const top3 = list.slice(0, 3);
  const rest = list.slice(3);

  return (
    <>
      <AppShell title="Star Leaderboard" subtitle="Top hosts & gifters">
        <div className="px-4">
          <TopGiftersBanner />
        </div>

        {/* Board switch */}

        <div className="px-4 pt-3">
          <div className="glass flex rounded-full p-1">
            {(["hosts", "gifters"] as Board[]).map((b) => (
              <button
                key={b}
                onClick={() => setBoard(b)}
                className={`flex-1 rounded-full py-2 text-xs font-bold uppercase tracking-wider transition ${
                  board === b
                    ? "bg-gradient-to-r from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--secondary)] text-primary-foreground shadow-lg"
                    : "text-muted-foreground"
                }`}
              >
                {b === "hosts" ? "Hosts" : "Gifters"}
              </button>
            ))}
          </div>
        </div>

        {/* Period */}
        <div className="scrollbar-hide mt-3 flex gap-2 overflow-x-auto px-4">
          {(
            [
              { k: "weekly", label: "Weekly" },
              { k: "monthly", label: "Monthly" },
              { k: "alltime", label: "All-time" },
            ] as { k: Period; label: string }[]
          ).map((p) => {
            const active = period === p.k;
            return (
              <button
                key={p.k}
                onClick={() => setPeriod(p.k)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "bg-[color:var(--primary)]/20 text-[color:var(--primary)] ring-1 ring-[color:var(--primary)]/40"
                    : "border border-border bg-card/60 text-foreground/80"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Podium */}
        <section className="px-4 pt-5">
          {q.isLoading ? (
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-40 animate-pulse rounded-2xl bg-card/60" />
              ))}
            </div>
          ) : top3.length > 0 ? (
            <Podium top3={top3} />
          ) : null}
        </section>

        {/* List */}
        <section className="mt-4 px-4">
          {q.isLoading ? (
            <div className="glass grid place-items-center rounded-2xl p-8 text-xs text-muted-foreground">
              <Sparkles className="mb-2 h-5 w-5 animate-pulse text-[color:var(--primary)]" />
              Loading rankings…
            </div>
          ) : rest.length === 0 && top3.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center">
              <Trophy className="mx-auto h-8 w-8 text-[color:var(--gold)]" />
              <p className="mt-3 text-sm font-semibold">No rankings yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Be the first star this {period === "alltime" ? "season" : period.slice(0, -2)}.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {rest.map((e, i) => (
                <RankRow key={e.id} rank={i + 4} entry={e} />
              ))}
            </ul>
          )}
        </section>
      </AppShell>
      <BottomNav />
    </>
  );
}

function Podium({ top3 }: { top3: Entry[] }) {
  const { isAdmin } = useAuth();
  // Order visually: 2nd, 1st, 3rd
  const [first, second, third] = top3;
  const cells = [
    { e: second, place: 2, h: "h-28", ring: "ring-[color:var(--secondary)]" },
    { e: first, place: 1, h: "h-36", ring: "ring-[color:var(--gold)]" },
    { e: third, place: 3, h: "h-24", ring: "ring-[color:var(--primary)]" },
  ].filter((c) => c.e);

  return (
    <div className="grid grid-cols-3 items-end gap-2">
      {cells.map(({ e, place, h, ring }) => (
        <div key={place} className="flex flex-col items-center">
          <div className="relative">
            {place === 1 && (
              <Crown className="absolute -top-5 left-1/2 h-6 w-6 -translate-x-1/2 text-[color:var(--gold)] drop-shadow" />
            )}
            <div
              className={`grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-card ring-2 ${ring} ring-offset-2 ring-offset-background`}
            >
              {e.avatar ? (
                <img src={e.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-lg font-bold">
                  {(e.username ?? "?").slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
          </div>
          <p className="mt-2 max-w-full truncate text-xs font-bold">
            @{e.username ?? "user"}
          </p>
          {isAdmin && (
            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-[color:var(--gold)]">
              <Coins className="h-3 w-3" />
              {(e.coins ?? 0).toLocaleString()}
            </div>
          )}
          <div
            className={`mt-2 w-full ${h} rounded-t-2xl bg-gradient-to-t ${
              place === 1
                ? "from-[color:var(--gold)]/40 to-[color:var(--gold)]/10"
                : place === 2
                  ? "from-[color:var(--secondary)]/40 to-[color:var(--secondary)]/10"
                  : "from-[color:var(--primary)]/40 to-[color:var(--primary)]/10"
            } grid place-items-center border border-border`}
          >
            <span className="text-2xl font-black text-gradient">{place}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function RankRow({ rank, entry }: { rank: number; entry: Entry }) {
  const { isAdmin } = useAuth();
  return (
    <li className="glass flex items-center gap-3 rounded-2xl p-3">
      <div className="w-6 shrink-0 text-center text-sm font-bold text-muted-foreground">
        {rank}
      </div>
      <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-card ring-1 ring-border">
        {entry.avatar ? (
          <img src={entry.avatar} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-sm font-bold">
            {(entry.username ?? "?").slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{entry.username ?? "user"}</p>
        {isAdmin && (
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Heart className="h-3 w-3 text-[color:var(--primary)]" />
            {(entry.coins ?? 0).toLocaleString()} points
          </div>
        )}
      </div>
      <Link
        to="/rank"
        className="glow-4d rounded-full bg-gradient-to-r from-[color:var(--primary)] to-[color:var(--secondary)] px-4 py-1.5 text-xs font-bold text-primary-foreground"
      >
        View
      </Link>
    </li>
  );
}

function TopGiftersBanner() {
  const { isAdmin } = useAuth();
  // Daily winners — locked for the full 24h day (UTC).
  const dayKey = new Date().toISOString().slice(0, 10);

  const q = useQuery({
    queryKey: ["daily-winners", dayKey],
    // Cache for a full day so the same 3 winners show for 24 hours.
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,username,avatar,coins")
        .order("coins", { ascending: false })
        .limit(3);
      if (error) throw error;
      return (data ?? []) as unknown as Entry[];
    },
  });

  const items = q.data ?? [];
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const len = items.length > 0 ? items.length : 3;
    if (len < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % len), 3500);
    return () => clearInterval(t);
  }, [items.length]);


  // Always render — fill with placeholders when there's no data yet.
  const display: Entry[] =
    items.length > 0
      ? items
      : [
          { id: "p1", username: "Winner 1", avatar: null, coins: 0 },
          { id: "p2", username: "Winner 2", avatar: null, coins: 0 },
          { id: "p3", username: "Winner 3", avatar: null, coins: 0 },
        ];


  return (
    <div className="relative mt-4 overflow-hidden rounded-3xl border border-[color:var(--gold)]/30 bg-gradient-to-br from-[color:var(--gold)]/15 via-card to-[color:var(--primary)]/10 shadow-xl shadow-[color:var(--gold)]/10">
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[color:var(--gold)]/20 blur-2xl" />
      <div className="flex items-center gap-2 px-4 pt-3">
        <Trophy className="h-4 w-4 text-[color:var(--gold)]" />
        <p className="text-xs font-bold tracking-wide">Daily Winners</p>
        <span className="ml-1 rounded-full bg-[color:var(--gold)]/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[color:var(--gold)]">
          24h
        </span>
        <Sparkles className="ml-auto h-4 w-4 animate-pulse text-[color:var(--gold)]" />
      </div>
      <div
        className="mt-2 flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${idx * 100}%)` }}
      >
        {display.map((e, i) => (
          <div key={e.id} className="flex w-full shrink-0 items-center gap-3 px-4 pb-4">
            <div className="relative shrink-0">
              {e.avatar ? (
                <img
                  alt={e.username ?? "user"}
                  className="h-16 w-16 rounded-2xl object-cover text-xl ring-2 ring-[color:var(--gold)]"
                  src={e.avatar}
                />
              ) : (
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-card text-xl font-bold ring-2 ring-[color:var(--gold)]">
                  {(e.username ?? "?").slice(0, 1).toUpperCase()}
                </div>
              )}
              <Crown className="absolute -top-3 left-1/2 h-5 w-5 -translate-x-1/2 fill-[color:var(--gold)] text-[color:var(--gold)] drop-shadow" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="inline-block rounded-full bg-[color:var(--gold)]/20 px-2 py-0.5 text-[10px] font-bold text-[color:var(--gold)]">
                #{i + 1} Winner today
              </span>
              <p className="mt-1 truncate text-sm font-extrabold">
                {e.username ?? "user"}
              </p>
              <div className="mt-0.5 flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1 text-[color:var(--gold)]">
                  <Coins className="h-3 w-3" />
                  {formatCoins(e.coins ?? 0)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {display.length > 1 && (
        <div className="flex justify-center gap-1 pb-2">
          {display.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === idx ? "w-4 bg-[color:var(--gold)]" : "w-1.5 bg-white/30"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}


function formatCoins(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

