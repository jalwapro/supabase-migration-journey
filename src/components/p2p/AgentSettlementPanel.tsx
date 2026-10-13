import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Role = "admin" | "super_agent" | "sub_agent" | "user";
type Settlement = { id:string; from_user_id:string; to_user_id:string; settlement_type:"cash"|"coins"; diamond_amount:number; coin_amount:number|null; fiat_currency:string|null; status:"pending_approval"|"approved"|"rejected"; rejection_reason:string|null; created_at:string };
const db=supabase as any;
const input="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-amber-400";
const button="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-black text-zinc-950 disabled:opacity-50";
const secondary="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-bold disabled:opacity-50";
const fmt=(n:number)=>Number(n||0).toLocaleString();

export function AgentSettlementPanel({role,userId}:{role:Role;userId:string}) {
 const qc=useQueryClient();
 const [diamonds,setDiamonds]=useState("100000");
 const [kind,setKind]=useState<"cash"|"coins">("coins");
 const [coins,setCoins]=useState("100000");
 const [currency,setCurrency]=useState("PKR");
 const [adminId,setAdminId]=useState("");
 const [bulkThreshold,setBulkThreshold]=useState("10000000");
 const [stockAmount,setStockAmount]=useState("10000000");
 const [reasons,setReasons]=useState<Record<string,string>>({});
 const admins=useQuery({queryKey:["p2p-settlement-admin-directory",userId],enabled:role==="super_agent",queryFn:async()=>{
   const {data,error}=await db.from("p2p_profiles").select("user_id,display_name").eq("role","admin").eq("active",true);
   if(error) throw error; return (data??[]) as Array<{user_id:string;display_name:string|null}>;
 }});
 const list=useQuery({queryKey:["p2p-agent-settlements",userId,role],enabled:!!userId,refetchInterval:20000,queryFn:async()=>{
   let q=db.from("p2p_agent_settlements").select("id,from_user_id,to_user_id,settlement_type,diamond_amount,coin_amount,fiat_currency,status,rejection_reason,created_at").order("created_at",{ascending:false}).limit(60);
   if(role!=="admin") q=q.or("from_user_id.eq."+userId+",to_user_id.eq."+userId);
   const {data,error}=await q;if(error)throw error;return (data??[]) as Settlement[];
 }});
 const marketSettings=useQuery({queryKey:["p2p-admin-market-settings"],enabled:role==="admin",queryFn:async()=>{const {data,error}=await db.from("p2p_market_settings").select("admin_bulk_min_coins").eq("singleton",true).single();if(error)throw error;return data as {admin_bulk_min_coins:number};}});
 const saveBulk=useMutation({mutationFn:async()=>{const n=Number(bulkThreshold);if(!Number.isSafeInteger(n)||n<1000000)throw new Error("Bulk threshold must be at least 1,000,000 coins.");const {error}=await db.rpc("p2p_admin_set_bulk_threshold",{p_min_coins:n});if(error)throw error;},onSuccess:async()=>{toast.success("Admin direct-sale bulk threshold saved.");await qc.invalidateQueries({queryKey:["p2p-admin-market-settings"]});},onError:(e:Error)=>toast.error(e.message)});
 const mintStock=useMutation({mutationFn:async()=>{const n=Number(stockAmount);if(!Number.isSafeInteger(n)||n<=0)throw new Error("Enter a positive whole-number coin amount.");const {error}=await db.rpc("p2p_admin_mint_stock",{p_request_key:crypto.randomUUID(),p_amount:n});if(error)throw error;},onSuccess:async()=>{toast.success("Audited coin stock added to Super Admin inventory.");setStockAmount("10000000");await qc.invalidateQueries({queryKey:["p2p-wallet"]});await qc.invalidateQueries({queryKey:["p2p-ledger"]});},onError:(e:Error)=>toast.error(e.message)});
 const refresh=async()=>Promise.all([qc.invalidateQueries({queryKey:["p2p-agent-settlements"]}),qc.invalidateQueries({queryKey:["p2p-wallet"]}),qc.invalidateQueries({queryKey:["p2p-ledger"]})]);
 const request=useMutation({mutationFn:async()=>{
   const d=Number(diamonds),c=Number(coins);
   if(!Number.isSafeInteger(d)||d<=0)throw new Error("Enter a positive whole-number diamond amount.");
   if(kind==="coins"&&(!Number.isSafeInteger(c)||c<=0))throw new Error("Enter a positive whole-number coin amount.");
   if(role==="super_agent"&&!adminId)throw new Error("Select the Super Admin recipient.");
   const {error}=await db.rpc("p2p_request_agent_settlement",{p_request_key:crypto.randomUUID(),p_diamond_amount:d,p_settlement_type:kind,p_coin_amount:kind==="coins"?c:null,p_fiat_currency:kind==="cash"?currency:null,p_admin_recipient_id:role==="super_agent"?adminId:null});
   if(error)throw error;
 },onSuccess:async()=>{toast.success("Settlement created; diamonds are escrowed pending approval.");setDiamonds("100000");await refresh();},onError:(e:Error)=>toast.error(e.message)});
 const approve=useMutation({mutationFn:async(id:string)=>{const {error}=await db.rpc("p2p_approve_agent_settlement",{p_settlement_id:id});if(error)throw error;},onSuccess:async()=>{toast.success("Settlement approved and ledger updated.");await refresh();},onError:(e:Error)=>toast.error(e.message)});
 const reject=useMutation({mutationFn:async(v:{id:string;reason:string})=>{if(v.reason.trim().length<3)throw new Error("Enter a rejection reason (at least 3 characters).");const {error}=await db.rpc("p2p_reject_agent_settlement",{p_settlement_id:v.id,p_reason:v.reason.trim()});if(error)throw error;},onSuccess:async()=>{toast.success("Settlement rejected; diamonds returned.");await refresh();},onError:(e:Error)=>toast.error(e.message)});
 const rows=list.data??[];
 const incoming=useMemo(()=>rows.filter(r=>r.to_user_id===userId&&r.status==="pending_approval"),[rows,userId]);
 if(role!=="admin"&&role!=="super_agent"&&role!=="sub_agent")return null;
 return <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
  <div className="flex items-start justify-between gap-3"><div><h2 className="font-black">Diamond settlement & exchange</h2><p className="mt-1 text-xs text-muted-foreground">Sub-Agent → Super Agent → Super Admin. Diamonds stay locked until receiver approval; rejection refunds the sender.</p></div><button type="button" onClick={()=>void refresh()} className={secondary} aria-label="Refresh settlements"><RefreshCw className="h-4 w-4"/></button></div>
  {role==="admin"&&<div className="rounded-xl border border-amber-400/25 bg-background/50 p-4 space-y-4"><div><h3 className="font-black">Wholesale & country currency policy</h3><p className="mt-1 text-xs text-muted-foreground">Direct Admin → Normal Agent transfer is blocked below this threshold. Configure currency conversion before assigning agents in that country.</p></div><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-muted-foreground">Minimum direct wholesale coins<input className={input} type="number" min="1000000" step="1000000" value={bulkThreshold} onChange={e=>setBulkThreshold(e.target.value)}/></label><div className="flex items-end"><button type="button" className={button} disabled={saveBulk.isPending} onClick={()=>saveBulk.mutate()}>Save bulk threshold</button></div></div><p className="text-xs text-muted-foreground">Current database threshold: {fmt(Number(marketSettings.data?.admin_bulk_min_coins??10000000))} coins</p><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-muted-foreground">Issue coins to Super Admin inventory<input className={input} type="number" min="1" step="1" value={stockAmount} onChange={e=>setStockAmount(e.target.value)}/></label><div className="flex items-end"><button type="button" className={button} disabled={mintStock.isPending} onClick={()=>mintStock.mutate()}>Issue audited stock</button></div></div></div>}
  {(role==="sub_agent"||role==="super_agent")&&<div className="rounded-xl border border-border bg-background/50 p-3 sm:p-4"><h3 className="text-sm font-black">Request settlement</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">
   <label className="text-xs font-bold text-muted-foreground">Diamonds to settle<input className={input} type="number" min="1" step="1" value={diamonds} onChange={e=>setDiamonds(e.target.value)}/></label>
   <label className="text-xs font-bold text-muted-foreground">Receive in<select className={input} value={kind} onChange={e=>setKind(e.target.value as "cash"|"coins")}><option value="coins">Fresh coins</option><option value="cash">Cash (paid externally)</option></select></label>
   {kind==="coins"?<label className="text-xs font-bold text-muted-foreground">Coins requested<input className={input} type="number" min="1" step="1" value={coins} onChange={e=>setCoins(e.target.value)}/></label>:<label className="text-xs font-bold text-muted-foreground">Cash currency<select className={input} value={currency} onChange={e=>setCurrency(e.target.value)}>{["PKR","AED","SAR","USD","BDT","INR"].map(c=><option key={c}>{c}</option>)}</select></label>}
   {role==="super_agent"&&<label className="text-xs font-bold text-muted-foreground">Super Admin recipient<select className={input} value={adminId} onChange={e=>setAdminId(e.target.value)}><option value="">Choose Admin</option>{(admins.data??[]).map(a=><option key={a.user_id} value={a.user_id}>{a.display_name||"Super Admin"} · {a.user_id.slice(0,8)}</option>)}</select></label>}
  </div><p className="mt-2 text-xs text-muted-foreground">For coin exchange, the receiver must have enough available coins. Cash payment is settled outside the app and confirmed by receiver approval.</p><button type="button" disabled={request.isPending} onClick={()=>request.mutate()} className={button+" mt-3"}>{request.isPending?<Loader2 className="h-4 w-4 animate-spin"/>:null}Lock diamonds & send request</button></div>}
  <div><h3 className="font-black">Incoming approval queue <span className="ml-1 rounded-full border border-amber-400/30 px-2 py-0.5 text-xs text-amber-300">{incoming.length}</span></h3>{list.isLoading?<Loader2 className="mt-3 h-5 w-5 animate-spin"/>:list.isError?<p className="mt-3 text-sm text-destructive">{(list.error as Error).message}</p>:incoming.length===0?<p className="mt-3 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">No pending settlements.</p>:<div className="mt-3 space-y-3">{incoming.map(r=><article key={r.id} className="rounded-xl border border-border p-3"><p className="font-black">{fmt(r.diamond_amount)} diamonds</p><p className="mt-1 break-all text-xs text-muted-foreground">From {r.from_user_id}</p><p className="mt-1 text-xs">{r.settlement_type==="coins"?"Exchange for "+fmt(r.coin_amount??0)+" coins":"Cash settlement · "+(r.fiat_currency??"")}</p><label className="mt-3 block text-xs font-bold text-muted-foreground">Reason if rejecting<input className={input} value={reasons[r.id]??""} onChange={e=>setReasons(p=>({...p,[r.id]:e.target.value}))} maxLength={500}/></label><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={approve.isPending||reject.isPending} onClick={()=>approve.mutate(r.id)} className={button}><CheckCircle2 className="h-4 w-4"/>Approve</button><button type="button" disabled={approve.isPending||reject.isPending} onClick={()=>reject.mutate({id:r.id,reason:reasons[r.id]??""})} className={secondary}><XCircle className="h-4 w-4"/>Reject & refund</button></div></article>)}</div>}</div>
  <div><h3 className="font-black">Settlement history</h3>{rows.length===0?<p className="mt-2 text-sm text-muted-foreground">No settlement activity yet.</p>:<div className="mt-3 space-y-2">{rows.map(r=><article key={r.id} className="rounded-xl border border-border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{fmt(r.diamond_amount)} diamonds · {r.settlement_type==="coins"?fmt(r.coin_amount??0)+" coins":"Cash "+(r.fiat_currency??"")}</strong><span className={"rounded-full border px-2 py-1 text-[10px] font-bold uppercase "+(r.status==="approved"?"border-emerald-500/30 text-emerald-400":r.status==="rejected"?"border-red-500/30 text-red-400":"border-amber-400/30 text-amber-300")}>{r.status.replaceAll("_"," ")}</span></div><p className="mt-1 break-all text-[10px] text-muted-foreground">{r.from_user_id===userId?"Sent to":"Received from"} {r.from_user_id===userId?r.to_user_id:r.from_user_id} · {new Date(r.created_at).toLocaleString()}</p>{r.rejection_reason&&<p className="mt-1 text-xs text-red-400">{r.rejection_reason}</p>}</article>)}</div>}</div>
 </section>;
}
