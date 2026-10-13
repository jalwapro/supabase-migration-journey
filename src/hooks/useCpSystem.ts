import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { CpProposal, CpRelationship } from "@/types/cp";
import { toast } from "sonner";

type RelationRow = {
  id: string;
  user1_id: string;
  user2_id: string;
  intimacy_score: number;
  ring_level: number;
  status: "active" | "divorced";
  ring_name: string;
  ring_icon: string;
  space_bio?: string | null;
  created_at: string;
  started_at?: string | null;
  ended_at?: string | null;
  dissolved_at?: string | null;
  updated_at?: string | null;
  user1?: CpRelationship["partner"];
  user2?: CpRelationship["partner"];
};

type ProposalRow = {
  id: string;
  sender_id: string;
  receiver_id: string;
  message?: string | null;
  ring_type?: string | null;
  ring_icon?: string | null;
  ring_price: number;
  status: CpProposal["status"];
  created_at: string;
  responded_at?: string | null;
  sender_profile?: CpProposal["sender_profile"] & { id?: string };
};

function toCpRelationship(row: RelationRow, currentUserId: string): CpRelationship {
  const partner = row.user1_id === currentUserId ? row.user2 : row.user1;
  return {
    id: row.id,
    user1_id: row.user1_id,
    user2_id: row.user2_id,
    status: row.status === "divorced" ? "dissolved" : "active",
    intimacy_points: Number(row.intimacy_score ?? 0),
    level: Number(row.ring_level ?? 1),
    ring_name: row.ring_name ?? "Silver Love Ring",
    ring_icon: row.ring_icon ?? "/gifts/basic-3d/love-ring.png",
    space_bio: row.space_bio ?? undefined,
    started_at: row.started_at ?? row.created_at,
    dissolved_at: row.dissolved_at ?? row.ended_at ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at ?? row.created_at,
    partner: partner ?? undefined,
  };
}

function toCpProposal(row: ProposalRow): CpProposal {
  return {
    id: row.id,
    sender_id: row.sender_id,
    receiver_id: row.receiver_id,
    message: row.message ?? "Will you be my CP?",
    ring_type: row.ring_type ?? "Silver Love Ring",
    ring_icon: row.ring_icon ?? undefined,
    status: row.status,
    created_at: row.created_at,
    sender_profile: row.sender_profile
      ? {
          username: row.sender_profile.username,
          full_name: row.sender_profile.full_name,
          avatar: row.sender_profile.avatar,
        }
      : undefined,
  };
}

/**
 * CP data access uses the canonical JALWA schema and server RPCs.
 * The legacy cp_relationships/propose_cp/dissolve_cp names from older
 * snippets are intentionally not used: this app uses cp_relations,
 * cp_send_proposal, cp_respond_proposal, and cp_divorce.
 */
export function useCpSystem() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const { data: myCp, isLoading: isCpLoading } = useQuery({
    queryKey: ["my_cp", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("cp_relations")
        .select("*, user1:profiles!cp_relations_user1_id_fkey(id, username, full_name, avatar), user2:profiles!cp_relations_user2_id_fkey(id, username, full_name, avatar)")
        .eq("status", "active")
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .maybeSingle();

      if (error) throw error;
      return data ? toCpRelationship(data as unknown as RelationRow, userId) : null;
    },
  });

  const { data: pendingProposals = [], isLoading: isProposalsLoading } = useQuery({
    queryKey: ["cp_proposals_received", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("cp_proposals")
        .select("*, sender_profile:profiles!cp_proposals_sender_id_fkey(id, username, full_name, avatar)")
        .eq("receiver_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []).map((row) => toCpProposal(row as unknown as ProposalRow));
    },
  });

  const proposeMutation = useMutation({
    mutationFn: async ({ receiverId }: { receiverId: string }) => {
      const { data, error } = await supabase.rpc("cp_send_proposal", {
        p_receiver_id: receiverId,
        p_ring_price: 13333,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      toast.success("CP Proposal sent!");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["cp_proposals_received"] }),
        queryClient.invalidateQueries({ queryKey: ["cp_proposals"] }),
        queryClient.invalidateQueries({ queryKey: ["my_cp"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message || "Failed to send proposal"),
  });

  const respondMutation = useMutation({
    mutationFn: async ({ proposalId, accept }: { proposalId: string; accept: boolean }) => {
      const { data, error } = await supabase.rpc("cp_respond_proposal", {
        p_proposal_id: proposalId,
        p_accept: accept,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async (_data, variables) => {
      toast[variables.accept ? "success" : "info"](
        variables.accept ? "Congratulations! You are now a CP ❤️" : "Proposal declined",
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["my_cp"] }),
        queryClient.invalidateQueries({ queryKey: ["cp_proposals_received"] }),
        queryClient.invalidateQueries({ queryKey: ["cp_proposals"] }),
        queryClient.invalidateQueries({ queryKey: ["cp_weekly_ranking"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message || "Failed to process proposal"),
  });

  const dissolveMutation = useMutation({
    mutationFn: async (relationshipId: string) => {
      const { data, error } = await supabase.rpc("cp_divorce", {
        p_relation_id: relationshipId,
        p_fee: 0,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      toast.info("CP relationship dissolved");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["my_cp"] }),
        queryClient.invalidateQueries({ queryKey: ["cp_proposals"] }),
        queryClient.invalidateQueries({ queryKey: ["cp_weekly_ranking"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message || "Failed to dissolve CP"),
  });

  return {
    myCp,
    isCpLoading,
    pendingProposals,
    isProposalsLoading,
    proposeCp: proposeMutation.mutateAsync,
    isProposing: proposeMutation.isPending,
    respondProposal: respondMutation.mutateAsync,
    isResponding: respondMutation.isPending,
    dissolveCp: dissolveMutation.mutateAsync,
    isDissolving: dissolveMutation.isPending,
  };
}
