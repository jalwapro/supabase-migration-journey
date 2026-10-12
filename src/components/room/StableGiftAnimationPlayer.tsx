import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_GIFT_RENDER, normalizeRenderConfig, renderConfigToStyle, OBJECT_FIT, type GiftRenderConfig } from "@/lib/giftRender";
import GiftGLVideo from "@/components/room/GiftGLVideo";
import SvgaPlayer from "@/components/room/SvgaPlayer";
import { giftAssetCandidates, giftAssetType } from "@/lib/giftAssetResolver";
import { acquireGiftBroadcastChannel, releaseGiftBroadcastChannel } from "@/lib/giftBroadcast";

type GiftRow = { id: string; room_id: string; created_at?: string | null; sender_id?: string | null; receiver_id?: string | null; receiver_ids?: string[] | null; gift_id?: string | null; gift_chromakey?: string | null; gift_name?: string | null; gift_emoji?: string | null; gift_icon?: string | null; gift_icon_path?: string | null; gift_image_url?: string | null; gift_clip_path?: string | null; gift_clip_type?: string | null; gift_price_coins?: number | null; gift_duration_ms?: number | null; gift_audio_url?: string | null; gift_sound_url?: string | null; gift_render_config?: Record<string, unknown> | null; gift_loop?: boolean | null; gift_audio_enabled?: boolean | null; gift_audio_volume?: number | null; quantity?: number | null; sender_username?: string | null };
const num = (v: unknown, fallback: number) => { const n = Number(v); return Number.isFinite(n) ? n : fallback; };
const assetUrl = (v: string | null | undefined) => { if (!v) return null; const s = v.trim(); if (!s) return null; if (s.startsWith("__l5e/assets-v1/")) return `https://cloud-to-soul.lovable.app/${s}`; if (s.startsWith("/__l5e/")) return `https://cloud-to-soul.lovable.app${s}`; return s; };
const cleanUrl = (src: string | null) => (src ?? "").split("?")[0].split("#")[0].toLowerCase();
const isVideo = (src: string | null, type?: string | null) => { const s = cleanUrl(src); return !!src && (s.endsWith(".mp4") || s.endsWith(".webm") || s.endsWith(".mov") || ["mp4", "webm", "mov"].includes((type ?? "").toLowerCase())); };
const isSvga = (src: string | null, type?: string | null) => { const s = cleanUrl(src); return !!src && (s.endsWith(".svga") || (type ?? "").toLowerCase() === "svga"); };
const isSvg = (src: string | null, type?: string | null) => { const s = cleanUrl(src); return !!src && (s.endsWith(".svg") || (type ?? "").toLowerCase() === "svg"); };
const isSmallGift = (row: GiftRow) => {
  // Price must never force a real video/SVGA gift into the tiny flying-gift
  // renderer. Some animated gifts are inexpensive and were incorrectly
  // classified as "small" solely by price.
  const price = Number(row.gift_price_coins);
  if (!Number.isFinite(price) || price < 10 || price > 300) return false;
  const sources = [row.gift_clip_path, row.gift_image_url, row.gift_icon_path, row.gift_icon];
  if (sources.some((src) => isVideo(src ?? null, row.gift_clip_type) || isSvga(src ?? null, row.gift_clip_type))) return false;
  return true;
};
const svgCandidates = (row: GiftRow) => [row.gift_clip_path, row.gift_icon_path, row.gift_image_url, row.gift_icon, ...giftAssetCandidates(row.gift_name)].map(assetUrl).filter((v): v is string => !!v && isSvg(v));
const isChromaKeyEnabled = (value: string | null | undefined, cfg: GiftRenderConfig) => {
  const key = (value ?? "").trim().toLowerCase();
  return (!!key && !["false", "off", "none", "disabled", "0", "no"].includes(key)) || (cfg.chromaMode !== "off" && cfg.chromaMode !== "auto");
};
const isMobileWebView = () => typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const requiresGpuGiftRenderer = (cfg: GiftRenderConfig) => Boolean(
  (cfg.chromaMode !== "off" && cfg.chromaMode !== "auto") ||
  cfg.cropTop || cfg.cropRight || cfg.cropBottom || cfg.cropLeft ||
  cfg.brightness || cfg.contrast || cfg.temperature || cfg.tint || cfg.highlights || cfg.shadows ||
  cfg.exposure || cfg.hue || cfg.blurRadius || cfg.blurTop || cfg.blurBottom || cfg.blurLeft || cfg.blurRight ||
  cfg.sharpness || cfg.denoise || cfg.edgeCleanup || cfg.spillSuppression || cfg.colorRecovery || cfg.contrastRecovery
);

