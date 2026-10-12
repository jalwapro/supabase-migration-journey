import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { coinAgentAction } from "@/lib/coin-agent";

type Child = { user_id: string; username: string | null; user_code: string | null; is_active: boolean; available_coins: number; total_sold: number };
type Context = { role: string; child_count: number; max_children: number; children: Child[] };

export function SuperCoinAgentPanel() {
 const qc=useQueryClient();
 const [targetId,setTargetId]=useState("");
 const [whatsapp,setWhatsapp]=useState("");
 const [publicName,setPublicName]=useState("");
 const context=useQuery({queryKey:["super-agent-context"],queryFn:()=>coinAgentAction<Context>("ROLE_CONTEXT"),retry:false,staleTime:15000});
 const create=useMutation({
  mutationFn:()=>coinAgentAction("SUPER_CREATE_CHILD_AGENT",{target_id:targetId.trim(),whatsapp_number:whatsapp.replace(/\D/g,""),public_name:publicName.trim()||null}),
  onSuccess:async()=>{toast.success("Coin Agent created");setTargetId("");setWhatsapp("");setPublicName("");await qc.invalidateQueries({queryKey:["super-agent-context"]});},
  onError:(e:Error)=>toast.error(e.message)
 });
 if(context.isLoading||context.isError||context.data?.role!=="super_coin_agent") return null;
 const remaining=Math.max(0,context.data.max_children-context.data.child_count);
 return <section className="rounded-2xl border border-amber-400/25 bg-card p-4 sm:p-5">
  <div className="flex items-start gap-3"><ShieldCheck className="h-6 w-6 text-amber-300"/><div><h2 className="text-lg font-black">Super Coin Agent · Team</h2><p className="mt-1 text-xs text-muted-foreground">Manage up to five Coin Agents beneath your account.</p></div></div>
  <div className="my-4 flex justify-between rounded-xl border border-border bg-background p-3"><span className="text-sm">Agent slots used</span><b>{context.data.child_count}/{context.data.max_children}</b></div>
  {remaining>0?<div className="space-y-2">
   <input value={targetId} onChange={e=>setTargetId(e.target.value)} placeholder="Existing user's UUID" className="w-full rounded-xl border border-border bg-background p-3 text-sm"/>
   <input value={whatsapp} onChange={e=>setWhatsapp(e.target.value)} placeholder="WhatsApp with country code (8–15 digits)" inputMode="tel" className="w-full rounded-xl border border-border bg-background p-3 text-sm"/>
   <input value={publicName} onChange={e=>setPublicName(e.target.value)} placeholder="Public agent name (optional)" className="w-full rounded-xl border border-border bg-background p-3 text-sm"/>
   <button disabled={create.isPending||!targetId.trim()||whatsapp.replace(/\D/g,"").length<8||whatsapp.replace(/\D/g,"").length>15} onClick={()=>create.mutate()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 p-3 font-black text-zinc-950 disabled:opacity-50">{create.isPending?<Loader2 className="h-4 w-4 animate-spin"/>:<Users className="h-4 w-4"/>} Create Coin Agent</button>
  </div>:<p className="rounded-xl border border-border p-3 text-sm">Five-agent limit reached. Ask Admin to change the hierarchy.</p>}
  <div className="mt-4 space-y-2"><h3 className="text-sm font-bold">Your Coin Agents</h3>{(context.data.children??[]).map(c=><div key={c.user_id} className="rounded-xl border border-border bg-background p-3"><p className="font-bold">{c.username||"JALWA User"} · {c.user_code||"No JALWA ID"}</p><p className="break-all text-[10px] text-muted-foreground">{c.user_id}</p><p className="mt-1 text-xs text-muted-foreground">{c.is_active?"Active":"Inactive"} · Stock {Number(c.available_coins||0).toLocaleString()} · Sold {Number(c.total_sold||0).toLocaleString()}</p></div>)}{!context.data.children?.length&&<p className="text-xs text-muted-foreground">No child agents yet.</p>}</div>
 </section>;
}
