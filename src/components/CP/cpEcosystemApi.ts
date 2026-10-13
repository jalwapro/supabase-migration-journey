import { supabase } from "@/integrations/supabase/client";

export type CpSpaceDetails = {
  relation_id: string;
  days_together: number;
  intimacy_score: number;
  level: number;
  level_name: string;
  seat_frame_url: string | null;
  badge_url: string | null;
  ring_name: string | null;
  ring_icon: string | null;
  space_bio: string | null;
  started_at: string;
  partner: { id: string; username: string | null; avatar: string | null; user_code?: string | null };
  me: { id: string; username: string | null; avatar: string | null; user_code?: string | null };
};

export type CpDailyTask = {
  task_key: string;
  title: string;
  intimacy_reward: number;
  description: string | null;
  completed_today: boolean;
};

export type CpBroadcastItem = {
  id: string;
  broadcast_type: "new_cp" | "level_up" | "anniversary";
  relation_id?: string | null;
  user1_id: string;
  user2_id: string;
  user1_name: string;
  user2_name: string;
  ring_name?: string | null;
  ring_icon?: string | null;
  level?: number | null;
  message: string;
  created_at: string;
};

export type CpDiaryPost = {
  id: string;
  relation_id: string;
  author_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
};

function errorMessage(error: { message: string }) {
  return new Error(error.message || "CP request failed");
}

export async function getCpSpaceDetails(userId: string): Promise<CpSpaceDetails | null> {
  const { data, error } = await supabase.rpc("cp_get_space_details", { p_user_id: userId });
  if (error) throw errorMessage(error);
  return (data ?? null) as CpSpaceDetails | null;
}

export async function getCpDailyTasksWithStatus(relationId: string): Promise<CpDailyTask[]> {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());

  const [{ data: config, error: configError }, { data: completions, error: completionError }] = await Promise.all([
    supabase.from("cp_daily_tasks_config").select("task_key,title,intimacy_reward,description").order("task_key"),
    supabase.from("cp_daily_task_completions").select("task_key").eq("relation_id", relationId).eq("completion_date", today),
  ]);
  if (configError) throw errorMessage(configError);
  if (completionError) throw errorMessage(completionError);
  const completed = new Set((completions ?? []).map((row) => row.task_key));
  return (config ?? []).map((task) => ({
    ...task,
    intimacy_reward: Number(task.intimacy_reward),
    completed_today: completed.has(task.task_key),
  })) as CpDailyTask[];
}

export async function claimDailyCpTask(taskKey: string): Promise<unknown> {
  const { data, error } = await supabase.rpc("cp_complete_daily_task", { p_task_key: taskKey });
  if (error) throw errorMessage(error);
  return data;
}

export async function getCpDiaryPosts(relationId: string): Promise<CpDiaryPost[]> {
  const { data, error } = await supabase
    .from("cp_diary_posts")
    .select("id,relation_id,author_id,content,image_url,created_at")
    .eq("relation_id", relationId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw errorMessage(error);
  return (data ?? []) as CpDiaryPost[];
}

export async function postCpDiary(relationId: string, content: string, imageUrl?: string | null): Promise<CpDiaryPost> {
  const trimmed = content.trim();
  if (!trimmed) throw new Error("Please write a memory first.");
  if (trimmed.length > 1000) throw new Error("Memory must be 1000 characters or fewer.");
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw errorMessage(authError);
  const user = authData.user;
  if (!user) throw new Error("Please sign in to post a memory.");

  const { data, error } = await supabase
    .from("cp_diary_posts")
    .insert({
      relation_id: relationId,
      author_id: user.id,
      content: trimmed,
      image_url: imageUrl ?? null,
    })
    .select("id,relation_id,author_id,content,image_url,created_at")
    .single();

  if (error) throw errorMessage(error);
  return data as CpDiaryPost;
}

export async function deleteCpDiary(postId: string): Promise<void> {
  const { error } = await supabase.from("cp_diary_posts").delete().eq("id", postId);
  if (error) throw errorMessage(error);
}


export type CpRing = {
  id: string;
  name: string;
  price: number;
  icon_url: string;
  description: string | null;
  broadcast_banner: boolean;
  sort_order: number;
};

export async function getCpRings(): Promise<CpRing[]> {
  const { data, error } = await supabase
    .from("cp_rings_config")
    .select("id,name,price,icon_url,description,broadcast_banner,sort_order")
    .order("sort_order", { ascending: true });
  if (error) throw errorMessage(error);
  return (data ?? []).map((ring) => ({ ...ring, price: Number(ring.price) })) as CpRing[];
}

export async function sendCpProposalV2(
  receiverId: string,
  ringId = "silver_ring",
  message = "Will you be my CP in JALWA? ❤️",
): Promise<{ proposal_id?: string; ring_name?: string; fee_paid?: number; waived?: boolean }> {
  const trimmedMessage = message.trim().slice(0, 240);
  const { data, error } = await supabase.rpc("cp_send_proposal_v2", {
    p_receiver_id: receiverId,
    p_ring_id: ringId,
    p_message: trimmedMessage || "Will you be my CP in JALWA? ❤️",
  });
  if (error) throw errorMessage(error);
  return data as { proposal_id?: string; ring_name?: string; fee_paid?: number; waived?: boolean };
}

export async function respondCpProposalV2(proposalId: string, accept: boolean): Promise<unknown> {
  const { data, error } = await supabase.rpc("cp_respond_proposal_v2", {
    p_proposal_id: proposalId,
    p_accept: accept,
  });
  if (error) throw errorMessage(error);
  return data;
}

export async function cancelCpBreakupRequest(requestId: string): Promise<unknown> {
  const { data, error } = await supabase.rpc("cp_cancel_breakup_request", {
    p_request_id: requestId,
  });
  if (error) throw errorMessage(error);
  return data;
}
