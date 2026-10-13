import { useEffect, useState } from "react";
import { Heart, Sparkles, Calendar, Award, BookOpen, Send, Trash2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import {
  getCpSpaceDetails, getCpDailyTasksWithStatus, claimDailyCpTask,
  getCpDiaryPosts, postCpDiary, deleteCpDiary,
  type CpSpaceDetails, type CpDailyTask, type CpDiaryPost,
} from "./cpEcosystemApi";

type Props = {
  userId: string;
  onOpenBreakupDialog?: () => void;
};

export function CpSpaceView({ userId, onOpenBreakupDialog }: Props) {
  const [space, setSpace] = useState<CpSpaceDetails | null>(null);
  const [tasks, setTasks] = useState<CpDailyTask[]>([]);
  const [posts, setPosts] = useState<CpDiaryPost[]>([]);
  const [newPostText, setNewPostText] = useState("");
  const [loading, setLoading] = useState(true);
  const [submittingPost, setSubmittingPost] = useState(false);
  const [claimingTask, setClaimingTask] = useState<string | null>(null);

  const loadAll = async () => {
    try {
      setLoading(true);
      const spaceData = await getCpSpaceDetails(userId);
      setSpace(spaceData);
      if (spaceData?.relation_id) {
        const [taskData, diaryData] = await Promise.all([
          getCpDailyTasksWithStatus(spaceData.relation_id),
          getCpDiaryPosts(spaceData.relation_id),
        ]);
        setTasks(taskData);
        setPosts(diaryData);
      } else {
        setTasks([]);
        setPosts([]);
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

  const handleClaimTask = async (taskKey: string) => {
    try {
      setClaimingTask(taskKey);
      await claimDailyCpTask(taskKey);
      toast.success("Task completed! +Intimacy added ❤️");
      await loadAll();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not claim task");
    } finally {
      setClaimingTask(null);
    }
  };

  const handleCreatePost = async () => {
    if (!newPostText.trim() || !space?.relation_id) return;
    try {
      setSubmittingPost(true);
      await postCpDiary(space.relation_id, newPostText);
      setNewPostText("");
      toast.success("Memory posted to your CP Wall!");
      setPosts(await getCpDiaryPosts(space.relation_id));
      await loadAll();
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
      toast.success("Post removed");
    } catch {
      toast.error("Could not delete post");
    }
  };

  if (loading) {
    return (
      <div className="grid place-items-center py-16 text-pink-300">
        <Sparkles className="h-8 w-8 animate-spin" />
        <p className="mt-3 text-sm">Loading your CP Space…</p>
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

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-pink-500/30 bg-gradient-to-b from-pink-950/40 via-purple-950/30 to-zinc-950 p-6 text-white shadow-2xl">
        <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-pink-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-purple-500/20 blur-3xl" />
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-pink-400/40 bg-pink-500/20 px-4 py-1 text-xs font-black tracking-wider text-pink-200">
            <Calendar className="h-3.5 w-3.5 text-pink-300" />
            TOGETHER FOR {space.days_together} {space.days_together === 1 ? "DAY" : "DAYS"}
          </div>
          <div className="mt-5 flex items-center justify-center gap-4">
            <div className="relative min-w-0">
              <img src={space.me.avatar || "/avatar-placeholder.png"} alt="" className="h-20 w-20 rounded-full border-2 border-pink-400 object-cover shadow-lg" />
              <span className="mt-1 block max-w-[90px] truncate text-xs font-bold text-zinc-300">{space.me.username || "Me"}</span>
            </div>
            <div className="flex min-w-0 flex-col items-center">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-tr from-pink-500 to-rose-400 text-2xl shadow-lg shadow-pink-500/40 animate-pulse">💍</span>
              <span className="mt-1 max-w-[100px] truncate text-[11px] font-extrabold text-pink-300">{space.ring_name || "Love Ring"}</span>
            </div>
            <div className="relative min-w-0">
              <img src={space.partner.avatar || "/avatar-placeholder.png"} alt="" className="h-20 w-20 rounded-full border-2 border-purple-400 object-cover shadow-lg" />
              <span className="mt-1 block max-w-[90px] truncate text-xs font-bold text-zinc-300">{space.partner.username || "Partner"}</span>
            </div>
          </div>
          <div className="mt-6 w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
            <div className="flex items-center justify-between gap-3 text-xs font-bold">
              <span className="flex items-center gap-1 text-pink-300"><Award className="h-4 w-4 shrink-0" /> Level {space.level} · {space.level_name}</span>
              <span className="text-zinc-300">{Number(space.intimacy_score).toLocaleString()} Intimacy</span>
            </div>
            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
              <div className="h-full rounded-full bg-gradient-to-r from-pink-500 to-rose-400 transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, (Number(space.intimacy_score) % 10000) / 100))}%` }} />
            </div>
          </div>
          {onOpenBreakupDialog && (
            <button type="button" onClick={onOpenBreakupDialog} className="mt-4 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-zinc-400 hover:border-pink-400/40 hover:text-pink-200">
              Manage CP relationship
            </button>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-zinc-900/60 p-5 text-white">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-base font-black"><Sparkles className="h-4 w-4 text-amber-400" /> Daily Couple Tasks</h3>
          <span className="text-xs text-zinc-400">Resets daily at 00:00 KSA</span>
        </div>
        <div className="mt-4 space-y-3">
          {tasks.map((task) => (
            <div key={task.task_key} className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-zinc-950/70 p-3.5">
              <div className="min-w-0">
                <p className="text-sm font-bold">{task.title}</p>
                <p className="mt-0.5 text-xs text-zinc-400">{task.description}</p>
              </div>
              {task.completed_today ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300"><CheckCircle className="h-3.5 w-3.5" /> Done</span>
              ) : (
                <button type="button" disabled={claimingTask === task.task_key} onClick={() => void handleClaimTask(task.task_key)} className="shrink-0 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-3 py-1.5 text-xs font-bold text-white shadow-md hover:opacity-90 disabled:opacity-50">
                  {claimingTask === task.task_key ? "Claiming…" : `+${task.intimacy_reward} Claim`}
                </button>
              )}
            </div>
          ))}
          {tasks.length === 0 && <p className="text-center text-xs text-zinc-500">No daily tasks are configured yet.</p>}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-zinc-900/60 p-5 text-white">
        <h3 className="flex items-center gap-2 text-base font-black"><BookOpen className="h-4 w-4 text-pink-400" /> Couple Diary &amp; Memory Wall</h3>
        <div className="mt-4 flex gap-2">
          <input type="text" maxLength={1000} value={newPostText} onChange={(e) => setNewPostText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleCreatePost(); } }} placeholder="Write a sweet thought or memory for your partner…" className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-zinc-950 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-pink-500 focus:outline-none" />
          <button type="button" aria-label="Post memory" disabled={submittingPost || !newPostText.trim()} onClick={() => void handleCreatePost()} className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-pink-600 text-white disabled:opacity-50"><Send className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 space-y-3">
          {posts.length === 0 ? (
            <p className="rounded-2xl bg-zinc-950/40 p-6 text-center text-xs text-zinc-500">No memories posted yet. Write your first note above!</p>
          ) : posts.map((post) => (
            <div key={post.id} className="relative rounded-2xl border border-white/5 bg-zinc-950/80 p-3.5 text-sm">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>{new Date(post.created_at).toLocaleDateString()}</span>
                {post.author_id === userId && <button type="button" aria-label="Delete memory" onClick={() => void handleDeletePost(post.id)} className="text-zinc-500 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>}
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-zinc-200">{post.content}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
