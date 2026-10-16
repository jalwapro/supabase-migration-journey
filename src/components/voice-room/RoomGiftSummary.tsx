import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Supporter = { user_id: string; username: string | null; avatar: string | null; points: number; gifts: number };
type Summary = { total_points: number; gift_count: number; top_supporters: Supporter[] | null };

const fmt = (value: unknown) => Number(value ?? 0).toLocaleString();

export function RoomGiftSummary({ roomId, userId }: { roomId: string; userId: string }) {
  const qc = useQueryClient();
  const key = ["room-user-gift-summary", roomId, userId] as const;
  const query = useQuery({
    queryKey: key,
    enabled: !!roomId && !!userId,
    staleTime: 10_000,
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_room_user_gift_summary", {
        _room_id: roomId, _user_id: userId,
      });
      if (error) throw error;
      return (data?.[0] ?? { total_points: 0, gift_count: 0, top_supporters: [] }) as Summary;
    },
  });

  useEffect(() => {
    const channel = supabase.channel(`room-gifts:${roomId}:${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "gift_sends", filter: `room_id=eq.${roomId}` },
        payload => {
          if ((payload.new as { receiver_id?: string })?.receiver_id === userId) {
            void qc.invalidateQueries({ queryKey: key });
          }
        })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [roomId, userId, qc]);

  const summary = query.data;
  const supporters = (summary?.top_supporters ?? []).slice(0, 3);
  return (
    <section className="mt-3 rounded-xl border border-amber-300/20 bg-amber-400/[.06] p-3" aria-label="Gifts received in this room">
      <div className="flex items-center gap-2">
        <Gift className="h-4 w-4 shrink-0 text-amber-300" />
        <span className="min-w-0 flex-1 text-xs font-black text-white">Gifts in this room</span>
        {query.isFetching && <Loader2 className="h-3 w-3 animate-spin text-white/35" />}
        <span className="text-right text-[10px] font-bold text-amber-200">{fmt(summary?.total_points)} points</span>
      </div>
      <div className="mt-1 text-[10px] text-white/45">{fmt(summary?.gift_count)} gifts received here</div>
      {query.isError ? (
        <p className="mt-2 text-[10px] text-white/50">Room gift details are temporarily unavailable.</p>
      ) : supporters.length ? (
        <div className="mt-2 space-y-1.5">
          {supporters.map((s, i) => (
            <div key={s.user_id} className="flex items-center gap-2 rounded-lg bg-black/20 px-2 py-1.5">
              <span className="w-3 text-[10px] font-black text-amber-200">{i + 1}</span>
              {s.avatar ? <img src={s.avatar} alt="" loading="lazy" className="h-6 w-6 rounded-full object-cover" /> :
                <span className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-[10px]">{(s.username ?? "U").slice(0,1).toUpperCase()}</span>}
              <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-white/80">{s.username ?? "User"}</span>
              <span className="shrink-0 text-[10px] font-bold text-amber-200">{fmt(s.points)} pts · {fmt(s.gifts)} gifts</span>
            </div>
          ))}
        </div>
      ) : <p className="mt-2 text-[10px] text-white/40">No gifts sent to this user in this room yet.</p>}
    </section>
  );
}
