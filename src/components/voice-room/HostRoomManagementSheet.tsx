import { useEffect, useState } from "react";
import { Ban, Crown, Loader2, Shield, UserX, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  roomId: string;
  open: boolean;
  mode: "kick" | "block" | "moderators";
  onClose: () => void;
};

type Member = {
  user_id: string;
  username: string | null;
  avatar: string | null;
  is_moderator: boolean;
};

type BanRow = {
  user_id: string;
  expires_at: string | null;
  reason: string | null;
};

export function HostRoomManagementSheet({ roomId, open, mode, onClose }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [bans, setBans] = useState<BanRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    if (!roomId) return;
    if (mode === "block") {
      const { data, error } = await supabase
        .from("room_bans")
        .select("user_id,expires_at,reason")
        .eq("room_id", roomId)
        .order("expires_at", { ascending: false });
      if (error) toast.error(error.message);
      else setBans((data ?? []) as BanRow[]);
      return;
    }

    const { data: rows, error } = await supabase
      .from("room_members")
      .select("user_id,is_moderator")
      .eq("room_id", roomId);
    if (error) {
      toast.error(error.message);
      return;
    }
    const ids = (rows ?? []).map(r => r.user_id);
    const { data: profiles } = ids.length
      ? await supabase.from("profiles").select("id,username,avatar").in("id", ids)
      : { data: [] };
    const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));
    setMembers((rows ?? []).map(r => ({
      user_id: r.user_id,
      is_moderator: !!r.is_moderator,
      username: profileMap.get(r.user_id)?.username ?? null,
      avatar: profileMap.get(r.user_id)?.avatar ?? null,
    })));
  };

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, roomId, mode]);

  const moderate = async (userId: string, action: "kick" | "ban") => {
    if (busy) return;
    setBusy(`${action}:${userId}`);
    const { error } = await supabase.rpc("moderate_room_user", {
      _room_id: roomId,
      _target_user: userId,
      _action: action,
    });
    setBusy(null);
    if (error) toast.error(error.message);
    else {
      toast.success(action === "kick" ? "User kicked from room" : "User blocked for 30 days");
      await load();
    }
  };

  const toggleModerator = async (userId: string, enabled: boolean) => {
    if (busy) return;
    setBusy(`moderator:${userId}`);
    const { error } = await supabase.rpc("set_room_moderator", {
      _room_id: roomId,
      _user_id: userId,
      _is_moderator: enabled,
    });
    setBusy(null);
    if (error) toast.error(error.message);
    else {
      toast.success(enabled ? "Moderator assigned" : "Moderator removed");
      await load();
    }
  };

  const unban = async (userId: string) => {
    if (busy) return;
    setBusy(`unban:${userId}`);
    const { error } = await supabase.from("room_bans").delete().eq("room_id", roomId).eq("user_id", userId);
    setBusy(null);
    if (error) toast.error(error.message);
    else {
      toast.success("User removed from block list");
      await load();
    }
  };

  if (!open) return null;

  const title = mode === "kick" ? "Kick from Room" : mode === "block" ? "Block List" : "Manage Moderators";
  const description = mode === "kick" ? "Select a room member to remove instantly." : mode === "block" ? "Users blocked by this room." : "The existing room-scoped Moderator role is used here; there is no separate Co-Host role.";

  return (
    <div className="fixed inset-0 z-[2147483001] flex items-end justify-center bg-black/60 p-2 backdrop-blur-sm" onClick={onClose}>
      <section className="w-full max-w-md max-h-[82dvh] overflow-y-auto rounded-3xl border border-white/15 bg-[#100719] p-4 text-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {mode === "kick" ? <UserX className="h-5 w-5 text-amber-300" /> : mode === "block" ? <Ban className="h-5 w-5 text-red-300" /> : <Crown className="h-5 w-5 text-purple-300" />}
            <div><h2 className="text-base font-black">{title}</h2><p className="text-[9px] text-white/45">{description}</p></div>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-white/10"><X className="h-4 w-4" /></button>
        </div>

        {mode === "block" ? (
          <div className="space-y-2">
            {bans.map(b => (
              <div key={b.user_id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-red-500/15 text-red-300"><Ban className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1"><div className="truncate text-xs font-bold">{b.user_id}</div><div className="text-[9px] text-white/40">{b.expires_at ? `Expires ${new Date(b.expires_at).toLocaleString()}` : "No expiry"}</div></div>
                <button type="button" disabled={!!busy} onClick={() => void unban(b.user_id)} className="rounded-xl bg-white/10 px-3 py-2 text-[10px] font-bold disabled:opacity-40">{busy === `unban:${b.user_id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : "Unblock"}</button>
              </div>
            ))}
            {!bans.length && <div className="py-8 text-center text-xs text-white/40">Block list is empty.</div>}
          </div>
        ) : (
          <div className="space-y-2">
            {members.map(m => (
              <div key={m.user_id} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2">
                {m.avatar ? <img src={m.avatar} alt="" className="h-9 w-9 rounded-full object-cover" /> : <div className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-xs font-bold">{(m.username ?? "U")[0]}</div>}
                <div className="min-w-0 flex-1"><div className="truncate text-[11px] font-bold">{m.username ?? "User"}</div><div className="text-[8px] text-white/40">{m.is_moderator ? "Moderator" : "Room member"}</div></div>
                {mode === "kick" ? (
                  <button type="button" disabled={!!busy || m.is_moderator} onClick={() => void moderate(m.user_id, "kick")} className="grid h-8 w-8 place-items-center rounded-lg bg-amber-500/20 text-amber-200 disabled:opacity-30" title="Kick">{busy === `kick:${m.user_id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserX className="h-3.5 w-3.5" />}</button>
                ) : (
                  <button type="button" disabled={!!busy || m.is_moderator} onClick={() => void toggleModerator(m.user_id, true)} className="rounded-xl bg-purple-500/20 px-3 py-2 text-[9px] font-bold disabled:opacity-30">{busy === `moderator:${m.user_id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : "Make Mod"}</button>
                )}
                {mode === "moderators" && m.is_moderator && <button type="button" disabled={!!busy} onClick={() => void toggleModerator(m.user_id, false)} className="rounded-xl bg-white/10 px-3 py-2 text-[9px] font-bold disabled:opacity-30">Remove</button>}
              </div>
            ))}
            {!members.length && <div className="py-8 text-center text-xs text-white/40">No room members found.</div>}
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white/5 px-3 py-2 text-[9px] text-white/45"><Shield className="h-3.5 w-3.5 shrink-0" />All moderation actions use the existing room security RPCs.</div>
      </section>
    </div>
  );
}
