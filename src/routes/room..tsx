
/* ─── Mini profile popup (viewer taps seated user) ─────────── */
function MiniProfileSheet({
  target,
  currentUserId,
  onClose,
}: {
  target: { id: string; username: string | null; avatar: string | null } | null;
  currentUserId: string | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const open = !!target;

  const followState = useQuery({
    queryKey: ["mini-profile-follow", currentUserId, target?.id],
    enabled: !!currentUserId && !!target?.id && currentUserId !== target?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", currentUserId!)
        .eq("following_id", target!.id)
        .maybeSingle();
      return !!data;
    },
  });

  const [busy, setBusy] = React.useState(false);
  const isSelf = !!currentUserId && currentUserId === target?.id;
  const following = !!followState.data;

  async function toggleFollow() {
    if (!currentUserId || !target || isSelf) return;
    setBusy(true);
    try {
      if (following) {
        await supabase.from("follows").delete()
          .eq("follower_id", currentUserId).eq("following_id", target.id);
      } else {
        await supabase.from("follows").insert(
          { follower_id: currentUserId, following_id: target.id },
        );
      }
      await qc.invalidateQueries({ queryKey: ["mini-profile-follow", currentUserId, target.id] });
      toast.success(following ? "Unfollowed" : "Following");
    } catch (e) {
      toast.error((e as Error).message ?? "Follow failed");
    } finally {
      setBusy(false);
    }
  }

  if (!open || !target) return null;

  return (
    <>
      <div
        data-jalwa-overlay="true"
        className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        data-jalwa-overlay-content="true"
        className="fixed bottom-0 left-1/2 z-[71] w-full max-w-[480px] -translate-x-1/2 rounded-t-3xl border-t border-white/10 p-5 text-white shadow-2xl"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)",
          backgroundImage: "linear-gradient(to bottom, #1a0b2e, #2d0b4d, #0a0114)",
        }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/25" />
        <div className="flex flex-col items-center gap-2">
          <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-black ring-2 ring-violet-400/70 shadow-[0_0_20px_rgba(167,139,250,0.5)]">
            {target.avatar ? (
              <img src={target.avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <UserIcon className="h-9 w-9 text-white/50" />
            )}
          </div>
          <p className="text-base font-extrabold">
            {target.username ?? "user"}
          </p>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <button
            disabled={isSelf}
            onClick={() => { onClose(); navigate({ to: "/u/$userId", params: { userId: target.id } }); }}
            className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-white/15 bg-white/5 py-3 text-xs font-bold text-white/90 disabled:opacity-40"
          >
            <UserIcon className="h-4 w-4" />
            Profile
          </button>
          <button
            disabled={isSelf || busy || followState.isLoading}
            onClick={() => void toggleFollow()}
            className={`flex flex-col items-center justify-center gap-1 rounded-2xl border py-3 text-xs font-bold disabled:opacity-40 ${
              following
                ? "border-white/15 bg-white/5 text-white/80"
                : "border-[color:var(--primary)]/60 bg-[color:var(--primary)]/20 text-white"
            }`}
          >
            <UserPlus className="h-4 w-4" />
            {following ? "Following" : "Follow"}
          </button>
          <button
            disabled={isSelf}
            onClick={() => { onClose(); navigate({ to: "/messages/$peerId", params: { peerId: target.id } }); }}
            className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-[color:var(--secondary)]/60 bg-[color:var(--secondary)]/20 py-3 text-xs font-bold text-white disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
            Message
          </button>
        </div>
      </div>
    </>
  );
}
