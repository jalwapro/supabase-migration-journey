import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { frameForLevel } from "@/lib/levelFrames";
import { resolveAssetUrl } from "@/lib/assetUrl";

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

type LevelFrameConfig = { level: number; frame_url: string | null; popup_frame_url: string | null };

export function VoiceRoomMemberSheet({
  roomId,
  member,
  canModerate,
  isHost = false,
  onClose,
  onKicked,
  onOpenProfile,
  onOpenMessage,
  onOpenPublicChat,
  onOpenHostControls,
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
  const [levelFrame, setLevelFrame] = useState<string | null>(null);
  const [popupFrame, setPopupFrame] = useState<string | null>(null);

  useEffect(() => {
    setProfileOpen(false);
    setMessageOpen(false);
    setMessage("");
    setProfile(null);
    setLevelFrame(null);
    setPopupFrame(null);
    setFollowing(false);
    setBlocked(false);
  }, [member?.id]);

  // The admin VIP Levels table is the source of truth for the popup frame.
  // A level-specific custom frame wins; otherwise the built-in level frame is used.
  useEffect(() => {
    if (!member?.id) return;
    let active = true;
    const loadLevelFrame = async () => {
      const level = Math.max(1, Math.floor(Number(member.level ?? 0)) || 1);
      const { data } = await supabase
        .from("vip_level_config")
        .select("level,frame_url,popup_frame_url")
        .eq("level", level)
        .maybeSingle();
      if (!active) return;
      const row = data as LevelFrameConfig | null;
      setLevelFrame(row?.frame_url || frameForLevel(level));
      setPopupFrame(row?.popup_frame_url || frameForLevel(level));
    };
    void loadLevelFrame();
    return () => { active = false; };
  }, [member?.id, member?.level]);

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
  const displayLevel = Math.max(1, Math.floor(Number(profile?.vip_level ?? member.level ?? 0)) || 1);
  const popupFrameValue = popupFrame || frameForLevel(displayLevel);
  const popupFrameUrl = resolveAssetUrl(popupFrameValue);

  return (
    <div className="fixed inset-0 z-[2147483001] flex items-end justify-center bg-black/65 backdrop-blur-md" onClick={onClose} role="presentation">
      <div className="relative w-full max-w-[480px]">
        {popupFrameUrl ? (
          <div aria-hidden className="pointer-events-none absolute -inset-3 z-0 overflow-visible">
            {/\.(webm|mp4|mov)(\?|$)/i.test(popupFrameUrl) ? (
              <video src={popupFrameUrl} autoPlay loop muted playsInline className="h-full w-full object-fill" />
            ) : (
              <img src={popupFrameUrl} alt="" className="h-full w-full object-fill" />
            )}
          </div>
        ) : null}
        <section className="relative z-10 flex w-full max-h-[88dvh] flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-[#0d0616] p-0 text-white shadow-[0_-18px_60px_rgba(0,0,0,.55)]" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Room member profile">
        <div className="relative z-10 flex min-h-0 flex-col">
                    <div className="relative z-10 flex min-h-0 flex-col overflow-y-auto rounded-t-[28px] bg-[#0d0616] p-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
        <div className="mx-auto mb-4 h-1.5 w-11 rounded-full bg-white/20" />
        <div className="mb-1 flex items-center gap-4">
          <div className="relative h-[84px] w-[84px] shrink-0">
            <div className="absolute inset-[4px] z-10 overflow-hidden rounded-full border-2 border-white/20 bg-black shadow-lg">
              {member.avatar ? <img src={member.avatar} alt={displayName} className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-xl font-black">{displayName.slice(0, 1).toUpperCase()}</div>}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xl font-black">{displayName}</div>
            <div className="mt-1 text-xs font-semibold text-white/55">VIP Level {displayLevel}</div>
            <div className="mt-2 inline-flex w-fit items-center rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold text-emerald-200">● {member.is_muted ? "Microphone muted" : "Microphone active"}</div>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-lg text-white/60" aria-label="Close profile">×</button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-white/10 bg-white/[.045] p-3"><div className="text-[9px] uppercase tracking-wider text-white/40">Gift Score</div><div className="mt-1 text-sm font-black">{Number(member.gift_score ?? 0).toLocaleString()}</div></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3"><div className="text-[9px] uppercase tracking-wider text-white/40">Microphone</div><div className="mt-1 text-sm font-black">{member.is_muted ? "Muted" : "On"}</div></div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => void openProfile()} className="h-12 rounded-2xl border border-white/10 bg-white/7 text-sm font-black">User Profile</button>
          <button type="button" onClick={() => onOpenPublicChat?.(member)} className="h-12 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-sm font-black text-cyan-100">Public Chat</button>
          <button type="button" onClick={() => { onOpenMessage?.(member.id); setMessageOpen(v => !v); }} className="h-12 rounded-2xl bg-[color:var(--primary)] text-sm font-black text-white shadow-lg shadow-[color:var(--primary)]/20">Private Message</button>
          <button type="button" disabled={socialBusy} onClick={() => void toggleFollow()} className="h-12 rounded-2xl border border-white/10 bg-white/7 text-sm font-black disabled:opacity-50">{following ? "Following ✓" : "Follow"}</button>
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

        {onOpenHostControls ? (
          <button type="button" onClick={onOpenHostControls} className="mt-3 flex h-11 w-full items-center justify-center rounded-2xl border border-amber-300/40 bg-amber-500/15 text-sm font-black text-amber-200">Host Controls & Settings</button>
        ) : (canModerate || isHost) && (
          <button type="button" disabled={busy} onClick={() => void kick()} className="mt-3 flex h-11 w-full items-center justify-center rounded-2xl bg-red-500/90 text-sm font-black text-white disabled:opacity-50">{busy ? "Removing…" : "Host Control · Remove / Kick"}</button>
        )}
        </div>
        </div>
        </section>
      </div>
    </div>
  );
}
