import { useEffect, useState } from "react";
import { Check, Gift, Lock, MessageSquare, Mic, RefreshCw, Settings, Unlock, X, Users, VolumeX, ShieldAlert, Music, Shield, Ban, Star, ArrowLeft } from "lucide-react";
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
};

const defaults: RoomSettings = { is_locked: false, chat_enabled: true, gifts_enabled: true, guest_mic_enabled: true, music_enabled: true, seat_count: 8, stage_locked: false };

type ActiveView = "main" | "kick" | "block" | "moderators";

export function HostRoomSettings({ roomId, open, onClose, onSettingsChange, onOpenMusic }: Props) {
  const [settings, setSettings] = useState<RoomSettings>(defaults);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>("main");

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
    const next = { ...settings, ...(data as Partial<RoomSettings>) } as RoomSettings; setSettings(next); onSettingsChange?.(next); toast.success(`${labels[key]}${value ? "enabled" : "disabled"}`);
  };

  const handleAction = async (actionType: string) => {
    if (actionType === "kick_room") { setActiveView("kick"); return; }
    if (actionType === "block_list") { setActiveView("block"); return; }
    if (actionType === "co_hosts") { setActiveView("moderators"); return; }
    setSaving(actionType);
    try {
      if (actionType === "mute_all") {
        const { error } = await supabase.from("room_members").update({ is_muted: true }).eq("room_id", roomId);
        if (error) throw error;
        toast.success("All speakers muted");
      } else if (actionType === "clear_hands") {
        toast.info("Hand raise queue cleared.");
      }
    } catch (err: any) { toast.error(err?.message || "Action failed"); }
    finally { setSaving(null); }
  };

  // Animation reset jab view change ho
  useEffect(() => {
    if (open) {
      // Optionally add logic here to animate internal views if needed
    }
  }, [activeView, open]);

  return (
    /* Backdrop */
    <div 
      className={`fixed inset-0 z-[2147483000] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
      onClick={onClose}
    >
      {/* Keyboard-style Popup: Slide up from bottom, rounded top corners */}
      <section 
        className={`w-full max-w-sm rounded-t-3xl border border-white/20 bg-[#100719]/95 p-3 text-white shadow-2xl backdrop-blur-md max-h-[65dvh] flex flex-col transition-transform duration-300 ease-out ${open ? 'translate-y-0' : 'translate-y-full'}`} 
        onClick={e => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="mb-2.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            {activeView !== "main" ? (
              <button type="button" onClick={() => setActiveView("main")} className="grid h-7 w-7 place-items-center rounded-full bg-white/10 active:scale-95 transition" aria-label="Back">
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
            ) : (
              <Settings className="h-4 w-4 text-[color:var(--secondary)]" />
            )}
            <h2 className="text-xs font-black">
              {activeView === "main" && "Host Controls & Settings"}
              {activeView === "kick" && "Kick Participant"}
              {activeView === "block" && "Blocked Users List"}
              {activeView === "moderators" && "Manage Co-Hosts"}
            </h2>
          </div>
          <div className="flex items-center gap-1">
            {activeView === "main" && (
              <button type="button" onClick={() => void load()} disabled={loading} className="grid h-7 w-7 place-items-center rounded-full bg-white/10 active:scale-95 transition" aria-label="Refresh">
                <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
              </button>
            )}
            <button type="button" onClick={onClose} className="grid h-7 w-7 place-items-center rounded-full bg-white/10 active:scale-95 transition" aria-label="Close">
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Body Views */}
        <div className="space-y-2.5 overflow-y-auto pr-1 flex-1 text-xs">
          {activeView === "main" ? (
            <>
              {/* Seat Capacity Row */}
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5">
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-[color:var(--secondary)]" />
                  <span className="font-bold text-[11px]">Seats Capacity</span>
                </div>
                <select 
                  value={settings.seat_count ?? 8} 
                  disabled={saving === "seat_count"}
                  onChange={e => void update("seat_count", Number(e.target.value))}
                  className="bg-black/60 border border-white/20 rounded-lg px-2 py-0.5 text-[10px] font-semibold text-white outline-none"
                >
                  {[4, 8, 12, 16, 20].map(num => <option key={num} value={num} className="bg-slate-900 text-white">{num} Seats</option>)}
                </select>
              </div>

              {/* Quick Actions Grid */}
              <div>
                <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-white/50">Quick Actions</div>
                <div className="grid grid-cols-4 gap-1.5 text-center">
                  <ActionButton icon={<VolumeX className="h-3.5 w-3.5 text-red-300" />} label="Mute All" onClick={() => void handleAction("mute_all")} busy={saving === "mute_all"} />
                  <ActionButton icon={<ShieldAlert className="h-3.5 w-3.5 text-amber-300" />} label="Clear" onClick={() => void handleAction("clear_hands")} busy={saving === "clear_hands"} />
                  <ActionButton icon={<Music className="h-3.5 w-3.5 text-pink-300" />} label="Music" onClick={() => { onClose(); onOpenMusic?.(); }} />
                  <ActionButton icon={<Ban className="h-3.5 w-3.5 text-rose-400" />} label="Kick" onClick={() => void handleAction("kick_room")} busy={saving === "kick_room"} />
                  <ActionButton icon={<Shield className="h-3.5 w-3.5 text-blue-300" />} label="Block" onClick={() => void handleAction("block_list")} />
                  <ActionButton icon={<Star className="h-3.5 w-3.5 text-purple-300" />} label="Co-Hosts" onClick={() => void handleAction("co_hosts")} />
                </div>
              </div>

              {/* Toggles Row */}
              <div className="space-y-1">
                <div className="text-[9px] font-bold uppercase tracking-wider text-white/50">Preferences</div>
                <div className="grid grid-cols-3 gap-1.5">
                  <ToggleMini icon={settings.is_locked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />} label="Lock" value={settings.is_locked} busy={saving === "is_locked"} onToggle={v => void update("is_locked", v)} />
                  <ToggleMini icon={<MessageSquare className="h-3.5 w-3.5" />} label="Chat" value={settings.chat_enabled} busy={saving === "chat_enabled"} onToggle={v => void update("chat_enabled", v)} />
                  <ToggleMini icon={<Mic className="h-3.5 w-3.5" />} label="Mic" value={settings.guest_mic_enabled} busy={saving === "guest_mic_enabled"} onToggle={v => void update("guest_mic_enabled", v)} />
                </div>
              </div>
            </>
          ) : (
            /* Sub-View for Kick / Block / Co-Hosts inside the same popup */
            <div className="flex flex-col items-center justify-center h-full py-6 text-center text-white/60">
              {activeView === "kick" && (
                <div className="space-y-2">
                  <Ban className="h-8 w-8 text-rose-400 mx-auto animate-pulse" />
                  <p className="text-[11px] font-bold text-white">Select a participant from seats to kick</p>
                  <p className="text-[9px] text-white/40">Tap any user profile on stage to remove them.</p>
                </div>
              )}
              {activeView === "block" && (
                <div className="space-y-2">
                  <Shield className="h-8 w-8 text-blue-400 mx-auto" />
                  <p className="text-[11px] font-bold text-white">No blocked users found</p>
                  <p className="text-[9px] text-white/40">Banned or blocked accounts will appear here.</p>
                </div>
              )}
              {activeView === "moderators" && (
                <div className="space-y-2">
                  <Star className="h-8 w-8 text-purple-400 mx-auto" />
                  <p className="text-[11px] font-bold text-white">Promote Room Members</p>
                  <p className="text-[9px] text-white/40">Assign moderators to help manage this room.</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-2.5 flex items-center justify-center gap-1.5 rounded-xl bg-white/5 px-2 py-1 text-[9px] text-white/50 shrink-0">
          <Check className="h-3 w-3 text-emerald-400" />
          <span>Synced live to all participants</span>
        </div>
      </section>
    </div>
  );
}

const labels: Record<string, string> = { is_locked: "Room lock", chat_enabled: "Chat", gifts_enabled: "Gifts", guest_mic_enabled: "Guest mic", seat_count: "Seat capacity" };

function ActionButton({ icon, label, onClick, busy }: { icon: React.ReactNode; label: string; onClick: () => void; busy?: boolean }) {
  return (
    <button 
      type="button" 
      disabled={busy} 
      onClick={onClick} 
      className="group flex flex-col items-center justify-center gap-1 p-1.5 rounded-xl bg-gradient-to-b from-white/15 to-white/5 border border-white/20 shadow-[0_3px_8px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.2)] active:translate-y-0.5 transition-all disabled:opacity-50"
    >
      <div className="grid h-6 w-6 place-items-center rounded-lg bg-black/30 shadow-inner">
        {busy ? <RefreshCw className="h-3 w-3 animate-spin text-white" /> : icon}
      </div>
      <span className="text-[9px] font-bold tracking-tight text-white/90 truncate w-full">{label}</span>
    </button>
  );
}

function ToggleMini({ icon, label, value, busy, onToggle }: { icon: React.ReactNode; label: string; value: boolean; busy: boolean; onToggle: (val: boolean) => void }) {
  return (
    <button 
      type="button" 
      disabled={busy} 
      onClick={() => onToggle(!value)} 
      className={`flex items-center justify-between p-1.5 rounded-lg border transition-all ${value ? "bg-[color:var(--primary)]/30 border-[color:var(--primary)] shadow-[0_0_8px_rgba(var(--primary),0.3)]" : "bg-white/5 border-white/10"} disabled:opacity-50`}
    >
      <div className="flex items-center gap-1 text-white/90">
        {icon}
        <span className="text-[9px] font-bold">{label}</span>
      </div>
      <div className={`h
