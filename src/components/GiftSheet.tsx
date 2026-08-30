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
function GiftPreview({gift,large=false}:{gift:Gift;large?:boolean}){const cls="h-full w-full object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]";if(isRoyalRoseGift(gift.name))return <img src={ROYAL_ROSE_THUMB_URL} alt={gift.name} className={cls}/>;const thumb=resolveGiftImageUrl(gift.image_url??gift.icon_path??(isAssetUrlLike(gift.icon)?gift.icon:null));if(thumb)return <img src={thumb} alt={gift.name} className={cls}/>;if(gift.clip_path&&gift.clip_type==="svg")return <img src={resolveGiftImageUrl(gift.clip_path)??gift.clip_path} alt={gift.name} className={cls}/>;return <span className={`${large?"text-3xl":"text-2xl"} leading-none`}>{gift.icon??gift.emoji??"🎁"}</span>;}

export function GiftSheet({open,onClose,roomId,receivers,onSent}:{open:boolean;onClose:()=>void;roomId:string;receivers:GiftReceiver[];onSent?:(info:{gift:Gift;targets:string[]})=>void}){
 const {profile,refresh}=useAuth();const qc=useQueryClient();const[selectedGift,setSelectedGift]=useState<Gift|null>(null);const[sendToAll,setSendToAll]=useState(false);const[qty,setQty]=useState(1);const[activeTier,setActiveTier]=useState<Tier>("small");const[confirmOpen,setConfirmOpen]=useState(false);
 
 const [selectedReceiverIds, setSelectedReceiverIds] = useState<string[]>([]);
 
 useEffect(()=>{
  if(open && receivers.length > 0 && selectedReceiverIds.length === 0){
   setSelectedReceiverIds(receivers.map(r => r.id));
  }
 },[open, receivers]);

 const gifts=useQuery({queryKey:["gifts"],queryFn:async()=>{const{data,error}=await supabase.from("gifts").select("id,name,emoji,icon,icon_path,image_url,price,price_coins,diamonds_value,category,animation,clip_path,clip_type,sound_url,sort_order,is_active,active").order("sort_order");if(error)throw error;const rows=(data??[]) as (Gift&{sort_order?:number;is_active?:boolean;active?:boolean})[];const dbGifts=rows.filter(g=>g.is_active!==false&&g.active!==false);const ids=new Set(dbGifts.map(g=>g.id));return[...dbGifts,...CATALOG_GIFTS.filter(g=>!ids.has(g.id))];},enabled:open});
 const price=(g:Gift|null)=>(g?.price_coins??g?.price??0) as number;
 
 const visibleGifts=useMemo(()=>[...(gifts.data??[])].filter(g=>tierOf(price(g))===activeTier).sort((a,b)=>price(a)-price(b)),[gifts.data,activeTier]);
 
 const giftVideoUrl=(g:Gift|null)=>{if(!g?.clip_path||!["mp4","webm","svga"].includes(g.clip_type??""))return null;return resolvePlayableGiftUrl(g.clip_path);};
 useEffect(()=>{if(!open)return;visibleGifts.forEach(g=>preloadGiftVideo(giftVideoUrl(g)));},[open,visibleGifts]);
 
 const send=useMutation({mutationFn:async({gift,targets,quantity}:{gift:Gift;targets:string[];quantity:number})=>{if(!targets.length)throw new Error("Pick a receiver");if(targets.length===1){const{error}=await supabase.rpc("send_gift",{_room_id:roomId,_receiver_id:targets[0],_gift_id:gift.id,_quantity:quantity});if(error)throw error;}else{const{error}=await supabase.rpc("send_gift_multi",{_room_id:roomId,_receiver_ids:targets,_gift_id:gift.id,_quantity:quantity} as any);if(error)throw error;}return{gift,quantity};},onSuccess:async()=>{await refresh();qc.invalidateQueries({queryKey:["wallet_tx"]});setSelectedGift(null);setQty(1);},onError:(e:Error)=>toast.error(e.message)});
 
 if(!open)return null;

 const effectiveTargets = sendToAll ? receivers.map(r => r.id) : selectedReceiverIds;
 const totalCost = price(selectedGift) * qty * Math.max(1, effectiveTargets.length);
 const canAfford = (profile?.coins ?? 0) >= totalCost;

 const performSend = () => {
  if(!selectedGift || send.isPending) return;
  if(!effectiveTargets.length){toast.error("Pick a receiver");return;}
  onClose();
  send.mutate({gift:selectedGift, targets:effectiveTargets, quantity:qty});
  onSent?.({gift:selectedGift, targets:effectiveTargets});
 };

 const handleSend = () => {
  if(!selectedGift || send.isPending) return;
  if(!canAfford){toast.error("Not enough coins");return;}
  if(tierOf(price(selectedGift))==="vip"){setConfirmOpen(true);return;}
  performSend();
 };

 const toggleReceiver = (id: string) => {
  if(sendToAll) return;
  setSelectedReceiverIds(prev => 
   prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
  );
 };

 return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 transition-opacity" onClick={onClose}>
  <div onClick={e=>e.stopPropagation()} className="relative flex w-full max-w-lg h-[310px] flex-col overflow-hidden rounded-t-[20px] border border-white/10 bg-[#121212]/95 backdrop-blur-xl text-white shadow-2xl animate-in slide-in-from-bottom duration-200">
   
   {/* Header App Title & Tabs + Send to All */}
   <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-black/30">
    <div className="flex items-center gap-2">
     <span className="text-xs font-black bg-gradient-to-r from-pink-400 to-violet-500 bg-clip-text text-transparent">Jalwa</span>
     <div className="flex gap-1">
      {TIER_ORDER.map(t=><button key={t} onClick={()=>{setActiveTier(t);setSelectedGift(null)}} className={`rounded-full px-2 py-0.5 text-[10px] font-black transition-all ${activeTier===t?"bg-gradient-to-r from-pink-500 to-violet-600 text-white shadow-md":"bg-white/10 text-white/70 hover:bg-white/15"}`}>{TIER_LABEL[t]}</button>)}
     </div>
    </div>
    <button 
     onClick={()=>setSendToAll(v=>!v)} 
     className={`rounded-lg px-2.5 py-1 text-[10px] font-black transition ${sendToAll?"bg-pink-600 text-white shadow-lg shadow-pink-600/30":"bg-white/10 text-white/80 hover:bg-white/15"}`}
    >
     {sendToAll ? "ALL SELECTED" : "SEND TO ALL"}
    </button>
   </div>

   {/* Top Host Seat Avatars Selector Bar */}
   <div className="flex items-center gap-2 px-3 py-2 overflow-x-auto border-b border-white/5 bg-black/20 no-scrollbar">
    {receivers.map(r=>{
     const isSelected = sendToAll || selectedReceiverIds.includes(r.id);
     return (
      <button
       key={r.id}
       onClick={()=>toggleReceiver(r.id)}
       className={`relative flex flex-col items-center shrink-0 transition-all ${isSelected ? "opacity-100 scale-105" : "opacity-50 hover:opacity-80"}`}
      >
       <div className={`relative h-9 w-9 rounded-full p-0.5 ${isSelected ? "bg-gradient-to-tr from-pink-500 to-violet-500 shadow-sm shadow-pink-500/50" : "bg-white/20"}`}>
        <img src={r.avatar ?? "https://github.com/shadcn.png"} alt={r.username??"User"} className="h-full w-full rounded-full object-cover bg-black"/>
        {isSelected && (
         <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-pink-500 flex items-center justify-center text-[8px] font-bold text-white border border-[#121212]">✓</div>
        )}
       </div>
       <span className="text-[9px] font-medium text-white/80 truncate max-w-[42px] mt-0.5">{r.username??"User"}</span>
      </button>
     );
    })}
   </div>

   {/* Horizontal Swipeable/Scrollable Gift List Container (Left to Right) */}
   <div className="flex-1 overflow-x-auto overflow-y-hidden px-3 py-2 flex items-center gap-2.5 no-scrollbar scroll-smooth">
    {gifts.isLoading ? (
     <div className="w-full flex items-center justify-center"><Loader2 className="animate-spin h-5 w-5 text-violet-400"/></div>
    ) : gifts.isError ? (
     <div className="w-full text-center text-xs text-red-300">Failed to load gifts.</div>
    ) : visibleGifts.length === 0 ? (
     <div className="w-full text-center text-xs text-white/40">No gifts available in this tier.</div>
    ) : (
     visibleGifts.map(g=>{
      const isSelected = selectedGift?.id === g.id;
      return (
       <button 
        key={g.id} 
        type="button" 
        onClick={()=>{setSelectedGift(g);preloadGiftVideo(giftVideoUrl(g))}} 
        className={`relative flex flex-col items-center justify-between shrink-0 w-[78px] h-[78px] rounded-xl border p-1 text-center transition-all ${isSelected?"border-pink-500 bg-pink-500/15 shadow-[0_0_10px_rgba(236,72,153,0.3)]":"border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"}`}
       >
        <div className="h-8 w-8 flex items-center justify-center mt-0.5">
         <GiftPreview gift={g}/>
        </div>
        <div className="w-full truncate text-[10px] font-medium text-white/90 px-0.5">{g.name}</div>
        <div className="flex items-center justify-center gap-0.5 text-[9px] text-yellow-300 font-bold">
         <Coins className="h-2.5 w-2.5"/>
         <span>{price(g)}</span>
        </div>
       </button>
      );
     })
    )}
   </div>

   {/* Compact Footer Action Bar with Coin Balance */}
   <div className="border-t border-white/10 bg-black/40 px-3 py-2 flex items-center justify-between gap-2">
    
    {/* Coin Balance View */}
    <div className="flex items-center gap-1.5 bg-white/[0.06] border border-white/10 px-3 py-1.5 rounded-xl">
     <Coins className="h-3.5 w-3.5 text-yellow-400 animate-pulse"/>
     <span className="text-xs font-black text-yellow-400">{profile?.coins ?? 0}</span>
    </div>

    <div className="flex items-center gap-2">
     {/* Quantity Selector */}
     <div className="flex items-center rounded-xl bg-white/10 border border-white/10 overflow-hidden">
      <button onClick={()=>setQty(q=>Math.max(1,q-1))} className="px-2.5 py-1.5 text-xs hover:bg-white/10 active:scale-95 transition">−</button>
      <span className="w-6 text-center text-xs font-bold">{qty}</span>
      <button onClick={()=>setQty(q=>q+1)} className="px-2.5 py-1.5 text-xs hover:bg-white/10 active:scale-95 transition">+</button>
     </div>

     {/* Send Button */}
     <button 
      disabled={!selectedGift || send.isPending || !canAfford} 
      onClick={handleSend} 
      className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-pink-500 to-violet-600 px-4 py-1.5 text-xs font-black text-white shadow-lg shadow-pink-500/25 disabled:opacity-40 disabled:shadow-none active:scale-95 transition"
     >
      <Send className="h-3.5 w-3.5"/>
      Send {selectedGift ? `(${totalCost})` : ""}
     </button>
    </div>
   </div>

  </div>

  {/* VIP Confirmation Modal */}
  {confirmOpen && selectedGift && (
   <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-5 backdrop-blur-sm animate-in fade-in duration-150" onClick={()=>setConfirmOpen(false)}>
    <div className="w-full max-w-sm rounded-2xl bg-[#1a1128] border border-white/15 p-5 shadow-2xl" onClick={e=>e.stopPropagation()}>
     <div className="text-base font-black text-white">Confirm VIP Gift</div>
     <p className="mt-1.5 text-xs text-white/60">Send <span className="text-white font-bold">{selectedGift.name}</span> for <span className="text-yellow-400 font-bold">{totalCost} coins</span>?</p>
     <div className="mt-5 flex gap-2">
      <button className="flex-1 rounded-xl bg-white/10 py-2 text-xs font-bold text-white/80 hover:bg-white/15 transition" onClick={()=>setConfirmOpen(false)}>Cancel</button>
      <button className="flex-1 rounded-xl bg-gradient-to-r from-pink-500 to-violet-600 py-2 text-xs font-black text-white shadow-lg shadow-pink-500/25 transition" onClick={()=>{setConfirmOpen(false);performSend()}}>Confirm</button>
     </div>
    </div>
   </div>
  )}
 </div>;
}
