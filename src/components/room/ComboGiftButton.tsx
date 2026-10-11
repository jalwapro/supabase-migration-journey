import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isAssetUrlLike, resolveGiftImageUrl, resolvePlayableGiftUrl } from "@/lib/giftMedia";
import { broadcastGiftPlayback } from "@/lib/giftBroadcast";
import { toast } from "sonner";
import type { Gift, GiftReceiver } from "@/components/GiftSheet";
import { giftAudioEnabled, giftAudioGain, giftSoundSrc } from "@/components/GiftSheet";

const COMBO_MS = 5000;
const LOVABLE_ASSET_ORIGIN = "https://cloud-to-soul.lovable.app";

export type ComboState = { gift: Gift; targets: string[]; receivers: GiftReceiver[] };

export function ComboGiftButton({ roomId, state, onExpire }: { roomId: string; state: ComboState | null; onExpire: () => void }) {
  const { profile, refresh } = useAuth();
  const [count, setCount] = useState(1);
  const [remaining, setRemaining] = useState(COMBO_MS);
  const startRef = useRef<number>(Date.now());
  const busyRef = useRef(false);
  const tapTotalsRef = useRef<Record<string, number>>({});
  const activeStateRef = useRef<ComboState | null>(null);
  const audioPoolRef = useRef<HTMLAudioElement | null>(null);

  const flushSummary = () => {
    const totals = tapTotalsRef.current;
    const active = activeStateRef.current;
    tapTotalsRef.current = {};
    activeStateRef.current = null;
    if (!active) return;
    for (const [receiverId, qty] of Object.entries(totals)) {
      if (qty < 1) continue;
      void supabase.rpc("log_combo_gift_summary", { _room_id: roomId, _receiver_id: receiverId, _gift_id: active.gift.id, _total_quantity: qty });
    }
  };

  useEffect(() => {
    if (!state) return;
    if (activeStateRef.current && activeStateRef.current !== state) flushSummary();
    activeStateRef.current = state;
    setCount(1);
    startRef.current = Date.now();
    setRemaining(COMBO_MS);
  }, [state]);

  useEffect(() => {
    if (!state) return;
    const id = setInterval(() => {
      const left = COMBO_MS - (Date.now() - startRef.current);
      if (left <= 0) {
        clearInterval(id);
        flushSummary();
        onExpire();
        return;
      }
      setRemaining(left);
    }, 100);
    return () => clearInterval(id);
  }, [state, onExpire]);

  if (!state) return null;
  const { gift, targets } = state;
  const price = (gift.price_coins ?? gift.price ?? 0) as number;
  const clipUrl = gift.clip_path && ["mp4", "webm", "svga"].includes(gift.clip_type ?? "") ? resolvePlayableGiftUrl(gift.clip_path) : null;
  const thumbUrl = resolveGiftImageUrl(gift.image_url ?? gift.icon_path ?? (isAssetUrlLike(gift.icon) ? gift.icon : null));

  const tap = async () => {
    if (busyRef.current) return;
    const cost = price * targets.length;
    if ((profile?.coins ?? 0) < cost) { toast.error("Not enough coins"); return; }
    busyRef.current = true;
    startRef.current = Date.now();
    setRemaining(COMBO_MS);

    if (giftSoundSrc(gift) && giftAudioEnabled(gift)) {
      try {
        const raw = giftSoundSrc(gift)!;
        const src = raw.startsWith("/__l5e/") ? `${LOVABLE_ASSET_ORIGIN}${raw}` : raw;
        if (!audioPoolRef.current) audioPoolRef.current = new Audio();
        const audio = audioPoolRef.current;
        if (audio.src !== src) audio.src = src;
        audio.currentTime = 0;
        audio.volume = Math.min(1, 0.9 * giftAudioGain(gift));
        void audio.play().catch(() => {});
      } catch { /* noop */ }
    }

    try {
      const uniqueTargets = [...new Set(targets)].filter(Boolean);
      if (!uniqueTargets.length) throw new Error("Pick a receiver");

      const sender = { id: profile?.id ?? null, name: profile?.username ?? "Guest", avatar: profile?.avatar ?? null };
      let firstSendId: string | null = null;
      let allSendIds: string[] = [];

      if (uniqueTargets.length === 1) {
        const { data, error } = await supabase.rpc("send_gift", {
          _room_id: roomId,
          _receiver_id: uniqueTargets[0],
          _gift_id: gift.id,
          _quantity: 1,
          _write_message: false,
        });
        if (error) throw error;
        const row = data as { id?: string } | null;
        if (!row?.id) throw new Error("Gift was charged but returned no canonical send id");
        firstSendId = row.id;
        allSendIds = [row.id];
        tapTotalsRef.current[uniqueTargets[0]] = (tapTotalsRef.current[uniqueTargets[0]] ?? 0) + 1;
      } else {
        const { data, error } = await supabase.rpc("send_gift_multi_current", {
          _room_id: roomId,
          _receiver_ids: uniqueTargets,
          _gift_id: gift.id,
          _quantity: 1,
        } as any);
        if (error) throw error;
        const rows = (Array.isArray(data) ? data : []) as Array<{ id?: string; receiver_id?: string }>;
        if (rows.length !== uniqueTargets.length || rows.some((row) => !row.id)) {
          throw new Error("Gift batch returned incomplete canonical send ids");
        }
        firstSendId = rows[0].id!;
        allSendIds = rows.map((row) => row.id!);
        rows.forEach((row) => {
          if (row.receiver_id) {
            tapTotalsRef.current[row.receiver_id] = (tapTotalsRef.current[row.receiver_id] ?? 0) + 1;
          }
        });
      }

      // The combo counter advances only after the atomic gift RPC has returned
      // canonical send IDs. Failed taps therefore cannot inflate local combo
      // state or the persisted summary.
      setCount((c) => c + 1);
      await broadcastGiftPlayback(roomId, gift, uniqueTargets, sender, 1, firstSendId!, allSendIds);
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      busyRef.current = false;
    }
  };

  const pct = Math.max(0, Math.min(1, remaining / COMBO_MS));
  const ringSize = 68;
  const stroke = 4;
  const r = (ringSize - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div className="pointer-events-none fixed inset-x-0 z-[70]" style={{ bottom: "calc(env(safe-area-inset-bottom) + 120px)" }}>
      <div className="mx-auto flex w-full max-w-md justify-end px-4">
        <button onClick={tap} className="pointer-events-auto relative grid place-items-center rounded-full bg-gradient-to-br from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--secondary)] shadow-[0_10px_40px_-4px_rgba(255,45,149,0.9)] ring-2 ring-white/40 transition-transform active:scale-95" style={{ width: ringSize, height: ringSize }} aria-label="Combo gift">
          <svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`} className="absolute inset-0 -rotate-90">
            <circle cx={ringSize / 2} cy={ringSize / 2} r={r} stroke="rgba(255,255,255,0.15)" strokeWidth={stroke} fill="none" />
            <circle cx={ringSize / 2} cy={ringSize / 2} r={r} stroke="url(#comboGrad)" strokeWidth={stroke} strokeLinecap="round" fill="none" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
            <defs><linearGradient id="comboGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ffd700" /><stop offset="50%" stopColor="#ff2d95" /><stop offset="100%" stopColor="#8b5cf6" /></linearGradient></defs>
          </svg>
          <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-[color:var(--gold)]/30 via-[color:var(--primary)]/30 to-[color:var(--secondary)]/30 backdrop-blur-md">{thumbUrl ? <img src={thumbUrl} alt="" className="h-9 w-9 object-contain" /> : <span className="text-2xl leading-none">{gift.icon ?? gift.emoji ?? "🎁"}</span>}</div>
          <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--secondary)] px-2 py-0.5 text-[11px] font-black text-white shadow-lg">x{count}</span>
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-white/90">COMBO</span>
        </button>
      </div>
    </div>
  );
}