export function StableGiftAnimationPlayer({ roomId }: { roomId: string }) {
  const [active, setActive] = useState<GiftRow | null>(null);
  const [localUserId, setLocalUserId] = useState<string | null>(null);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [mediaStarted, setMediaStarted] = useState(false);
  const [mediaDurationMs, setMediaDurationMs] = useState<number | null>(null);
  const [fallbackSrc, setFallbackSrc] = useState<string | null>(null);
  const [fallbackType, setFallbackType] = useState<"video" | "svga" | "image" | null>(null);
  const [flyTarget, setFlyTarget] = useState<{ x: number; y: number } | null>(null);
  const activeRef = useRef<GiftRow | null>(null); const queueRef = useRef<GiftRow[]>([]); const seenRef = useRef(new Set<string>()); const seenOrderRef = useRef<string[]>([]); const localEchoRef = useRef(new Set<string>()); const pendingDbRef = useRef(new Map<string, number>()); const pendingRowsRef = useRef(new Map<string, GiftRow>()); const endTimerRef = useRef<number | null>(null);
  const clearTimer = useCallback(() => { if (endTimerRef.current !== null) window.clearTimeout(endTimerRef.current); endTimerRef.current = null; }, []);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopGiftAudio = useCallback(() => { const audio = audioRef.current; if (audio) { audio.pause(); audio.currentTime = 0; audioRef.current = null; } }, []);
  const finish = useCallback(() => { clearTimer(); stopGiftAudio(); setFlyTarget(null); setMediaStarted(false); setMediaDurationMs(null); const next = queueRef.current.shift() ?? null; activeRef.current = next; setActive(next); }, [clearTimer, stopGiftAudio]);
  const enqueue = useCallback((row: GiftRow) => { if (!row?.id || seenRef.current.has(row.id)) return; seenRef.current.add(row.id); seenOrderRef.current.push(row.id); if (seenOrderRef.current.length > 500) { const old = seenOrderRef.current.shift(); if (old) seenRef.current.delete(old); } if (activeRef.current) queueRef.current.push(row); else { activeRef.current = row; setMediaStarted(false); setMediaDurationMs(null); setActive(row); } }, []);
  const hydrateRenderConfig = useCallback(async (row: GiftRow): Promise<GiftRow> => {
    if (!row.gift_id) return row;
    const { data } = await supabase.from("gifts").select("render_config,clip_path,clip_type,image_url,icon,icon_path,emoji,sound_url,audio_enabled,audio_volume,animation,duration_ms,loop,price_coins,price,chromakey").eq("id", row.gift_id).maybeSingle();
    if (!data) return row;
    return { ...row, gift_chromakey: row.gift_chromakey ?? (data as any).chromakey ?? null, gift_render_config: (data as any).render_config ?? row.gift_render_config ?? null, gift_clip_path: row.gift_clip_path ?? (data as any).clip_path ?? null, gift_clip_type: row.gift_clip_type ?? (data as any).clip_type ?? null, gift_image_url: row.gift_image_url ?? (data as any).image_url ?? null, gift_icon: row.gift_icon ?? (data as any).icon ?? null, gift_icon_path: row.gift_icon_path ?? (data as any).icon_path ?? null, gift_emoji: row.gift_emoji ?? (data as any).emoji ?? null, gift_audio_url: row.gift_audio_url ?? (data as any).sound_url ?? null, gift_duration_ms: row.gift_duration_ms ?? (data as any).duration_ms ?? null, gift_loop: row.gift_loop ?? Boolean((data as any).loop), gift_audio_enabled: row.gift_audio_enabled ?? (data as any).audio_enabled ?? true, gift_audio_volume: row.gift_audio_volume ?? num((data as any).audio_volume ?? 1, 1), gift_price_coins: row.gift_price_coins ?? num((data as any).price_coins ?? (data as any).price, 0) };
  }, []);

  useEffect(() => {
    let cancelled = false; setMediaFailed(false); setFallbackSrc(null); setFallbackType(null); setFlyTarget(null);
    if (!active) return;
    if (isSmallGift(active)) { const svg = svgCandidates(active)[0]; if (svg && !cancelled) setFallbackSrc(svg); return () => { cancelled = true; }; }
    const primary = assetUrl(active.gift_clip_path) ?? assetUrl(active.gift_image_url) ?? assetUrl(active.gift_icon);
    if (primary) return;
    const candidates = giftAssetCandidates(active.gift_name);
    (async () => { for (const candidate of candidates) { try { const response = await fetch(candidate, { method: "HEAD", cache: "force-cache" }); if (response.ok && !cancelled) { setFallbackSrc(candidate); setFallbackType(giftAssetType(candidate)); return; } } catch {} } })();
    return () => { cancelled = true; };
  }, [active?.id, active?.gift_name, active?.gift_clip_path, active?.gift_image_url, active?.gift_icon, active?.gift_icon_path, active?.gift_price_coins]);

  useEffect(() => {
    if (!active || !mediaFailed || isSmallGift(active)) return;
    let cancelled = false; const candidates = giftAssetCandidates(active.gift_name);
    (async () => { for (const candidate of candidates) { if (assetUrl(active.gift_clip_path) === candidate) continue; try { const response = await fetch(candidate, { method: "HEAD", cache: "force-cache" }); if (response.ok && !cancelled) { setFallbackSrc(candidate); setFallbackType(giftAssetType(candidate)); setMediaFailed(false); return; } } catch {} } })();
    return () => { cancelled = true; };
  }, [mediaFailed, active?.id, active?.gift_name, active?.gift_clip_path, active?.gift_price_coins]);

  useEffect(() => {
    let cancelled = false;
    const resolveTarget = async () => {
      if (!active || !isSmallGift(active)) return;
      const targetId = active.receiver_ids?.find(Boolean) ?? active.receiver_id ?? null; if (!targetId) return;
      const { data: profile } = await supabase.from("profiles").select("username,avatar").eq("id", targetId).maybeSingle(); if (cancelled) return;
      const username = typeof profile?.username === "string" ? profile.username : null; const avatar = typeof profile?.avatar === "string" ? profile.avatar : null;
      let target: HTMLElement | null = null;
      if (avatar) target = document.querySelector<HTMLElement>(`img[src="${CSS.escape(avatar)}"]`);
      if (!target && username) target = document.querySelector<HTMLElement>(`img[alt="${CSS.escape(username)}"]`);
      if (!target) { setFlyTarget(null); return; } const rect = target.getBoundingClientRect(); setFlyTarget({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    };
    void resolveTarget(); const timer = window.setTimeout(() => void resolveTarget(), 100); window.addEventListener("resize", resolveTarget); window.addEventListener("scroll", resolveTarget, true);
    return () => { cancelled = true; window.clearTimeout(timer); window.removeEventListener("resize", resolveTarget); window.removeEventListener("scroll", resolveTarget, true); };
  }, [active?.id, active?.receiver_id, active?.receiver_ids, active?.gift_price_coins]);

  useEffect(() => { const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); window.dispatchEvent(new PopStateEvent("popstate")); } }; window.addEventListener("keydown", handleKeyDown); return () => window.removeEventListener("keydown", handleKeyDown); }, []);
  useEffect(() => { let alive = true; void supabase.auth.getUser().then(({ data }) => { if (alive) setLocalUserId(data.user?.id ?? null); }); const { data } = supabase.auth.onAuthStateChange((_event, session) => { if (alive) setLocalUserId(session?.user?.id ?? null); }); return () => { alive = false; data.subscription.unsubscribe(); }; }, []);

  useEffect(() => {
    let alive = true;
    const scheduleDbFallback = (row: GiftRow) => {
      if (!row?.id || localEchoRef.current.has(row.id) || seenRef.current.has(row.id) || pendingDbRef.current.has(row.id)) return;
      pendingDbRef.current.set(row.id, 0);
      void hydrateRenderConfig(row).then((ready) => {
        if (!alive || seenRef.current.has(row.id)) {
          pendingDbRef.current.delete(row.id);
          pendingRowsRef.current.delete(row.id);
          return;
        }
        pendingRowsRef.current.set(row.id, ready);
        const timer = window.setTimeout(() => {
          pendingDbRef.current.delete(row.id);
          if (!alive || seenRef.current.has(row.id)) { pendingRowsRef.current.delete(row.id); return; }
          // PostgreSQL now() is transaction-stable, so all gift_sends rows
          // created by one multi-recipient RPC share the same created_at.
          const batch = [...pendingRowsRef.current.values()].filter((candidate) =>
            candidate.created_at && ready.created_at
              ? candidate.created_at === ready.created_at &&
                candidate.sender_id === ready.sender_id &&
                candidate.gift_id === ready.gift_id &&
                num(candidate.quantity, 1) === num(ready.quantity, 1)
              : candidate.id === ready.id
          );
          const grouped = batch.length ? batch : [ready];
          const receiverIds = [...new Set(grouped.flatMap((candidate) => [
            ...(Array.isArray(candidate.receiver_ids) ? candidate.receiver_ids : []),
            ...(candidate.receiver_id ? [candidate.receiver_id] : []),
          ]).filter(Boolean))];
          const primary = grouped[0];
          for (const candidate of grouped) {
            pendingRowsRef.current.delete(candidate.id);
            const timerId = pendingDbRef.current.get(candidate.id);
            if (timerId !== undefined && timerId > 0) window.clearTimeout(timerId);
            pendingDbRef.current.delete(candidate.id);
            if (candidate.id !== primary.id && !seenRef.current.has(candidate.id)) {
              seenRef.current.add(candidate.id);
              seenOrderRef.current.push(candidate.id);
            }
          }
          enqueue(receiverIds.length ? { ...primary, receiver_id: receiverIds[0], receiver_ids: receiverIds } : primary);
        }, 1400);
        pendingDbRef.current.set(row.id, timer);
      });
    };
    const channel = acquireGiftBroadcastChannel(roomId)
      .on("broadcast", { event: "gift_play" }, (message) => {
        if (!alive) return;
        const d = (message.payload ?? {}) as Record<string, unknown>;
        if (typeof d.roomId === "string" && d.roomId !== roomId) return;
        const id = typeof d.id === "string" ? d.id : null; if (!id || localEchoRef.current.has(id)) return;
        const eventIds = Array.isArray(d.eventIds) ? [...new Set(d.eventIds.filter((x): x is string => typeof x === "string" && x.length > 0))] : [id];
        // A multi-recipient send creates one gift_sends row per receiver but is
        // one user action. Cancel DB fallbacks and suppress every sibling row.
        for (const eventId of eventIds) {
          const pending = pendingDbRef.current.get(eventId);
          if (pending !== undefined) { if (pending > 0) window.clearTimeout(pending); pendingDbRef.current.delete(eventId); }
          pendingRowsRef.current.delete(eventId);
          if (eventId !== id && !seenRef.current.has(eventId)) {
            seenRef.current.add(eventId); seenOrderRef.current.push(eventId);
          }
        }
        const targets = Array.isArray(d.receiverIds) ? d.receiverIds.filter((x): x is string => typeof x === "string") : (typeof d.receiverId === "string" ? [d.receiverId] : []);
        const row: GiftRow = {
          id, room_id: roomId, sender_id: typeof d.senderId === "string" ? d.senderId : null, receiver_id: typeof d.receiverId === "string" ? d.receiverId : null, receiver_ids: targets,
          gift_id: typeof d.giftId === "string" ? d.giftId : null, gift_name: typeof d.giftName === "string" ? d.giftName : "Gift", gift_emoji: typeof d.giftEmoji === "string" ? d.giftEmoji : "🎁",
          gift_icon: typeof d.giftIcon === "string" ? d.giftIcon : null, gift_image_url: typeof d.giftImageUrl === "string" ? d.giftImageUrl : null, gift_clip_path: typeof d.giftClipPath === "string" ? d.giftClipPath : null, gift_clip_type: typeof d.giftClipType === "string" ? d.giftClipType : null,
          gift_price_coins: num(d.giftPriceCoins, 0) || null, gift_duration_ms: num(d.giftDurationMs, 0) || null, gift_audio_url: typeof d.giftAudioUrl === "string" ? d.giftAudioUrl : null, gift_sound_url: typeof d.giftSoundUrl === "string" ? d.giftSoundUrl : null,
          gift_render_config: (d.renderConfig as Record<string, unknown> | null) ?? null, gift_loop: typeof d.giftLoop === "boolean" ? d.giftLoop : false, gift_audio_enabled: typeof d.giftAudioEnabled === "boolean" ? d.giftAudioEnabled : true, gift_audio_volume: num(d.giftAudioVolume, 1), quantity: num(d.quantity, 1), sender_username: typeof d.senderName === "string" ? d.senderName : "User",
        };
        // Broadcast already contains the complete render/media payload. Do not
        // wait for a per-client gifts-table query: that made sender/receiver
        // start at different times. The database listener remains the fallback.
        enqueue(row);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "gift_sends", filter: `room_id=eq.${roomId}` }, (payload) => {
        if (!alive) return;
        const row = payload.new as GiftRow;
        scheduleDbFallback(row);
      })
      .subscribe((status) => {
        // Recover gifts missed while a low-bandwidth client temporarily
        // loses the Realtime connection.
        if (status === "SUBSCRIBED") {
          const recoveryKey = `jalwa:gift-recovery:${roomId}`;
          const hasConnectedBefore = sessionStorage.getItem(recoveryKey) === "1";
          sessionStorage.setItem(recoveryKey, "1");
          if (hasConnectedBefore) {
            const since = new Date(Date.now() - 60_000).toISOString();
            void supabase
              .from("gift_sends")
              .select("*")
              .eq("room_id", roomId)
              .gte("created_at", since)
              .order("created_at", { ascending: true })
              .limit(100)
              .then(({ data, error }) => {
                if (!alive || error || !data) return;
                for (const recovered of data as GiftRow[]) {
                  scheduleDbFallback(recovered);
                }
              });
          }
        }
      });
    const onLocalGift = (event: Event) => {
      const d = (event as CustomEvent).detail as Record<string, unknown> | undefined; if (!d) return;
      const targets = Array.isArray(d.receiverIds) ? d.receiverIds.filter((x): x is string => typeof x === "string") : (typeof d.receiverId === "string" ? [d.receiverId] : []);
      const isLocalSender = localUserId && typeof d.senderId === "string" && d.senderId === localUserId;
      if (targets.length && localUserId && !targets.includes(localUserId) && !isLocalSender && d.local !== true) return;
      const key = typeof d.key === "string" ? d.key : `local-${crypto.randomUUID()}`;
      const eventIds = Array.isArray(d.eventIds) ? d.eventIds.filter((x): x is string => typeof x === "string") : [key];
      for (const eventId of eventIds) { if (eventId === key) continue; seenRef.current.add(eventId); seenOrderRef.current.push(eventId); }
      localEchoRef.current.add(key);
      const row: GiftRow = { id: key, room_id: roomId, sender_id: localUserId, receiver_id: typeof d.receiverId === "string" ? d.receiverId : null, receiver_ids: targets, gift_id: typeof d.giftId === "string" ? d.giftId : null, gift_name: typeof d.giftName === "string" ? d.giftName : "Gift", gift_emoji: typeof d.giftEmoji === "string" ? d.giftEmoji : "🎁", gift_icon: typeof d.giftIcon === "string" ? d.giftIcon : null, gift_icon_path: null, gift_image_url: typeof d.giftImageUrl === "string" ? d.giftImageUrl : null, gift_clip_path: typeof d.giftClipUrl === "string" ? d.giftClipUrl : null, gift_clip_type: typeof d.giftClipType === "string" ? d.giftClipType : null, gift_price_coins: num(d.giftPriceCoins, 0) || null, gift_audio_url: typeof d.soundUrl === "string" ? d.soundUrl : null, gift_duration_ms: num(d.durationMs, 0) || null, gift_render_config: (d.renderConfig as Record<string, unknown> | null) ?? null, gift_loop: typeof d.giftLoop === "boolean" ? d.giftLoop : false, gift_audio_enabled: typeof d.audioEnabled === "boolean" ? d.audioEnabled : true, gift_audio_volume: num(d.audioVolume, 1), quantity: num(d.quantity, 1), sender_username: typeof d.senderName === "string" ? d.senderName : "User" };
      // Use the broadcast payload directly so the sender does not wait for a
      // second database read before starting playback.
      enqueue(row);
    };
    window.addEventListener("jalwa:gift-sent", onLocalGift as EventListener);
    return () => { alive = false; for (const timer of pendingDbRef.current.values()) if (timer > 0) window.clearTimeout(timer); pendingDbRef.current.clear(); pendingRowsRef.current.clear(); releaseGiftBroadcastChannel(roomId); window.removeEventListener("jalwa:gift-sent", onLocalGift as EventListener); };
  }, [roomId, localUserId, enqueue, hydrateRenderConfig]);

  useEffect(() => {
    stopGiftAudio();
    if (!active || active.gift_audio_enabled === false) return;
    const src = assetUrl(active.gift_audio_url ?? active.gift_sound_url);
    if (!src) return;
    const clipSrc = assetUrl(active.gift_clip_path);
    if (clipSrc && isVideo(clipSrc, active.gift_clip_type) && clipSrc === src) return;
    const audio = new Audio(src);
    audio.preload = "auto";
    audio.volume = Math.min(1, Math.max(0, num(active.gift_audio_volume ?? 1, 1)));
    audioRef.current = audio;
    void audio.play().catch(() => {});
    return stopGiftAudio;
  }, [active?.id, active?.gift_audio_url, active?.gift_sound_url, active?.gift_audio_enabled, active?.gift_audio_volume, active?.gift_clip_path, active?.gift_clip_type, stopGiftAudio]);

  useEffect(() => {
    clearTimer();
    if (!active) return;
    const cfg = normalizeRenderConfig(active.gift_render_config ?? DEFAULT_GIFT_RENDER);
    const videoSrc = assetUrl(active.gift_clip_path) ?? fallbackSrc;
    const activeVideo = isVideo(videoSrc, active.gift_clip_type);
    if (activeVideo && !mediaStarted) return;
    const smallGift = isSmallGift(active);
    const declared = mediaDurationMs ?? num(active.gift_duration_ms, 0);
    const clipFallback = declared > 0 ? declared : 15000;
    const duration = smallGift ? 1100 : cfg.endMs != null ? Math.max(300, cfg.endMs) : Math.min(180000, Math.max(1500, clipFallback + cfg.holdMs));
    const delay = Math.max(0, cfg.delayMs);
    endTimerRef.current = window.setTimeout(finish, delay + duration + 250);
    return clearTimer;
  }, [active, fallbackSrc, mediaStarted, mediaDurationMs, clearTimer, finish]);
  useEffect(() => () => { clearTimer(); stopGiftAudio(); activeRef.current = null; queueRef.current = []; }, [clearTimer, stopGiftAudio]);

  if (!active) return null;
  const small = isSmallGift(active); const cfg: GiftRenderConfig = normalizeRenderConfig(active.gift_render_config ?? DEFAULT_GIFT_RENDER);
  const primaryClip = assetUrl(active.gift_clip_path); const primaryImage = assetUrl(active.gift_image_url ?? active.gift_icon);
  const src = small ? (fallbackSrc ?? svgCandidates(active)[0] ?? assetUrl(active.gift_clip_path) ?? assetUrl(active.gift_icon_path) ?? assetUrl(active.gift_image_url) ?? assetUrl(active.gift_icon) ?? null) : (fallbackSrc ?? primaryClip);
  const mediaType = fallbackSrc && fallbackSrc !== primaryClip ? (fallbackType ?? giftAssetType(fallbackSrc)) : giftAssetType(src ?? "");
  const video = !small && (mediaType === "video" || isVideo(src, active.gift_clip_type));
  const svga = !small && (mediaType === "svga" || isSvga(src, active.gift_clip_type));
  const svg = small ? !!src && isSvg(src, "svg") : mediaType === "image" && (isSvg(src, active.gift_clip_type) || isSvg(primaryClip, active.gift_clip_type));
  const image = svg ? src : (mediaType === "image" ? (src ?? primaryImage) : primaryImage); const fallbackImage = assetUrl(active.gift_icon); const stageStyle = renderConfigToStyle(cfg);
  const crop = cfg.cropTop || cfg.cropRight || cfg.cropBottom || cfg.cropLeft ? { clipPath: `inset(${cfg.cropTop}px ${cfg.cropRight}px ${cfg.cropBottom}px ${cfg.cropLeft}px)` } : {};
  const filterParts: string[] = [];
  if (cfg.brightness) filterParts.push(`brightness(${Math.max(0, 1 + cfg.brightness / 100)})`);
  if (cfg.contrast) filterParts.push(`contrast(${Math.max(0, 1 + cfg.contrast / 100)})`);
  if (cfg.saturation !== 1) filterParts.push(`saturate(${Math.max(0, cfg.saturation)})`);
  if (cfg.hue) filterParts.push(`hue-rotate(${cfg.hue}deg)`);
  if (cfg.blurRadius > 0) filterParts.push(`blur(${cfg.blurRadius}px)`);
  const filter = filterParts.length ? filterParts.join(" ") : undefined;
  // Avoid creating an oversized permanent compositor layer for a static,
  // full-screen gift. Keep transform for smooth video composition without
  // forcing will-change on every animation.
  const mediaStyle: React.CSSProperties = { width: "100%", height: "100%", display: "block", objectFit: OBJECT_FIT[cfg.fit], filter, transform: "translate3d(0, 0, 0)", willChange: "auto", ...crop };
  const loop = Boolean(cfg.loop && cfg.loopCount !== 1);
  const handleDuration = (ms: number) => { if (ms > 0) setMediaDurationMs(ms); };
  const handleMediaError = () => { if (small) { finish(); return; } setMediaFailed(true); clearTimer(); endTimerRef.current = window.setTimeout(finish, 7000); };
  const handleSvgError = () => { setMediaFailed(true); clearTimer(); endTimerRef.current = window.setTimeout(finish, 1200); };

  if (small) {
    const startX = typeof window !== "undefined" ? window.innerWidth * 0.5 : 0; const startY = typeof window !== "undefined" ? window.innerHeight * 0.72 : 0;
    const endX = flyTarget?.x ?? startX; const endY = flyTarget?.y ?? startY; const deltaX = endX - startX; const deltaY = endY - startY;
    return (<div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 2147483647 }} aria-live="polite">{src && <img key={`${active.id}:${src}:${endX}:${endY}`} src={src} alt={active.gift_name ?? "Gift"} className="absolute h-14 w-14 object-contain drop-shadow-[0_4px_12px_rgba(255,255,255,0.45)]" style={{ left: startX - 28, top: startY - 28, transform: `translate3d(${deltaX}px, ${deltaY}px, 0) scale(${flyTarget ? 0.38 : 1})`, opacity: flyTarget ? 0.15 : 1, transition: flyTarget ? "transform 850ms cubic-bezier(.2,.8,.2,1), opacity 850ms ease" : "none" }} onError={handleSvgError} />}</div>);
  }

  return (<div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 2147483647 }} aria-live="polite"><div style={stageStyle}>
    {svga && src && !mediaFailed ? <SvgaPlayer key={`${active.id}:${src}`} src={src} loops={loop ? 0 : 1} clearsAfterStop={false} className="h-full w-full" style={mediaStyle} onFinished={finish} onError={handleMediaError} />
      : video && src && !mediaFailed && requiresGpuGiftRenderer(cfg) && (!isMobileWebView() || isChromaKeyEnabled(active.gift_chromakey, cfg)) ? <GiftGLVideo key={`${active.id}:${src}`} src={src} config={cfg} loop={loop} muted={active.gift_audio_enabled === false} volume={num(active.gift_audio_volume ?? 1, 1)} className="h-full w-full" style={mediaStyle} objectFit={OBJECT_FIT[cfg.fit]} onDuration={handleDuration} onReady={() => setMediaStarted(true)} onEnded={finish} onError={handleMediaError} />
      : video && src && !mediaFailed ? <video key={`${active.id}:${src}`} src={src} playsInline autoPlay preload="auto" muted={active.gift_audio_enabled === false} loop={loop} className="h-full w-full" style={{ ...mediaStyle, transform: "translate3d(0, 0, 0)", willChange: "transform" }}
          onLoadedMetadata={e => { const d = e.currentTarget.duration; if (Number.isFinite(d) && d > 0) handleDuration(Math.ceil(d * 1000)); }}
          onLoadedData={e => { const v = e.currentTarget; v.muted = active.gift_audio_enabled === false; v.volume = Math.min(1, Math.max(0, num(active.gift_audio_volume ?? 1, 1))); void v.play().catch(() => { v.muted = true; void v.play().catch(() => {}); }); }}
          onCanPlayThrough={e => { const v = e.currentTarget; v.muted = active.gift_audio_enabled === false; v.volume = Math.min(1, Math.max(0, num(active.gift_audio_volume ?? 1, 1))); void v.play().catch(() => { v.muted = true; void v.play().catch(() => {}); }); }}
          onPlaying={() => setMediaStarted(true)}
          onWaiting={e => { const v = e.currentTarget; window.setTimeout(() => { if (!v.paused && !v.ended) return; void v.play().catch(() => {}); }, 250); }}
          onStalled={e => { const v = e.currentTarget; window.setTimeout(() => { if (!v.paused && !v.ended) return; void v.play().catch(() => {}); }, 500); }}
          onEnded={finish} onError={handleMediaError} />
      : svg && image && !mediaFailed ? <img key={`${active.id}:${image}`} src={image} alt={active.gift_name ?? "Gift"} className="h-full w-full" style={mediaStyle} onError={handleSvgError} />
      : image && !mediaFailed ? <img src={image} alt={active.gift_name ?? "Gift"} className="h-full w-full" style={mediaStyle} onError={() => { if (fallbackImage && image !== fallbackImage) { setFallbackSrc(fallbackImage); setFallbackType("image"); setMediaFailed(false); return; } finish(); }} />
      : src && !mediaFailed ? <img src={src} alt={active.gift_name ?? "Gift"} className="h-full w-full" style={mediaStyle} onError={finish} />
      : <div className="grid h-full w-full place-items-center text-[clamp(64px,22vw,180px)]">{active.gift_emoji || "🎁"}</div>}
  </div><div className="absolute left-4 top-16 rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-xs font-semibold text-white">{active.sender_username || "User"} sent {active.gift_name || "Gift"}{num(active.quantity, 1) > 1 ? ` ×${active.quantity}` : ""}</div></div>);
}
