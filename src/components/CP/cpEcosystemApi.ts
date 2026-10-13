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
  type: "new_cp" | "level_up" | "anniversary" | "gift" | string;
  title: string;
  message: string;
  sender_name: string | null;
  sender_avatar: string | null;
  receiver_name: string | null;
  receiver_avatar: string | null;
  icon_url: string | null;
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


export type CpExclusiveGift = {
  id: string;
  name: string;
  price: number;
  icon_url: string;
  intimacy_points: number;
  required_cp_level: number;
  animation_url: string | null;
  broadcast_threshold: boolean;
  description: string | null;
  sort_order: number;
};

export async function getCpExclusiveGifts(): Promise<CpExclusiveGift[]> {
  const { data, error } = await supabase
    .from("cp_exclusive_gifts_config")
    .select("id,name,price,icon_url,intimacy_points,required_cp_level,animation_url,broadcast_threshold,description,sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw errorMessage(error);
  return (data ?? []).map((gift) => ({
    ...gift,
    price: Number(gift.price),
    intimacy_points: Number(gift.intimacy_points),
    required_cp_level: Number(gift.required_cp_level),
  })) as CpExclusiveGift[];
}

export type CpExclusiveGiftResult = {
  success: boolean;
  event_id: string;
  gift_name: string;
  coins_spent: number;
  coins_remaining: number;
  points_added: number;
  new_intimacy: number;
  new_level: number;
  animation_url: string | null;
  partner_name: string | null;
};

export async function sendCpExclusiveGift(giftId: string, message = ""): Promise<CpExclusiveGiftResult> {
  if (!giftId.trim()) throw new Error("Choose a CP gift first.");
  const { data, error } = await supabase.rpc("cp_send_exclusive_gift", {
    p_gift_id: giftId,
    p_message: message.trim().slice(0, 250) || null,
  });
  if (error) throw errorMessage(error);
  return data as CpExclusiveGiftResult;
}

export async function uploadCpMemoryPhoto(file: File): Promise<string> {
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  if (!allowedTypes.has(file.type)) throw new Error("Use a JPG, PNG, WebP, or GIF image.");
  if (file.size > 10 * 1024 * 1024) throw new Error("CP memory photos must be 10 MB or smaller.");

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw errorMessage(authError);
  if (!authData.user) throw new Error("Please sign in to upload a CP memory.");

  const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(-80) || "memory";
  const path = `${authData.user.id}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from("cp-photos").upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });
  if (error) throw errorMessage(error);
  return supabase.storage.from("cp-photos").getPublicUrl(path).data.publicUrl;
}
