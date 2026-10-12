import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeftRight, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const db = supabase as unknown as {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: any; error: { message: string } | null }>;
};
const requestKey = () => globalThis.crypto?.randomUUID?.() ?? "p2p-" + Date.now() + "-" + Math.random().toString(36).slice(2);

export function CoinP2PTransferPanel() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [recipientCode, setRecipientCode] = useState("");
  const [amount, setAmount] = useState("100");
  const [confirmed, setConfirmed] = useState(false);
  const [key, setKey] = useState(requestKey);

  const settings = useQuery({
    queryKey: ["coin-economy-p2p-policy"],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await db.from("coin_economy_settings").select("p2p_user_transfers_enabled,max_p2p_transfer,daily_p2p_limit").eq("id", true).single();
      if (error) throw error;
      return data as { p2p_user_transfers_enabled: boolean; max_p2p_transfer: number; daily_p2p_limit: number };
    },
    staleTime: 30_000,
  });

  const transfer = useMutation({
    mutationFn: async () => {
      const coins = Number(amount);
      if (!confirmed) throw new Error("Confirm the recipient and amount first.");
      if (!Number.isSafeInteger(coins) || coins < 1 || coins > Number(settings.data?.max_p2p_transfer ?? 0)) throw new Error("Enter a valid amount within the allowed transfer limit.");
      if (!recipientCode.trim()) throw new Error("Recipient JALWA ID is required.");
      const { data, error } = await db.rpc("coin_p2p_transfer", { p_recipient_code: recipientCode.trim(), p_coins: coins, p_request_key: key });
      if (error) throw new Error(error.message);
      if (!data || typeof data !== "object" || !("transaction_id" in data)) throw new Error("Transfer result was incomplete. Check wallet history before retrying.");
      return data as { transaction_id: string; coins_transferred: number; sender_balance_after: number; recipient_code: string | null };
    },
    onSuccess: async (result) => {
      toast.success(`Sent ${Number(result.coins_transferred).toLocaleString()} coins successfully`);
      setRecipientCode(""); setAmount("100"); setConfirmed(false); setKey(requestKey());
      await qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!user) return null;
  if (settings.isLoading) return <section className="rounded-2xl border border-border bg-card p-4"><Loader2 className="mx-auto h-5 w-5 animate-spin"/></section>;
  if (settings.isError) return <section className="rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">Coin transfer policy could not be loaded.</section>;
  if (!settings.data?.p2p_user_transfers_enabled) return null;

  return <section className="rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/5 via-card to-blue-500/5 p-4">
    <div className="flex items-center gap-2"><ArrowLeftRight className="h-5 w-5 text-cyan-300"/><h2 className="text-lg font-black">Send coins to a user</h2></div>
    <p className="mt-1 text-xs text-muted-foreground">Secure JALWA ID transfer. Coins move only after the database validates your balance, account status and transfer limits.</p>
    <div className="mt-4 space-y-3">
      <label className="block text-xs font-semibold">Recipient JALWA ID<input value={recipientCode} onChange={e=>{setRecipientCode(e.target.value);setConfirmed(false);setKey(requestKey());}} maxLength={100} placeholder="Enter recipient ID" className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-sm"/></label>
      <label className="block text-xs font-semibold">Coins to send<input type="number" inputMode="numeric" min="1" max={settings.data.max_p2p_transfer} value={amount} onChange={e=>{setAmount(e.target.value);setConfirmed(false);setKey(requestKey());}} className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-sm"/></label>
      <div className="rounded-xl bg-background p-3 text-xs"><div className="flex justify-between"><span className="text-muted-foreground">Current balance</span><b>{Number(profile?.coins ?? 0).toLocaleString()}</b></div><div className="mt-1 flex justify-between"><span className="text-muted-foreground">Maximum per transfer</span><b>{Number(settings.data.max_p2p_transfer).toLocaleString()}</b></div><p className="mt-2 text-muted-foreground">Your available balance is checked again on the server at transfer time.</p></div>
      <label className="flex items-start gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} className="mt-0.5"/><span>I verified the recipient JALWA ID and coin amount. This transfer may not be reversible.</span></label>
      <button disabled={transfer.isPending||!confirmed||!recipientCode.trim()||!Number.isSafeInteger(Number(amount))||Number(amount)<1||Number(amount)>Number(settings.data.max_p2p_transfer)} onClick={()=>transfer.mutate()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 p-3 text-sm font-black text-slate-950 disabled:opacity-50">{transfer.isPending?<Loader2 className="h-4 w-4 animate-spin"/>:<ShieldCheck className="h-4 w-4"/>}Confirm secure transfer</button>
      <p className="text-[10px] text-muted-foreground">Daily limit: {Number(settings.data.daily_p2p_limit).toLocaleString()} coins. P2P is available only while enabled by JALWA Admin.</p>
    </div>
  </section>;
}
