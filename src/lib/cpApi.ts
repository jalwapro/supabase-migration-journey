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
  level_name: string;
  min_intimacy: number;
  seat_frame_url: string | null;
  entrance_effect_url: string | null;
  badge_url: string | null;
};

export type CpProposal = {
  id: string;
  sender_id: string;
  receiver_id: string;
  ring_price: number;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  created_at: string;
  responded_at: string | null;
};

export async function sendCpProposal(receiverId: string, ringPrice = 5000) {
  if (!receiverId) throw new Error("Select a user first.");
  const { data, error } = await supabase.rpc("cp_send_proposal", {
    p_receiver_id: receiverId,
    p_ring_price: ringPrice,
  });
  if (error) throw error;
  return data as string;
}

export async function respondToCpProposal(proposalId: string, accept: boolean) {
  if (!proposalId) throw new Error("Proposal is required.");
  const { data, error } = await supabase.rpc("cp_respond_proposal", {
    p_proposal_id: proposalId,
    p_accept: accept,
  });
  if (error) throw error;
  return data as string | null;
}

export async function breakCpRelation(relationId: string) {
  if (!relationId) throw new Error("CP relation is required.");
  const { data, error } = await supabase.rpc("cp_break_relation", {
    p_relation_id: relationId,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function getCpStatus(userId?: string): Promise<CpRelation | null> {
  const { data, error } = await supabase.rpc("cp_get_status", {
    p_user_id: userId ?? null,
  });
  if (error) throw error;
  return (Array.isArray(data) ? data[0] : data) as CpRelation | null;
}

export async function listCpLevels(): Promise<CpLevel[]> {
  const { data, error } = await supabase
    .from("cp_levels_config")
    .select("level,name,min_intimacy,seat_frame_url,entrance_effect_url,badge_url")
    .order("level", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CpLevel[];
}

export async function listMyCpProposals(): Promise<CpProposal[]> {
  const { data, error } = await supabase
    .from("cp_proposals")
    .select("id,sender_id,receiver_id,ring_price,status,created_at,responded_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CpProposal[];
}
