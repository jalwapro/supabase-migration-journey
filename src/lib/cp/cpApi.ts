import { supabase } from "@/integrations/supabase/client";

export type CpLevel = {
  level: number;
  name: string;
  min_intimacy: number;
  seat_frame_url: string | null;
  entrance_effect_url: string | null;
  badge_url: string | null;
};

export type CpRelation = {
  id: string;
  user1_id: string;
  user2_id: string;
  intimacy_score: number;
  ring_level: number;
  status: "active" | "divorced";
  created_at: string;
  ended_at: string | null;
  cp_levels_config?: CpLevel | null;
};

export type CpWeeklyRanking = {
  rank: number;
  relation_id: string;
  user1_id: string;
  user2_id: string;
  weekly_intimacy: number;
  total_intimacy: number;
  level: number;
};

export type CpProposal = {
  id: string;
  sender_id: string;
  receiver_id: string;
  ring_price: number;
  status: "pending" | "accepted" | "rejected" | "cancelled" | "expired";
  created_at: string;
  responded_at: string | null;
};

function requireData<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  if (data == null) throw new Error("No data returned");
  return data;
}

/** Coins are charged atomically by the database RPC; never debit in the browser. */
export async function sendCpProposal(receiverId: string, ringPrice = 13333) {
  const { data, error } = await supabase.rpc("cp_send_proposal", {
    p_receiver_id: receiverId,
    p_ring_price: ringPrice,
  });
  return requireData(data, error);
}

export async function respondCpProposal(proposalId: string, accept: boolean) {
  const { data, error } = await supabase.rpc("cp_respond_proposal", {
    p_proposal_id: proposalId,
    p_accept: accept,
  });
  return requireData(data, error);
}

export async function divorceCp(relationId: string, fee = 0) {
  const { data, error } = await supabase.rpc("cp_divorce", {
    p_relation_id: relationId,
    p_fee: fee,
  });
  return requireData(data, error);
}

/** Verified romantic-gift spend exchanged before an active CP relationship. */
export async function getCpPrelinkRomanticGiftTotal(receiverId: string): Promise<number> {
  const { data, error } = await supabase.rpc("cp_prelink_romantic_gift_total", {
    p_receiver_id: receiverId,
  });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export type CpBreakupRequest = {
  id: string;
  relation_id: string;
  requester_id: string;
  recipient_id: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  created_at: string;
  responded_at: string | null;
};

export async function requestCpBreakup(relationId: string) {
  const { data, error } = await supabase.rpc("cp_request_breakup", {
    p_relation_id: relationId,
  });
  return requireData(data, error);
}

export async function respondCpBreakupRequest(requestId: string, accept: boolean) {
  const { data, error } = await supabase.rpc("cp_respond_breakup_request", {
    p_request_id: requestId,
    p_accept: accept,
  });
  return requireData(data, error);
}

export async function getCpBreakupRequests(userId: string): Promise<CpBreakupRequest[]> {
  const { data, error } = await supabase
    .from("cp_breakup_requests")
    .select("*")
    .eq("status", "pending")
    .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CpBreakupRequest[];
}

export type CpPublicPartner = {
  partner_id: string;
  partner_username: string | null;
  partner_avatar: string | null;
};

export async function getCpPublicPartner(userId: string): Promise<CpPublicPartner | null> {
  const { data, error } = await supabase.rpc("cp_public_partner", { p_user_id: userId });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return (row as CpPublicPartner | undefined) ?? null;
}

export async function getCpStatus(userId: string): Promise<CpRelation | null> {
  const { data, error } = await supabase
    .from("cp_relations")
    .select("*, cp_levels_config(*)")
    .eq("status", "active")
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as CpRelation | null;
}

export async function getCpProposals(): Promise<CpProposal[]> {
  const { data, error } = await supabase
    .from("cp_proposals")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CpProposal[];
}

export async function getCpLevels(): Promise<CpLevel[]> {
  const { data, error } = await supabase
    .from("cp_levels_config")
    .select("*")
    .order("level", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as CpLevel[];
}

export async function saveCpLevel(level: CpLevel) {
  const { error } = await supabase
    .from("cp_levels_config")
    .upsert({
      level: level.level,
      name: level.name.trim(),
      min_intimacy: level.min_intimacy,
      seat_frame_url: level.seat_frame_url?.trim() || null,
      entrance_effect_url: level.entrance_effect_url?.trim() || null,
      badge_url: level.badge_url?.trim() || null,
    }, { onConflict: "level" });
  if (error) throw new Error(error.message);
}

/** Weekly CP leaderboard resets Sunday at 00:00 in Saudi Arabia time. */
export async function getCpWeeklyRanking(): Promise<CpWeeklyRanking[]> {
  const { data, error } = await supabase.rpc("cp_weekly_ranking");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as CpWeeklyRanking[];
}
