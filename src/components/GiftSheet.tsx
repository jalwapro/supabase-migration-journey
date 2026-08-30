import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CATALOG_GIFTS } from "@/lib/gifts";
import { isAssetUrlLike, preloadGiftVideo, resolveGiftImageUrl, resolvePlayableGiftUrl } from "@/lib/giftMedia";
import { Coins, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

export type Gift = { id:string; name:string; icon:string|null; icon_path?:string|null; emoji?:string|null; image_url:string|null; price_coins:number|null; price?:number|null; diamonds_value:number; category:string|null; animation:string|null; clip_path?:string|null; clip_type?:string|null; sound_url?:string|null };
export type GiftReceiver = { id:string; username:string|null; avatar:string|null };
type Tier="small"|"premium"|"vip";
const TIER_ORDER:Tier[]=["small","premium","vip"];
const TIER_LABEL:Record<Tier,string>={small:"✨ Basic",premium:"💎 Premium",vip:"👑 VIP"};
function tierOf(price:number):Tier{if(price<=300)return"small";if(price<2000)return"premium";return"vip";}
const LOVABLE_ASSET_ORIGIN="https://cloud-to-soul.lovable.app";
const ROYAL_ROSE_THUMB_URL=`${LOVABLE_ASSET_ORIGIN}/__l5e/assets-v1/fb1418b5-4aaa-4f54-8ea2-b411da08f604/royal-rose.png`;
function isRoyalRoseGift(name:string|null|undefined){const n=(name??"").toLowerCase().replace(/[^a-z]+/g," ").trim();return n==="royal rose"||(n.includes("royal")&&n.includes("rose"));}
function GiftPreview({gift,large=false}:{gift:Gift;large?:boolean}){const cls="h-full w-full object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]";if(isRoyalRoseGift(gift.name))return <img src={ROYAL_ROSE_THUMB_URL} alt={gift.name} className={cls}/>;const thumb=resolveGiftImageUrl(gift.image_url??gift.icon_path??(isAssetUrlLike(gift.icon)?gift.icon:null));if(thumb)return <img src={thumb} alt={gift.name} className={cls}/>;if(gift.clip_path&&gift.clip_type==="svg")return <img src={resolveGiftImageUrl(gift.clip_path)??gift.clip_path} alt={gift.name} className={cls}/>;return <span className={`${large?"text-5xl":"text-3xl"} leading-none`}>{gift.icon??gift.emoji??"🎁"}</span>;}

export function GiftSheet({open,onClose,roomId,receivers,onSent}:{open:boolean;onClose:()=>void;roomId:string;receivers:GiftReceiver[];onSent?:(info:{gift:Gift;targets:string[]})=>void}){
 const {profile,refresh}=useAuth();const qc=useQueryClient();const[selectedGift,setSelectedGift]=useState<Gift|null>(null);const[receiverId,setReceiverId]=useState<string|null>(receivers[0]?.id??null);const[sendToAll,setSendToAll]=useState(false);const[qty,setQty]=useState(1);const[activeTier,setActiveTier]=useState<Tier>("small");const[confirmOpen,setConfirmOpen]=useState(false);
 const gifts=useQuery({queryKey:["gifts"],queryFn:async()=>{const{data,error}=await supabase.from("gifts").select("id,name,emoji,icon,icon_path,image_url,price,price_coins,diamonds_value,category,animation,clip_path,clip_type,sound_url,sort_order,is_active,active").order("sort_order");if(error)throw error;const rows=(data??[]) as (Gift&{sort_order?:number;is_active?:boolean;active?:boolean})[];const dbGifts=rows.filter(g=>g.is_active!==false&&g.active!==false);const ids=new Set(dbGifts.map(g=>g.id));return[...dbGifts,...CATALOG_GIFTS.filter(g=>!ids.has(g.id))];},enabled:open});
 const price=(g:Gift|null)=>(g?.price_coins??g?.price??0) as number;
 const visibleGifts=useMemo(()=>[...(gifts.data??[])].filter(g=>tierOf(price(g))===activeTier).sort((a,b)=>price(a)-price(b)),[gifts.data,activeTier]);
 const giftVideoUrl=(g:Gift|null)=>{if(!g?.clip_path||!["mp4","webm","svga"].includes(g.clip_type??""))return null;return resolvePlayableGiftUrl(g.clip_path);};
 useEffect(()=>{if(!open)return;visibleGifts.forEach(g=>preloadGiftVideo(giftVideoUrl(g)));},[open,visibleGifts]);
 useEffect(()=>{if(!open||sendToAll||(receiverId&&receivers.some(r=>r.id===receiverId)))return;setReceiverId(receivers[0]?.id??null);},[open,receiverId,receivers,sendToAll]);
 const send=useMutation({mutationFn:async({gift,targets,quantity}:{gift:Gift;targets:string[];quantity:number})=>{if(!targets.length)throw new Error("Pick a receiver");if(targets.length===1){const{error}=await supabase.rpc("send_gift",{_room_id:roomId,_receiver_id:targets[0],_gift_id:gift.id,_quantity:quantity});if(error)throw error;}else{const{error}=await supabase.rpc("send_gift_multi",{_room_id:roomId,_receiver_ids:targets,_gift_id:gift.id,_quantity:quantity} as any);if(error)throw error;}return{gift,quantity};},onSuccess:async()=>{await refresh();qc.invalidateQueries({queryKey:["wallet_tx"]});setSelectedGift(null);setQty(1);},onError:(e:Error)=>toast.error(e.message)});
 if(!open)return null;
 const totalCost=price(selectedGift)*qty*(sendToAll?Math.max(1,receivers.length):1);const canAfford=(profile?.coins??0)>=totalCost;
 const performSend=()=>{if(!selectedGift||send.isPending)return;const targets=sendToAll?receivers.map(r=>r.id):receiverId?[receiverId]:[];if(!targets.length){toast.error("Pick a receiver");return;}onClose();send.mutate({gift:selectedGift,targets,quantity:qty});onSent?.({gift:selectedGift,targets});};
 const handleSend=()=>{if(!selectedGift||send.isPending)return;if(!canAfford){toast.error("Not enough coins");return;}if(tierOf(price(selectedGift))==="vip"){setConfirmOpen(true);return;}performSend();};
 return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:p-4" onClick={onClose}>
  <div onClick={e=>e.stopPropagation()} className="relative flex w-full max-w-md max-h-[78dvh] min-h-[430px] flex-col overflow-hidden rounded-t-[2rem] sm:rounded-3xl border border-white/10 bg-[#0f041e] text-white shadow-2xl">
   <div className="mx-auto mt-2 h-1 w-12 rounded-full bg-white/25"/>
   <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/10"><div className="text-sm font-black">Gifts</div><div className="flex gap-1">{TIER_ORDER.map(t=><button key={t} onClick={()=>{setActiveTier(t);setSelectedGift(null)}} className={`rounded-full px-2.5 py-1 text-[10px] font-black ${activeTier===t?"bg-violet-600":"bg-white/10"}`}>{TIER_LABEL[t]}</button>)}</div></div>
   <div className="flex-1 overflow-y-auto p-3">
    {gifts.isLoading?<div className="grid min-h-48 place-items-center"><Loader2 className="animate-spin"/></div>:gifts.isError?<div className="p-6 text-center text-sm text-red-300">Unable to load gifts. Please try again.</div>:visibleGifts.length===0?<div className="p-8 text-center text-sm text-white/50">No gifts in this category.</div>:<div className="grid grid-cols-4 gap-2 sm:grid-cols-5">{visibleGifts.map(g=><button key={g.id} type="button" onClick={()=>{setSelectedGift(g);preloadGiftVideo(giftVideoUrl(g))}} className={`rounded-2xl border p-2 text-center transition ${selectedGift?.id===g.id?"border-violet-400 bg-violet-500/20":"border-white/10 bg-white/[.04] hover:bg-white/[.08]"}`}><div className="mx-auto h-14 w-14"><GiftPreview gift={g}/></div><div className="mt-1 truncate text-[10px] font-bold">{g.name}</div><div className="mt-0.5 flex items-center justify-center gap-0.5 text-[9px] text-yellow-300"><Coins className="h-3 w-3"/>{price(g)}</div></button>)}</div>}
   </div>
   <div className="border-t border-white/10 bg-black/20 p-3 space-y-2">
    <div className="flex items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2">{selectedGift?<><div className="h-10 w-10 shrink-0"><GiftPreview gift={selectedGift} large/></div><div className="min-w-0"><div className="truncate text-xs font-black">{selectedGift.name}</div><div className="text-[10px] text-white/50">{price(selectedGift)} coins</div></div></>:<span className="text-xs text-white/50">Select a gift</span>} </div>{receivers.length>1&&<button onClick={()=>setSendToAll(v=>!v)} className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black">{sendToAll?"ALL":"TO"}</button>}</div>
    <div className="flex items-center gap-2">{!sendToAll&&<select value={receiverId??""} onChange={e=>setReceiverId(e.target.value||null)} className="min-w-0 flex-1 rounded-xl bg-white/10 px-3 py-2 text-xs outline-none"><option value="">Select receiver</option>{receivers.map(r=><option key={r.id} value={r.id}>{r.username??"User"}</option>)}</select>}<div className="flex items-center rounded-xl bg-white/10"><button onClick={()=>setQty(q=>Math.max(1,q-1))} className="px-3 py-2">−</button><span className="w-7 text-center text-xs font-bold">{qty}</span><button onClick={()=>setQty(q=>q+1)} className="px-3 py-2">+</button></div><button disabled={!selectedGift||send.isPending||!canAfford} onClick={handleSend} className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-black disabled:opacity-40"><Send className="h-3.5 w-3.5"/>Send</button></div>
    <div className="text-right text-[9px] text-white/40">Balance: {profile?.coins??0} coins{selectedGift?` • Total: ${totalCost}`:""}</div>
   </div>
  </div>
  {confirmOpen&&selectedGift&&<div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-5" onClick={()=>setConfirmOpen(false)}><div className="w-full max-w-sm rounded-2xl bg-[#180827] p-5" onClick={e=>e.stopPropagation()}><div className="text-lg font-black">Confirm VIP Gift</div><p className="mt-2 text-sm text-white/60">Send {selectedGift.name} for {totalCost} coins?</p><div className="mt-4 flex gap-2"><button className="flex-1 rounded-xl bg-white/10 py-2 text-sm" onClick={()=>setConfirmOpen(false)}>Cancel</button><button className="flex-1 rounded-xl bg-violet-600 py-2 text-sm font-bold" onClick={()=>{setConfirmOpen(false);performSend()}}>Confirm</button></div></div></div>}
 </div>;
}
