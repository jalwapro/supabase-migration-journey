import { supabase } from "@/integrations/supabase/client";

export type P2PAction =
  | "MARKETPLACE" | "GET_AGENT" | "GET_ORDER" | "SAVE_AGENT_PROFILE" | "REQUEST_WHATSAPP"
  | "CREATE_ORDER" | "BUYER_PAID" | "APPEAL" | "RELEASE_ORDER" | "CANCEL_ORDER"
  | "ADMIN_COMPLETE" | "ADMIN_CANCEL" | "ADMIN_APPROVE_WHATSAPP" | "ADMIN_BAN_AGENT"
  | "ADMIN_SAVE_SETTINGS" | "ADMIN_OVERVIEW" | "MY_ORDERS";

export async function p2pAction<T = Record<string, unknown>>(action: P2PAction, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("p2p-escrow", { body: { action, payload } });
  if (error) {
    let message = error.message || "P2P request failed";
    try {
      const context = (error as { context?: Response }).context;
      if (context) {
        const body = await context.clone().json() as { error?: string };
        if (body.error) message = body.error;
      }
    } catch { /* use SDK error message */ }
    throw new Error(message);
  }
  if (data?.error) throw new Error(String(data.error));
  return data?.data as T;
}

export const PAYMENT_OPTIONS = [
  { key: "jazzcash", label: "JazzCash" },
  { key: "easypaisa", label: "Easypaisa" },
  { key: "bank", label: "Bank transfer" },
  { key: "usdt", label: "USDT" },
] as const;

export type AgentListing = {
  user_id: string; currency_code: string; country: string; sell_rate: number; buy_rate: number;
  payment_methods: string[]; base_fiat_amount: number;
};
export type P2POrder = {
  id: string; buyer_id: string; agent_id: string; coin_amount: number; fiat_amount: number;
  currency: string; status: "pending" | "paid" | "appealed" | "completed" | "cancelled";
  payment_proof_url: string | null; resolution_note?: string | null; created_at: string;
};
