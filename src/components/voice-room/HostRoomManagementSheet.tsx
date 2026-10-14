import { useEffect, useState } from"react";
import { Ban, Crown, Loader2, Shield, UserX, X } from"lucide-react";
import { supabase } from"@/integrations/supabase/client";
import { toast } from"sonner";
import { CountryFlag } from"@/components/CountryFlag";

type Props = {
  roomId: string;
  open: boolean;
  mode:"kick" |"block" |"moderators";
  onClose: () => void;
};

type Member = {
  user_id: string;
  username: string | null;
  country?: string | null;
  country_code?: string | null;
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
    if (mode ==="block") {
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
      ? await supabase.from("profiles").select("id,username,avatar,country,country_code").in("id", ids)
      : { data: [] };
    const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));
    setMembers((rows ?? []).map(r => ({
      user_id: r.user_id,
      is_moderator: !!r.is_moderator,
      username: profileMap.get(r.user_id)?.username ?? null,
      avatar: profileMap.get(r.user_id)?.avatar ?? null,
      country: profileMap.get(r.user_id)?.country ?? null,
      country_code: profileMap.get(r.user_id)?.country_code ?? null,
    })));
  };

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, roomId, mode]);

  const moderate = async (userId: string, action:"kick" |"ban") => {
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
      toast.success(action ==="kick" ?"User kicked from room" :"User blocked for 30 days");
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
      toast.success(enabled ?"Moderator assigned" :"Moderator removed");
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

  const title = mode ==="kick" ?"Kick from Room" : mode ==="block" ?"Block List" :"Manage Moderators";
  const description = mode ==="kick" ?"Select a room member to remove instantly." : mode ==="block" ?"Users blocked by this room." :"The existing room-scoped Moderator role is used here; there is no separate Co-Host role.";

  return (
    <div className="fixed inset-0 z-[2147483001] flex items-end justify-center bg-black/60 p-2" onClick={onClose}>
