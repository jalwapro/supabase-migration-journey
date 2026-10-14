import { useEffect, useState } from "react";
import {
  Heart,
  Sparkles,
  Calendar,
  Award,
  BookOpen,
  Send,
  Trash2,
  CheckCircle,
  Gift,
  Coins,
  ImagePlus,
  X,
  Flame,
  Clock,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import {
  getCpSpaceDetails,
  getCpDailyTasksWithStatus,
  claimDailyCpTask,
  getCpDiaryPosts,
  postCpDiary,
  deleteCpDiary,
  getCpExclusiveGifts,
  sendCpExclusiveGift,
  uploadCpMemoryPhoto,
  type CpSpaceDetails,
  type CpDailyTask,
  type CpDiaryPost,
  type CpExclusiveGift,
} from "./cpEcosystemApi";

type Props = {
  userId: string;
  onOpenBreakupDialog?: () => void;
};

export function CpSpaceView({ userId, onOpenBreakupDialog }: Props) {
  const [space, setSpace] = useState<CpSpaceDetails | null>(null);
  const [tasks, setTasks] = useState<CpDailyTask[]>([]);
  const [posts, setPosts] = useState<CpDiaryPost[]>([]);
  const [gifts, setGifts] = useState<CpExclusiveGift[]>([]);
  const [confirmGift, setConfirmGift] = useState<CpExclusiveGift | null>(null);
  const [giftCelebration, setGiftCelebration] = useState<CpExclusiveGift | null>(null);
  const [sendingGift, setSendingGift] = useState<string | null>(null);
  const [newPostText, setNewPostText] = useState("");
  const [newPostImage, setNewPostImage] = useState<File | null>(null);
  const [imageInputKey, setImageInputKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submittingPost, setSubmittingPost] = useState(false);
  const [claimingTask, setClaimingTask] = useState<string | null>(null);

  const loadAll = async () => {
    try {
      setLoading(true);
      const spaceData = await getCpSpaceDetails(userId);
      setSpace(spaceData);
      if (spaceData?.relation_id) {
        const [taskData, diaryData, giftData] = await Promise.all([
          getCpDailyTasksWithStatus(spaceData.relation_id),
          getCpDiaryPosts(spaceData.relation_id),
          getCpExclusiveGifts(),
        ]);
        setTasks(taskData);
        setPosts(diaryData);
        setGifts(giftData);
      } else {
        setTasks([]);
        setPosts([]);
        setGifts([]);
        setConfirmGift(null);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load CP Space");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, [userId]);

  const handleSendExclusiveGift = async (gift: CpExclusiveGift) => {
    try {
      setSendingGift(gift.id);
      const result = await sendCpExclusiveGift(gift.id);
      setConfirmGift(null);
      setGiftCelebration(gift);
      toast.success(`${result.gift_name} sent! +${result.points_added} intimacy ❤️`);
      await loadAll();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not send CP gift");
    } finally {
      setSendingGift(null);
    }
  };

  const handleClaimTask = async (taskKey: string) => {
    try {
      setClaimingTask(taskKey);
      await claimDailyCpTask(taskKey);
      toast.success("Task completed! +Intimacy points added ❤️");
      if (space?.relation_id) {
        const [updatedTasks, updatedSpace] = await Promise.all([
          getCpDailyTasksWithStatus(space.relation_id),
          getCpSpaceDetails(userId),
        ]);
        setTasks(updatedTasks);
        setSpace(updatedSpace);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to claim task");
    } finally {
      setClaimingTask(null);
    }
  };

  const handleCreatePost = async () => {
    if (!space?.relation_id) return;
    const trimmed = newPostText.trim();
    if (!trimmed && !newPostImage) {
      toast.error("Write a message or pick a photo to post");
      return;
    }
    try {
      setSubmittingPost(true);
      let uploadedUrl: string | undefined;
      if (newPostImage) {
        toast.info("Uploading memory photo…");
        uploadedUrl = await uploadCpMemoryPhoto(space.relation_id, newPostImage);
      }
      const post = await postCpDiary(space.relation_id, trimmed, uploadedUrl);
      setPosts((prev) => [post, ...prev]);
      setNewPostText("");
      setNewPostImage(null);
      setImageInputKey((key) => key + 1);
      toast.success("Memory saved in Couple Diary! 💕");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to post");
    } finally {
      setSubmittingPost(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      await deleteCpDiary(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      toast.success("Memory removed");
    } catch {
      toast.error("Could not delete memory");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-pink-300">
        <div className="relative">
          <Heart className="h-10 w-10 animate-ping text-pink-500/40" />
          <Heart className="absolute inset-0 h-10 w-10 text-pink-500 fill-pink-500 animate-pulse" />
        </div>
        <p className="mt-4 text-xs font-bold tracking-wider uppercase text-pink-300/80">Loading your Love Sanctuary…</p>
      </div>
    );
  }

  if (!space) {
    return (
      <div className="rounded-3xl border border-pink-500/20 bg-gradient-to-b from-pink-950/20 via-zinc-950 to-zinc-950 p-8 text-center text-white">
        <Heart className="mx-auto h-12 w-12 text-pink-400 opacity-60" />
        <h2 className="mt-4 text-xl font-bold">You are not in a CP yet</h2>
        <p className="mt-2 text-sm text-zinc-400">Search for your favorite partner and send them a proposal to open your couple space!</p>
      </div>
    );
  }

  const intimacyScore = Number(space.intimacy_score) || 0;
  const levelProgress = Math.min(100, Math.max(0, (intimacyScore % 5000) / 50));

  return (
    <div className="space-y-5">
      {/* Gift Celebration Popup */}
      {giftCelebration && (
        <div
          className="fixed inset-0 z-[120] grid place-items-center bg-black/80 p-4 backdrop-blur-md"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setGiftCelebration(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="cp-gift-celebration-title"
            className="relative w-full max-w-xs overflow-hidden rounded-3xl border border-pink-400/40 bg-gradient-to-b from-[#2e0c3d] via-[#1a0824] to-[#0c0312] p-6 text-center text-white shadow-2xl shadow-pink-500/30 animate-in zoom-in-95 duration-200"
          >
            <button
              type="button"
              onClick={() => setGiftCelebration(null)}
              aria-label="Close"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/80 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl border border-pink-300/30 bg-white/5 shadow-xl shadow-pink-500/30">
              <img
                src={giftCelebration.icon_url}
                alt=""
                className="h-20 w-20 object-contain drop-shadow-2xl animate-bounce"
              />
            </div>
            <h2 id="cp-gift-celebration-title" className="mt-4 text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-200 via-rose-200 to-amber-200">
              {giftCelebration.name} Sent! ❤️
            </h2>
            <p className="mt-1 text-xs text-pink-200/80">Your couple intimacy is growing stronger.</p>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 border border-amber-400/30 px-3.5 py-1 text-xs font-black text-amber-300">
              <Flame className="h-3.5 w-3.5 fill-amber-300" />
              <span>+{giftCelebration.intimacy_points.toLocaleString()} Intimacy Added</span>
            </div>
            <button
              type="button"
              onClick={() => setGiftCelebration(null)}
              className="mt-5 w-full rounded-2xl bg-gradient-to-r from-pink-600 via-rose-500 to-amber-400 px-4 py-3 text-xs font-black text-white shadow-lg shadow-pink-600/30"
            >
              Cherish the Moment 💕
            </button>
          </section>
        </div>
      )}

      {/* LUXURY COUPLE BRIDGE HERO CARD */}
      <div className="relative overflow-hidden rounded-3xl border border-pink-500/30 bg-gradient-to-b from-[#2a0e3b]/80 via-[#180826]/90 to-[#0e0316] p-6 text-white shadow-2xl backdrop-blur-xl">
        {/* Glow Spheres */}
        <div className="pointer-events-none absolute -left-12 -top-12 h-44 w-44 rounded-full bg-pink-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-purple-500/25 blur-3xl" />

        <div className="relative z-10 flex flex-col items-center text-center">
          {/* Days Together Royal Plaque */}
          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/40 bg-gradient-to-r from-amber-500/20 via-pink-500/20 to-purple-500/20 px-4 py-1 text-[11px] font-black tracking-widest text-amber-200 shadow-md">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            <span>TOGETHER FOR {space.days_together} {space.days_together === 1 ? "DAY" : "DAYS"}</span>
          </div>

          {/* Couple Bridge Avatars */}
          <div className="mt-6 flex items-center justify-center gap-3 sm:gap-6">
            {/* User 1 (Me) */}
            <div className="flex flex-col items-center">
              <div className="relative p-1 rounded-full bg-gradient-to-tr from-pink-500 via-rose-400 to-amber-300 shadow-xl shadow-pink-500/30">
                <img
                  src={space.me.avatar || "/avatar-placeholder.png"}
                  alt=""
                  className="h-20 w-20 sm:h-24 sm:w-24 rounded-full object-cover border-2 border-[#13071f]"
                />
                <span className="absolute -bottom-1 -right-1 rounded-full bg-pink-600 border border-white px-1.5 py-0.5 text-[9px] font-black text-white">
                  You
                </span>
              </div>
              <span className="mt-2 max-w-[90px] truncate text-xs font-black text-white">
                {space.me.username || "Me"}
              </span>
            </div>

            {/* Connecting Bridge & Ring */}
            <div className="flex flex-col items-center px-1">
              <div className="relative flex items-center justify-center">
                {/* Connecting glowing line */}
                <div className="absolute w-20 sm:w-28 h-0.5 bg-gradient-to-r from-pink-500 via-rose-400 to-purple-500 shadow-[0_0_10px_rgba(244,63,94,0.8)]" />
                <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border border-amber-400/50 bg-gradient-to-tr from-amber-400 via-pink-500 to-rose-400 text-2xl shadow-xl shadow-pink-500/50 animate-pulse">
                  💍
                </div>
              </div>
              <span className="mt-2 max-w-[110px] truncate text-[10px] font-black tracking-wide text-amber-300 uppercase">
                {space.ring_name || "Love Ring"}
              </span>
            </div>

            {/* User 2 (Partner) */}
            <div className="flex flex-col items-center">
              <div className="relative p-1 rounded-full bg-gradient-to-tr from-purple-500 via-fuchsia-400 to-pink-400 shadow-xl shadow-purple-500/30">
                <img
                  src={space.partner.avatar || "/avatar-placeholder.png"}
                  alt=""
                  className="h-20 w-20 sm:h-24 sm:w-24 rounded-full object-cover border-2 border-[#13071f]"
                />
                <span className="absolute -bottom-1 -right-1 rounded-full bg-purple-600 border border-white px-1.5 py-0.5 text-[9px] font-black text-white">
                  Partner
                </span>
              </div>
              <span className="mt-2 max-w-[90px] truncate text-xs font-black text-white">
                {space.partner.username || "Partner"}
              </span>
            </div>
          </div>

          {/* Intimacy Level Bar */}
          <div className="mt-6 w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur-md">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-1.5 text-pink-300">
                <Award className="h-4 w-4 text-amber-400" />
                <span>Level {space.level} · {space.level_name}</span>
              </span>
              <span className="flex items-center gap-1 text-amber-300 font-extrabold">
                <Flame className="h-3.5 w-3.5 fill-amber-300" />
                <span>{intimacyScore.toLocaleString()} Intimacy</span>
              </span>
            </div>
            <div className="mt-2.5 h-3 w-full overflow-hidden rounded-full bg-black/50 p-0.5 border border-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-pink-500 via-rose-400 to-amber-400 shadow-[0_0_12px_rgba(244,63,94,0.6)] transition-all duration-700"
                style={{ width: `${Math.max(5, levelProgress)}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-zinc-400">
              <span>Current Level EXP</span>
              <span>Next Level Milestone</span>
            </div>
          </div>

          {onOpenBreakupDialog && (
            <button
              type="button"
              onClick={onOpenBreakupDialog}
              className="mt-4 inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-400 hover:text-rose-300 transition-colors"
            >
              <ShieldAlert className="h-3 w-3" />
              <span>Relationship Settings</span>
            </button>
          )}
        </div>
      </div>

      {/* EXCLUSIVE COUPLE GIFTS */}
      <div className="rounded-3xl border border-pink-500/20 bg-gradient-to-b from-[#21092e]/80 via-[#13061c]/90 to-[#0b0312] p-5 text-white shadow-xl backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/5">
          <div>
            <h3 className="flex items-center gap-2 text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-200 to-rose-200">
              <Gift className="h-4 w-4 text-pink-400" />
              Exclusive Couple Gifts
            </h3>
            <p className="text-[11px] text-zinc-400">Increase CP level & intimacy fast</p>
          </div>
          <span className="rounded-full bg-pink-500/10 border border-pink-500/20 px-2.5 py-0.5 text-[10px] font-bold text-pink-300">
            Special Effects
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {gifts.map((gift) => {
            const locked = space.level < gift.required_cp_level;
            const confirming = confirmGift?.id === gift.id;
            return (
              <div
                key={gift.id}
                className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 hover:bg-white/[0.05] transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-1 shadow-inner">
                    <img
                      src={gift.icon_url}
                      alt=""
                      loading="lazy"
                      className="h-14 w-14 object-contain drop-shadow-md"
                      onError={(e) => {
                        e.currentTarget.style.visibility = "hidden";
                      }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-white">{gift.name}</p>
                    <p className="mt-0.5 text-[11px] text-zinc-400 leading-snug line-clamp-2">
                      {gift.description}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-xs font-bold">
                      <span className="inline-flex items-center gap-1 text-amber-300">
                        <Coins className="h-3.5 w-3.5" />
                        {gift.price.toLocaleString()}
                      </span>
                      <span className="inline-flex items-center gap-1 text-pink-300">
                        <Flame className="h-3 w-3 fill-pink-300" />
                        +{gift.intimacy_points} EXP
                      </span>
                    </div>
                    {locked && (
                      <p className="mt-1 text-[10px] font-bold text-rose-400">
                        🔒 Unlocks at CP Level {gift.required_cp_level}
                      </p>
                    )}
                  </div>
                </div>

                {confirming ? (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmGift(null)}
                      className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2 text-xs font-bold text-zinc-300 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={sendingGift === gift.id}
                      onClick={() => void handleSendExclusiveGift(gift)}
                      className="flex-1 rounded-xl bg-gradient-to-r from-pink-600 via-rose-500 to-amber-400 py-2 text-xs font-black text-white shadow-lg shadow-pink-600/30 hover:brightness-110 disabled:opacity-50"
                    >
                      {sendingGift === gift.id ? "Sending…" : `Send (${gift.price.toLocaleString()})`}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={locked || sendingGift !== null}
                    onClick={() => setConfirmGift(gift)}
                    className="mt-3 w-full rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 py-2 text-xs font-black text-white shadow-md shadow-pink-600/20 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 transition-all"
                  >
                    {locked ? "Level Locked" : "Send Romantic Gift"}
                  </button>
                )}
              </div>
            );
          })}
          {gifts.length === 0 && (
            <p className="col-span-full rounded-2xl bg-white/[0.02] p-6 text-center text-xs text-zinc-500">
              No exclusive couple gifts available right now.
            </p>
          )}
        </div>
      </div>

      {/* DAILY COUPLE TASKS */}
      <div className="rounded-3xl border border-pink-500/20 bg-gradient-to-b from-[#21092e]/80 via-[#13061c]/90 to-[#0b0312] p-5 text-white shadow-xl backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/5">
          <div>
            <h3 className="flex items-center gap-2 text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-200">
              <Sparkles className="h-4 w-4 text-amber-400" />
              Daily Couple Quests
            </h3>
            <p className="text-[11px] text-zinc-400">Complete tasks together for free intimacy points</p>
          </div>
          <span className="flex items-center gap-1 text-[10px] text-zinc-400">
            <Clock className="h-3 w-3" />
            00:00 KSA Reset
          </span>
        </div>

        <div className="mt-4 space-y-2.5">
          {tasks.map((task) => (
            <div
              key={task.task_key}
              className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3.5 hover:bg-white/[0.05] transition-all"
            >
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-white">{task.title}</p>
                <p className="mt-0.5 text-[11px] text-zinc-400">{task.description}</p>
              </div>

              {task.completed_today ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-emerald-500/20 border border-emerald-400/30 px-3 py-1.5 text-xs font-bold text-emerald-300">
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span>Claimed</span>
                </span>
              ) : (
                <button
                  type="button"
                  disabled={claimingTask === task.task_key}
                  onClick={() => void handleClaimTask(task.task_key)}
                  className="shrink-0 rounded-xl bg-gradient-to-r from-pink-600 via-rose-500 to-amber-400 px-3.5 py-1.5 text-xs font-black text-white shadow-md shadow-pink-600/20 hover:brightness-110 disabled:opacity-50 transition-all"
                >
                  {claimingTask === task.task_key ? "Claiming…" : `+${task.intimacy_reward} Claim`}
                </button>
              )}
            </div>
          ))}
          {tasks.length === 0 && (
            <p className="text-center text-xs text-zinc-500 py-4">No daily tasks available today.</p>
          )}
        </div>
      </div>

      {/* COUPLE MEMORY DIARY & PHOTOS */}
      <div className="rounded-3xl border border-pink-500/20 bg-gradient-to-b from-[#21092e]/80 via-[#13061c]/90 to-[#0b0312] p-5 text-white shadow-xl backdrop-blur-xl">
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <h3 className="flex items-center gap-2 text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-200 to-purple-200">
            <BookOpen className="h-4 w-4 text-pink-400" />
            Couple Diary & Love Wall
          </h3>
          <span className="text-[10px] text-zinc-400">Private between you two</span>
        </div>

        {/* Input box */}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            maxLength={1000}
            value={newPostText}
            onChange={(e) => setNewPostText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleCreatePost();
              }
            }}
            placeholder="Write a sweet memory or note for your love…"
            className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/40 px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-pink-500 focus:outline-none"
          />
          <div className="flex gap-2">
            <label
              className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-pink-300 hover:bg-white/10 transition-colors"
              title="Add photo"
            >
              <ImagePlus className="h-4 w-4" />
              <input
                key={imageInputKey}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  if (file && file.size > 10 * 1024 * 1024) {
                    toast.error("Photo must be 10 MB or smaller");
                    event.target.value = "";
                    return;
                  }
                  setNewPostImage(file);
                }}
              />
            </label>
            <button
              type="button"
              disabled={submittingPost || (!newPostText.trim() && !newPostImage)}
              onClick={() => void handleCreatePost()}
              className="flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-pink-600 to-rose-500 px-4 py-2 text-xs font-black text-white shadow-md shadow-pink-600/20 disabled:opacity-40 transition-all"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{submittingPost ? "Saving…" : "Post"}</span>
            </button>
          </div>
        </div>

        {newPostImage && (
          <div className="mt-3 flex items-center justify-between rounded-xl border border-pink-500/30 bg-pink-500/10 p-2 text-xs text-pink-200">
            <div className="flex items-center gap-2 min-w-0">
              <ImagePlus className="h-4 w-4 shrink-0 text-pink-300" />
              <span className="truncate">{newPostImage.name}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setNewPostImage(null);
                setImageInputKey((key) => key + 1);
              }}
              className="text-white/60 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Posts feed */}
        <div className="mt-4 space-y-3">
          {posts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-xs text-zinc-500">
              <p className="text-2xl mb-1">💌</p>
              <p>No love notes recorded yet. Write your first memory together!</p>
            </div>
          ) : (
            posts.map((post) => (
              <div
                key={post.id}
                className="relative rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-xs hover:bg-white/[0.04] transition-all"
              >
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span className="font-semibold">{new Date(post.created_at).toLocaleDateString()}</span>
                  {post.author_id === userId && (
                    <button
                      type="button"
                      onClick={() => void handleDeletePost(post.id)}
                      className="text-zinc-500 hover:text-rose-400 transition-colors"
                      title="Delete post"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {post.content && (
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-zinc-100 leading-relaxed font-medium">
                    {post.content}
                  </p>
                )}
                {post.image_url && (
                  <img
                    src={post.image_url}
                    alt="CP Memory"
                    loading="lazy"
                    className="mt-3 max-h-72 w-full rounded-2xl object-cover border border-white/10 shadow-lg"
                  />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
