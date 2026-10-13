export interface CpRelationship {
  id: string;
  user1_id: string;
  user2_id: string;
  proposal_id?: string;
  status: 'active' | 'dissolved';
  intimacy_points: number;
  level: number;
  ring_name: string;
  ring_icon: string;
  space_bio?: string;
  started_at: string;
  dissolved_at?: string;
  created_at: string;
  updated_at: string;
  partner?: {
    id: string;
    username: string;
    full_name?: string;
    avatar?: string;
  };
}

export interface CpProposal {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  ring_type: string;
  ring_icon?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'expired';
  created_at: string;
  sender_profile?: {
    username: string;
    full_name?: string;
    avatar?: string;
  };
}

export interface CpLeaderboardItem {
  id: string;
  level: number;
  intimacy_points: number;
  ring_name: string;
  ring_icon: string;
  started_at: string;
  user1: { id: string; username: string; avatar?: string };
  user2: { id: string; username: string; avatar?: string };
}
