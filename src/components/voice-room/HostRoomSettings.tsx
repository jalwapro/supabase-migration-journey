import { useEffect, useState } from "react";
import { Check, Gift, Lock, MessageSquare, Mic, RefreshCw, Settings, Unlock, X, Users, VolumeX, ShieldAlert, Music, Shield, Ban, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type RoomSettings = {
  is_locked: boolean;
  chat_enabled: boolean;
  gifts_enabled: boolean;
  guest_mic_enabled: boolean;
  music_enabled?: boolean;
  seat_count?: number;
  stage_locked?: boolean;
};

type Props = {
  roomId: string;
  open: boolean;
  onClose: () => void;
  onSettingsChange?: (settings: RoomSettings) => void;
  onOpenMusic?: () => void;
  onOpenManagement?: (mode: "kick" | "block" | "moderators") => void;
};

const defaults: RoomSettings = { is_locked: false, chat_enabled: true, gifts_enabled: true, guest_mic_enabled: true, music_enabled: true, seat_count: 8, stage_locked: false };

export function HostRoomSettings({ roomId, open, onClose, onSettingsChange, onOpenMusic, onOpenManagement }: Props) {
  const [settings, setSettings] = useState<RoomSettings>(defaults);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("live_rooms").select("is_locked,chat_enabled,gifts_enabled,guest_mic_enabled,seat_count").eq("id", roomId).maybeSingle();
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    if (data) { const next = { ...defaults, ...data } as RoomSettings; setSettings(next); onSettingsChange?.(next); }
  };

  useEffect(() => {
    if (!roomId) return;
    void load();
    const channel = supabase.channel(`host-room-settings-${roomId}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_rooms", filter: `id=eq.${roomId}` }, payload => {
      const row = payload.new as Partial<RoomSettings>;
      const next = { ...defaults, ...row } as RoomSettings;
      setSettings(prev => ({ ...prev, ...next }));
      onSettingsChange?.(next);
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [roomId]);

  const update = async (key: keyof RoomSettings, value: boolean | number) => {
    if (saving) return;
    setSaving(key);
    if (key === "seat_count") {
      const { error } = await supabase.from("live_rooms").update({ seat_count: value }).eq("id", roomId);
      setSaving(null);
      if (error) { toast.error(error.message); return; }
      const next = { ...settings, seat_count: Number(value) }; setSettings(next); onSettingsChange?.(next); toast.success(`Seat capacity updated to ${value}`); return;
    }
    if (key === "music_enabled") {
      setSaving(null); const next = { ...settings, music_enabled: Boolean(value) }; setSettings(next); onSettingsChange?.(next); toast.success(`Music ${value ? "enabled" : "disabled"}`); return;
    }
    const { data, error } = await supabase.rpc("host_update_room_settings", {
      _room_id: roomId,
      _is_locked: key === "is_locked" ? value : null,
      _chat_enabled: key === "chat_enabled" ? value : null,
      _gifts_enabled: key === "gifts_enabled" ? value : null,
      _guest_mic_enabled: key === "guest_mic_enabled" ? value : null,
    });
    setSaving(null);
    if (error) { toast.error(error.message); return; }
    const next = { ...settings, ...(data as Partial<RoomSettings>) } as RoomSettings; setSettings(next); onSettingsChange?.(next); toast.success(`${labels[key]} ${value ? "enabled" : "disabled"}`);
  };

  const handleAction = async (actionType: string) => {
    if (actionType === "kick_room") { onClose(); onOpenManagement?.("kick"); return; }
    if (actionType === "block_list") { onClose(); onOpenManagement?.("block"); return; }
    if (actionType === "co_hosts") { onClose(); onOpenManagement?.("moderators"); return; }
    setSaving(actionType);
    try {
      if (actionType === "mute_all") {
        const { error } = await supabase.from("room_members").update({ is_muted: true }).eq("room_id", roomId);
        if (error) throw error;
        toast.success("All speakers muted");
      } else if (actionType === "clear_hands") {
        toast.info("No hand-raise queue function exists in the current repo, so no data was changed.");
      }
    } catch (err: any) { toast.error(err?.message || "Action failed"); }
    finally { setSaving(null); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[2147483000] flex items-center justify-center bg-black/60 p-2 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <section className="w-full max-w-md my-auto rounded-3xl border border-white/15 bg-[#100719] p-4 text-white shadow-2xl max-h-[90dvh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between shrink-0"><div className="flex items-center gap-2"><Settings className="h-5 w-5 text-[color:var(--secondary)]" /><div><h2 className="text-base font-black">Host Controls & Settings</h2><p className="text-[9px] text-white/45">Manage room config, seats, music, and safety.</p></div></div><div className="flex items-center gap-1"><button type="button" onClick={() => void load()} disabled={loading} className="grid h-8 w-8 place-items-center rounded-full bg-white/10 disabled:opacity-40" aria-label="Refresh settings"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button><button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-white/10" aria-label="Close settings"><X className="h-4 w-4" /></button></div></div>
        <div className="space-y-4 overflow-y-auto pr-1 flex-1">
          <div className="space-y-2"><div className="text-[10px] font-bold uppercase tracking-wider text-white/50">Seat Management</div><div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3"><div className="flex items-center gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-white/80"><Users className="h-4 w-4" /></div><div><div className="text-xs font-bold">Total Seats / Capacity</div><div className="text-[9px] text-white/40">Choose active seat count (4 - 20)</div></div></div><select value={settings.seat_count ?? 8} disabled={saving === "seat_count"} onChange={e => void update("seat_count", Number(e.target.value))} className="bg-black/40 border border-white/20 rounded-xl px-3 py-1.5 text-xs font-semibold text-white outline-none">{[4,8,12,16,20].map(num => <option key={num} value={num} className="bg-slate-900 text-white">{num} Seats</option>)}</select></div></div>
          <div className="space-y-2"><div className="text-[10px] font-bold uppercase tracking-wider text-white/50">Quick Actions</div><div className="grid grid-cols-2 gap-2"><button type="button" disabled={saving === "mute_all"} onClick={() => void handleAction("mute_all")} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition hover:bg-white/10 active:scale-95"><VolumeX className="h-4 w-4 text-red-400 shrink-0" /><div><div className="text-xs font-bold">Mute All</div><div className="text-[8px] text-white/40">Mute all stage speakers</div></div></button><button type="button" disabled={saving === "clear_hands"} onClick={() => void handleAction("clear_hands")} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition hover:bg-white/10 active:scale-95"><ShieldAlert className="h-4 w-4 text-amber-400 shrink-0" /><div><div className="text-xs font-bold">Clear Queue</div><div className="text-[8px] text-white/40">Clear hand raise requests</div></div></button></div></div>
          <div className="space-y-2"><div className="text-[10px] font-bold uppercase tracking-wider text-white/50">Room Preferences & Audio</div><div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3"><div className="flex items-center gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-white/80"><Music className="h-4 w-4 text-pink-400" /></div><div><div className="text-xs font-bold">Background Music</div><div className="text-[9px] text-white/40">Open music player & playlist</div></div></div><button type="button" onClick={() => { onClose(); onOpenMusic?.(); }} className="rounded-xl bg-[color:var(--primary)] px-3 py-1.5 text-xs font-bold text-white transition active:scale-95">Open Player</button></div><SettingRow icon={settings.is_locked ? <Unlock /> : <Lock />} label="Room Lock" description={settings.is_locked ? "New room entry is locked" : "Users can enter the room"} value={settings.is_locked} busy={saving === "is_locked"} onToggle={v => void update("is_locked", v)} /><SettingRow icon={<MessageSquare />} label="Chat" description={settings.chat_enabled ? "Room chat is enabled" : "Room chat is disabled"} value={settings.chat_enabled} busy={saving === "chat_enabled"} onToggle={v => void update("chat_enabled", v)} /><SettingRow icon={<Gift />} label="Gifts" description={settings.gifts_enabled ? "Gifting is enabled" : "Gifting is disabled"} value={settings.gifts_enabled} busy={saving === "gifts_enabled"} onToggle={v => void update("gifts_enabled", v)} /><SettingRow icon={settings.guest_mic_enabled ? <Mic /> : <Mic className="opacity-50" />} label="Guest Mic" description={settings.guest_mic_enabled ? "Guests can use their microphone" : "Guest microphone access is disabled"} value={settings.guest_mic_enabled} busy={saving === "guest_mic_enabled"} onToggle={v => void update("guest_mic_enabled", v)} /></div>
          <div className="space-y-2"><div className="text-[10px] font-bold uppercase tracking-wider text-white/50">Moderation & Safety</div><button type="button" onClick={() => void handleAction("kick_room")} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition hover:bg-white/10 active:scale-95"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-red-500/20 text-red-400"><Ban className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="text-xs font-bold">Kick from Room</div><div className="text-[9px] text-white/40">Remove a user instantly</div></div></button></div>
          <div className="space-y-2"><div className="text-[10px] font-bold uppercase tracking-wider text-white/50">Room Security</div><button type="button" onClick={() => void handleAction("block_list")} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition hover:bg-white/10 active:scale-95"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-500/20 text-amber-400"><Shield className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="text-xs font-bold">Block List</div><div className="text-[9px] text-white/40">Manage banned/blocked users</div></div></button></div>
          <div className="space-y-2"><div className="text-[10px] font-bold uppercase tracking-wider text-white/50">Co-Host Management</div><button type="button" onClick={() => void handleAction("co_hosts")} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition hover:bg-white/10 active:scale-95"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-purple-500/20 text-purple-400"><Star className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="text-xs font-bold">Manage Co-Hosts</div><div className="text-[9px] text-white/40">Assign or remove moderators</div></div></button></div>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white/5 px-3 py-2 text-[9px] text-white/45 shrink-0"><Check className="h-3.5 w-3.5 text-emerald-300 shrink-0" />Changes sync live instantly across all participants in this room.</div>
      </section>
    </div>
  );
}

const labels: Record<string, string> = { is_locked: "Room lock", chat_enabled: "Chat", gifts_enabled: "Gifts", guest_mic_enabled: "Guest mic", seat_count: "Seat capacity", music_enabled: "Music" };

function SettingRow({ icon, label, description, value, busy, onToggle }: { icon: React.ReactNode; label: string; description: string; value: boolean; busy: boolean; onToggle: (value: boolean) => void }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-white/80">{icon}</div><div className="min-w-0 flex-1"><div className="text-xs font-bold">{label}</div><div className="text-[9px] text-white/40">{description}</div></div><button type="button" role="switch" aria-checked={value} disabled={busy} onClick={() => onToggle(!value)} className={`relative h-7 w-12 rounded-full p-1 transition-colors ${value ? "bg-[color:var(--primary)]" : "bg-white/15"} disabled:opacity-50`} aria-label={`${label}: ${value ? "enabled" : "disabled"}`}><span className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${value ? "translate-x-5" : "translate-x-0"}`}>{busy ? <RefreshCw className="h-3 w-3 animate-spin text-slate-500" /> : null}</span></button></div>;
}
