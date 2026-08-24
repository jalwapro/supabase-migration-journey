import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type VoiceRoomMemberProfile = {
  id: string;
  username: string | null;
  avatar: string | null;
  level?: number | null;
  gift_score?: number;
  is_muted?: boolean;
};

type PublicProfile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar: string | null;
  bio: string | null;
  country: string | null;
  level: number;
  vip_level: number;
  user_code: string | null;
};

export function VoiceRoomMemberSheet({
  roomId,
  member,
  canModerate,
  isHost = false,
  onClose,
  onKicked,
  onOpenProfile,
  onOpenMessage,
}: {
  roomId: string;
  member: VoiceRoomMemberProfile | null;
  canModerate: boolean;
  isHost?: boolean;
  onClose: () => void;
  onKicked?: (userId: string) => void;
  onOpenProfile?: (user: VoiceRoomMemberProfile) => void;
  onOpenMessage?: (userId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [following, setFollowing] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [socialBusy, setSocialBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState<PublicProfile | null>(null);

  useEffect(() => {
    setProfileOpen(false);
    setMessageOpen(false);
    setMessage("");
    setProfile(null);
    setFollowing(false);
    setBlocked(false);
  }, [member?.id]);

  useEffect(() => {
    if (!member) return;
    let active = true;
    const load = async () => {
      const { data: auth } = await supabase.auth.getUser();
      const me = auth.user;
      if (!me || me.id === member.id || !active) return;
      const [{ data: follow }, { data: block }] = await Promise.all([
        supabase.from("follows").select("id").eq("follower_id", me.id).eq("following_id", member.id).maybeSingle(),
        supabase.from("blocked_users").select("blocked_id").eq("blocker_id", me.id).eq("blocked_id", member.id).maybeSingle(),
      ]);
      if (!active) return;
      setFollowing(!!follow);
      setBlocked(!!block);
    };
    void load();
    return () => { active = false; };
  }, [member?.id]);

  if (!member) return null;

  const openProfile = async () => {
    onOpenProfile?.(member);
    setProfileOpen(true);
    const { data, error } = await supabase.rpc("get_profile_public", { _id: member.id }).maybeSingle();
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data) setProfile(data as PublicProfile);
  };

  const toggleFollow = async () => {
    const { data: auth } = await supabase.auth.getUser();
    const me = auth.user;
    if (!me) { toast.error("Please sign in first"); return; }
    if (me.id === member.id) return;
    setSocialBusy(true);
    const { error } = following
      ? await supabase.from("follows").delete().eq("follower_id", me.id).eq("following_id", member.id)
      : await supabase.from("follows").upsert({ follower_id: me.id, following_id: member.id }, { onConflict: "follower_id,following_id", ignoreDuplicates: true });
    setSocialBusy(false);
    if (error) { toast.error(error.message); return; }
    setFollowing(v => !v);
    toast.success(following ? "Unfollowed" : "Following");
  };

  const toggleBlock = async () => {
    const { data: auth } = await supabase.auth.getUser();
    const me = auth.user;
    if (!me) { toast.error("Please sign in first"); return; }
    if (me.id === member.id) return;
    if (!blocked && !window.confirm(`Block ${member.username ?? "this user"}?`)) return;
    setSocialBusy(true);
    const { error } = blocked
      ? await supabase.from("blocked_users").delete().eq("blocker_id", me.id).eq("blocked_id", member.id)
      : await supabase.from("blocked_users").upsert({ blocker_id: me.id, blocked_id: member.id }, { onConflict: "blocker_id,blocked_id" });
    setSocialBusy(false);
    if (error) { toast.error(error.message); return; }
    setBlocked(v => !v);
    toast.success(blocked ? "User unblocked" : "User blocked");
  };

  const sendPrivateMessage = async () => {
    const value = message.trim();
    if (!value) return;
    const { data: auth } = await supabase.auth.getUser();
    const me = auth.user;
    if (!me) { toast.error("Please sign in first"); return; }
    if (me.id === member.id) return;
    setSocialBusy(true);
    const { error } = await supabase.from("direct_messages").insert({
      sender_id: me.id,
      recipient_id: member.id,
      kind: "text",
      message: value,
    });
    setSocialBusy(false);
    if (error) { toast.error(error.message); return; }
    setMessage("");
    toast.success("Private message sent");
  };

  const kick = async () => {
    if (!canModerate || busy) return;
    setBusy(true);
    const { error } = await supabase.rpc("kick_from_room", {
      _room_id: roomId,
      _user_id: member.id,
      _minutes: 30,
    });
    if (error) {
      toast.error(error.message || "Could not remove user");
      setBusy(false);
      return;
    }
    toast.success(`${member.username ?? "User"} removed from the room`);
    onKicked?.(member.id);
    onClose();
  };

  const displayName = profile?.username ?? profile?.full_name ?? member.username ?? "User";

  return (
    <div className="fixed inset-0 z-[2147483001] flex items-end justify-center bg-black/60 p-2 backdrop-blur-sm sm:items-center" onClick={onClose} role="presentation">
      <section className="w-full max-w-sm max-h-[92dvh] overflow-y-auto rounded-3xl border border-white/15 bg-[#0d0616] p-4 text-white shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Room member profile">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
        <div className="flex items-center gap-3">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-[color:var(--primary)] bg-white/5">
            {member.avatar ? <img src={member.avatar} alt={displayName} className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-xl font-black">{displayName.slice(0, 1).toUpperCase()}</div>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-black">{displayName}</div>
            <div className="mt-1 text-xs text-white/60">VIP Level {profile?.vip_level ?? member.level ?? 0}</div>
            <div className="mt-1 text-[10px] text-white/45">Room member · Seat user</div>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-white/70" aria-label="Close profile">×</button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3"><div className="text-[9px] uppercase tracking-wider text-white/40">Gift Score</div><div className="mt-1 text-sm font-black">{Number(member.gift_score ?? 0).toLocaleString()}</div></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3"><div className="text-[9px] uppercase tracking-wider text-white/40">Microphone</div><div className="mt-1 text-sm font-black">{member.is_muted ? "Muted" : "On"}</div></div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => void openProfile()} className="h-11 rounded-2xl bg-white/10 text-sm font-black">User Profile</button>
          <button type="button" onClick={() => { onOpenMessage?.(member.id); setMessageOpen(v => !v); }} className="h-11 rounded-2xl bg-[color:var(--primary)] text-sm font-black text-white">Private Message</button>
        </div>

        {profileOpen && (
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-sm font-black">{displayName}</div>
            {profile?.user_code && <div className="mt-1 text-[10px] text-white/45">ID: {profile.user_code}</div>}
            {profile?.bio && <p className="mt-2 text-xs leading-relaxed text-white/75">{profile.bio}</p>}
            {profile?.country && <div className="mt-2 text-xs text-white/55">📍 {profile.country}</div>}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" disabled={socialBusy} onClick={() => void toggleFollow()} className="h-10 rounded-xl bg-white/10 text-xs font-black disabled:opacity-50">{following ? "Unfollow" : "Follow"}</button>
              <button type="button" disabled={socialBusy} onClick={() => void toggleBlock()} className="h-10 rounded-xl bg-red-500/85 text-xs font-black text-white disabled:opacity-50">{blocked ? "Unblock" : "Block"}</button>
            </div>
            <button type="button" onClick={() => { onClose(); window.location.assign(`/u/${member.id}`); }} className="mt-2 h-10 w-full rounded-xl border border-white/15 bg-white/5 text-xs font-black">Open Full Profile</button>
          </div>
        )}

        {messageOpen && (
          <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-2">
            <textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={2000} placeholder={`Message ${displayName}...`} className="min-h-20 w-full resize-none rounded-xl bg-white/5 p-3 text-sm text-white outline-none placeholder:text-white/35" />
            <button type="button" disabled={socialBusy || !message.trim()} onClick={() => void sendPrivateMessage()} className="mt-2 h-10 w-full rounded-xl bg-[color:var(--primary)] text-sm font-black text-white disabled:opacity-50">{socialBusy ? "Sending…" : "Send Private Message"}</button>
          </div>
        )}

        {(canModerate || isHost) && (
          <button type="button" disabled={busy} onClick={() => void kick()} className="mt-3 flex h-11 w-full items-center justify-center rounded-2xl bg-red-500/90 text-sm font-black text-white disabled:opacity-50">{busy ? "Removing…" : "Host Control · Remove / Kick"}</button>
        )}
      </section>
    </div>
  );
}
