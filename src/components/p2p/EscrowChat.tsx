import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { p2pAction, type P2POrder } from "@/lib/p2p";
import { AlertTriangle, CheckCircle2, Clock3, FileImage, Loader2, LockKeyhole, MessageCircle, UploadCloud } from "lucide-react";
import { toast } from "sonner";

type AgentDetails = { user_id: string; currency_code: string; country: string; payment_methods: Record<string,string>; whatsapp_number: string | null };
type OrderData = { order: P2POrder; agent: AgentDetails };

export function EscrowChat({ orderId }: { orderId: string }) {
  const { user } = useAuth();
  const [data, setData] = useState<OrderData | null>(null);
  const [proof, setProof] = useState<File | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const isBuyer = !!user && data?.order.buyer_id === user.id;
  const isAgent = !!user && data?.order.agent_id === user.id;

  async function load() {
    setLoading(true);
    try { setData(await p2pAction<OrderData>("GET_ORDER", { order_id: orderId })); }
    catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [orderId]);

  async function markPaid() {
    if (!user || !proof || !data) return;
    setBusy(true);
    try {
      if (!["image/jpeg","image/png","image/webp","application/pdf"].includes(proof.type)) throw new Error("Upload JPG, PNG, WEBP or PDF only.");
      if (proof.size > 5 * 1024 * 1024) throw new Error("Payment proof must be 5 MB or smaller.");
      const path = `${user.id}/${data.order.id}/${crypto.randomUUID()}-${proof.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
      const { error: uploadError } = await supabase.storage.from("p2p-payment-proofs").upload(path, proof, { contentType: proof.type, upsert: false });
      if (uploadError) throw uploadError;
      await p2pAction("BUYER_PAID", { order_id: data.order.id, payment_proof_url: path });
      toast.success("Payment marked. The agent can now verify and release coins.");
      setProof(null); await load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }
  async function act(action: "RELEASE_ORDER" | "CANCEL_ORDER" | "APPEAL") {
    setBusy(true);
    try {
      await p2pAction(action, { order_id: orderId, reason: reason.trim() || undefined });
      toast.success(action === "RELEASE_ORDER" ? "Coins released to buyer" : action === "CANCEL_ORDER" ? "Order cancelled and agent escrow refunded" : "Appeal submitted for admin review");
      await load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }
  async function openProof() {
    if (!data?.order.payment_proof_url) return;
    const { data: signed, error } = await supabase.storage.from("p2p-payment-proofs").createSignedUrl(data.order.payment_proof_url, 120);
    if (error) { toast.error(error.message); return; }
    window.open(signed.signedUrl, "_blank", "noopener,noreferrer");
  }

  if (loading) return <div className="grid min-h-64 place-items-center"><Loader2 className="animate-spin"/></div>;
  if (!data) return <div className="m-4 rounded-2xl border border-border p-5">Order could not be loaded. Confirm the order link and your signed-in account.</div>;
  const order = data.order;
  const closed = order.status === "completed" || order.status === "cancelled";
  return <section className="mx-auto w-full max-w-2xl space-y-4 p-3 pb-24 text-foreground sm:p-5">
    <div className="rounded-3xl border border-amber-400/20 bg-gradient-to-br from-zinc-900 to-amber-950/40 p-5"><div className="flex items-center gap-2 text-amber-300"><LockKeyhole size={18}/><span className="text-xs font-bold uppercase tracking-widest">Escrow order</span></div><h1 className="mt-2 break-all text-xl font-black">#{order.id.slice(0,8).toUpperCase()}</h1><p className="mt-2 text-sm text-zinc-400">Agent coins are locked. They are credited to the buyer only after release or admin resolution.</p><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-black/20 p-3"><div className="text-xs text-zinc-400">Coin amount</div><div className="text-xl font-black text-emerald-400">{Number(order.coin_amount).toLocaleString()}</div></div><div className="rounded-xl bg-black/20 p-3"><div className="text-xs text-zinc-400">Payment due</div><div className="text-xl font-black">{order.currency} {Number(order.fiat_amount).toLocaleString()}</div></div></div><div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs font-bold uppercase"><Clock3 size={13}/>{order.status}</div></div>
    {isBuyer && order.status === "pending" && <div className="rounded-2xl border border-border bg-card p-4"><h2 className="font-bold">Pay the agent</h2><p className="mt-1 text-xs text-muted-foreground">Use one of the following payment methods. Only mark paid after you have sent the exact amount.</p><div className="mt-3 space-y-2">{Object.entries(data.agent.payment_methods??{}).filter(([,value])=>!!value).map(([method,value])=><div key={method} className="rounded-xl border border-border p-3"><div className="text-xs font-bold uppercase text-amber-400">{method}</div><div className="mt-1 break-all text-sm">{value}</div></div>)}</div>{data.agent.whatsapp_number && <p className="mt-3 flex items-center gap-2 text-sm"><MessageCircle size={15}/>Agent WhatsApp: {data.agent.whatsapp_number}</p>}<label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border p-3"><UploadCloud size={20}/><span className="min-w-0 flex-1 text-sm">{proof ? proof.name : "Upload payment proof (JPG/PNG/WEBP/PDF, max 5 MB)"}</span><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={e=>setProof(e.target.files?.[0]??null)}/><FileImage size={16}/></label><button disabled={busy||!proof} onClick={()=>void markPaid()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 font-extrabold text-white disabled:opacity-50">{busy?<Loader2 className="animate-spin" size={16}/>:<CheckCircle2 size={16}/>}I Have Paid</button></div>}
    {isAgent && order.status === "paid" && <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4"><h2 className="font-bold">Buyer marked payment sent</h2><p className="mt-1 text-sm text-muted-foreground">Verify the funds in your own account and inspect the proof before releasing coins.</p>{order.payment_proof_url && <button onClick={()=>void openProof()} className="mt-3 rounded-xl border border-border px-3 py-2 text-sm font-bold">View payment proof</button>}<button disabled={busy} onClick={()=>void act("RELEASE_ORDER")} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 font-extrabold text-white disabled:opacity-50">{busy?<Loader2 className="animate-spin" size={16}/>:<CheckCircle2 size={16}/>}Release Coins to Buyer</button></div>}
    {order.payment_proof_url && isBuyer && <button onClick={()=>void openProof()} className="rounded-xl border border-border px-3 py-2 text-sm font-bold">View uploaded payment proof</button>}
    {order.status === "paid" && isBuyer && <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-sm">Waiting for the agent to verify your payment and release the coins.</div>}
    {order.status === "appealed" && <div className="rounded-xl border border-orange-400/30 bg-orange-400/5 p-4"><div className="flex items-center gap-2 font-bold text-orange-300"><AlertTriangle size={17}/>Appeal under admin review</div><p className="mt-1 text-sm text-muted-foreground">{order.resolution_note || "An admin will review this order."}</p></div>}
    {!closed && <div className="rounded-2xl border border-border bg-card p-4"><label className="text-sm font-bold">Appeal / issue details<textarea value={reason} onChange={e=>setReason(e.target.value)} maxLength={1000} rows={3} placeholder="Explain the payment or order issue..." className="mt-2 w-full rounded-xl border border-border bg-background p-3 text-sm"/></label><div className="mt-3 flex flex-wrap gap-2">{order.status!=="appealed" && <button disabled={busy} onClick={()=>void act("APPEAL")} className="rounded-xl border border-orange-500/30 px-3 py-2 text-sm font-bold text-orange-300">Appeal order</button>}{order.status==="pending" && <button disabled={busy} onClick={()=>void act("CANCEL_ORDER")} className="rounded-xl border border-border px-3 py-2 text-sm font-bold">Cancel & refund escrow</button>}</div></div>}
    {closed && <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">{order.status==="completed"?"This order is complete. Coins have been credited to the buyer.":"This order is cancelled. Escrow coins have been returned to the agent."}</div>}
  </section>;
}
