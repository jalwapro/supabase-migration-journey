import { useState } from "react";
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

export function VoiceRoomMemberSheet({
  roomId,
  member,
  canModerate,
  onClose,
  onKicked,
}: {
  roomId: string;
  member: VoiceRoomMemberProfile | null;
  canModerate: boolean;
  onClose: () => void;
  onKicked?: (userId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  if (!member) return null;

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

  return (
    <div
      className="fixed inset-0 z-[2147483001] flex items-end justify-center bg-black/60 p-2 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <section
        className="w-full max-w-sm overflow-hidden rounded-3xl border border-white/15 bg-[#0d0616] p-4 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Room member profile"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
        <div className="flex items-center gap-3">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-[color:var(--primary)] bg-white/5">
            {member.avatar ? (
              <img src={member.avatar} alt={member.username ?? "User"} className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center text-xl font-black">
                {(member.username ?? "U").slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-black">{member.username ?? "User"}</div>
            <div className="mt-1 text-xs text-white/60">VIP Level {member.level ?? 0}</div>
            <div className="mt-1 text-[10px] text-white/45">Room member · Seat user</div>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-white/70" aria-label="Close profile">×</button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-[9px] uppercase tracking-wider text-white/40">Gift Score</div>
            <div className="mt-1 text-sm font-black">{Number(member.gift_score ?? 0).toLocaleString()}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-[9px] uppercase tracking-wider text-white/40">Microphone</div>
            <div className="mt-1 text-sm font-black">{member.is_muted ? "Muted" : "On"}</div>
          </div>
        </div>

        {canModerate && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void kick()}
            className="mt-3 flex h-11 w-full items-center justify-center rounded-2xl bg-red-500/90 text-sm font-black text-white disabled:opacity-50"
          >
            {busy ? "Removing…" : "Remove / Kick from Room"}
          </button>
        )}
      </section>
    </div>
  );
}
