import { useEffect, useState } from "react";
import { Check, Gift, Lock, MessageSquare, Mic, RefreshCw, Settings, Unlock, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type RoomSettings = {
  is_locked: boolean;
  chat_enabled: boolean;
  gifts_enabled: boolean;
  guest_mic_enabled: boolean;
};

type Props = {
  roomId: string;
  open: boolean;
  onClose: () => void;
  onSettingsChange?: (settings: RoomSettings) => void;
};

const defaults: RoomSettings = { is_locked: false, chat_enabled: true, gifts_enabled: true, guest_mic_enabled: true };

export function HostRoomSettings({ roomId, open, onClose, onSettingsChange }: Props) {
  const [settings, setSettings] = useState<RoomSettings>(defaults);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("live_rooms")
      .select("is_locked,chat_enabled,gifts_enabled,guest_mic_enabled")
      .eq("id", roomId)
      .maybeSingle();
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    if (data) {
      const next = { ...defaults, ...data } as RoomSettings;
      setSettings(next);
      onSettingsChange?.(next);
    }
  };

  useEffect(() => {
    if (!roomId) return;
    void load();
    const channel = supabase
      .channel(`host-room-settings-${roomId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_rooms", filter: `id=eq.${roomId}` }, payload => {
        const row = payload.new as Partial<RoomSettings>;
        const next = { ...defaults, ...row } as RoomSettings;
        setSettings(prev => ({ ...prev, ...next }));
        onSettingsChange?.(next);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [roomId]);

  const update = async (key: keyof RoomSettings, value: boolean) => {
    if (saving) return;
    setSaving(key);
    const { data, error } = await supabase.rpc("host_update_room_settings", {
      _room_id: roomId,
      _is_locked: key === "is_locked" ? value : null,
      _chat_enabled: key === "chat_enabled" ? value : null,
      _gifts_enabled: key === "gifts_enabled" ? value : null,
      _guest_mic_enabled: key === "guest_mic_enabled" ? value : null,
    });
    setSaving(null);
    if (error) { toast.error(error.message); return; }
    const next = { ...settings, ...(data as Partial<RoomSettings>) } as RoomSettings;
    setSettings(next);
    onSettingsChange?.(next);
    toast.success(`${labels[key]} ${value ? "enabled" : "disabled"}`);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[2147483000] flex items-end justify-center bg-black/60 p-2 backdrop-blur-sm" onClick={onClose}>
      <section className="w-full max-w-md rounded-3xl border border-white/15 bg-[#100719] p-4 text-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2"><Settings className="h-5 w-5 text-[color:var(--secondary)]" /><div><h2 className="text-base font-black">Host Room Settings</h2><p className="text-[9px] text-white/45">Only the room Host can change these settings.</p></div></div>
          <div className="flex items-center gap-1"><button type="button" onClick={() => void load()} disabled={loading} className="grid h-8 w-8 place-items-center rounded-full bg-white/10 disabled:opacity-40" aria-label="Refresh settings"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button><button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-white/10" aria-label="Close settings"><X className="h-4 w-4" /></button></div>
        </div>
        <div className="space-y-2">
          <SettingRow icon={settings.is_locked ? <Unlock /> : <Lock />} label="Room Lock" description={settings.is_locked ? "New room entry is locked" : "Users can enter the room"} value={settings.is_locked} busy={saving === "is_locked"} onToggle={v => void update("is_locked", v)} />
          <SettingRow icon={<MessageSquare />} label="Chat" description={settings.chat_enabled ? "Room chat is enabled" : "Room chat is disabled"} value={settings.chat_enabled} busy={saving === "chat_enabled"} onToggle={v => void update("chat_enabled", v)} />
          <SettingRow icon={<Gift />} label="Gifts" description={settings.gifts_enabled ? "Gifting is enabled" : "Gifting is disabled"} value={settings.gifts_enabled} busy={saving === "gifts_enabled"} onToggle={v => void update("gifts_enabled", v)} />
          <SettingRow icon={settings.guest_mic_enabled ? <Mic /> : <Mic className="opacity-50" />} label="Guest Mic" description={settings.guest_mic_enabled ? "Guests can use their microphone" : "Guest microphone access is disabled"} value={settings.guest_mic_enabled} busy={saving === "guest_mic_enabled"} onToggle={v => void update("guest_mic_enabled", v)} />
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white/5 px-3 py-2 text-[9px] text-white/45"><Check className="h-3.5 w-3.5 text-emerald-300" />Changes are saved server-side and synchronized live to everyone in this room.</div>
      </section>
    </div>
  );
}

const labels: Record<keyof RoomSettings, string> = { is_locked: "Room lock", chat_enabled: "Chat", gifts_enabled: "Gifts", guest_mic_enabled: "Guest mic" };

function SettingRow({ icon, label, description, value, busy, onToggle }: { icon: React.ReactNode; label: string; description: string; value: boolean; busy: boolean; onToggle: (value: boolean) => void }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-white/80">{icon}</div><div className="min-w-0 flex-1"><div className="text-xs font-bold">{label}</div><div className="text-[9px] text-white/40">{description}</div></div><button type="button" role="switch" aria-checked={value} disabled={busy} onClick={() => onToggle(!value)} className={`relative h-7 w-12 rounded-full p-1 transition-colors ${value ? "bg-[color:var(--primary)]" : "bg-white/15"} disabled:opacity-50`} aria-label={`${label}: ${value ? "enabled" : "disabled"}`}><span className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${value ? "translate-x-5" : "translate-x-0"}`}>{busy ? <RefreshCw className="h-3 w-3 animate-spin text-slate-500" /> : null}</span></button></div>;
}
