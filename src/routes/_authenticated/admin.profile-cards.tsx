import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uploadFileAtPath } from "@/lib/uploads";
import { toast } from "sonner";
import { Loader2, Plus, Save, Trash2, Upload, X } from "lucide-react";

type Card = {
  id:string; key:string; name:string; description:string|null; category:string; rarity:string;
  bg_media_url:string; bg_media_type:string; bg_chromakey:string; thumbnail_url:string|null;
  frame_media_url:string|null; frame_media_type:string; frame_chromakey:string;
  frame_effect:string; accent_color:string; glow_color:string; particle_style:string;
  price_coins:number; price_diamonds:number; min_vip_level:number; duration_days:number|null;
  is_active:boolean; is_limited:boolean; starts_at:string|null; ends_at:string|null; sort_order:number;
};
const blank:Partial<Card>={
  key:"",name:"",description:"",category:"Basic",rarity:"common",bg_media_url:"",bg_media_type:"image",bg_chromakey:"none",
  thumbnail_url:"",frame_media_url:"",frame_media_type:"none",frame_chromakey:"none",
  frame_effect:"gold",accent_color:"#ffd76a",glow_color:"#a855f7",particle_style:"sparkles",
  price_coins:0,price_diamonds:0,min_vip_level:0,duration_days:null,is_active:true,is_limited:false,sort_order:0
};

function MediaPreview({url,type,className=""}:{url?:string|null;type?:string;className?:string}) {
  if (!url) return <div className={`grid place-items-center rounded-xl bg-muted ${className}`}>No media</div>;
  if (type==="mp4"||type==="webm") return <video src={url} autoPlay muted loop playsInline className={`rounded-xl object-contain ${className}`} />;
  return <img src={url} className={`rounded-xl object-contain ${className}`} alt="" />;
}

function Page(){
 const [rows,setRows]=useState<Card[]>([]),[edit,setEdit]=useState<Partial<Card>|null>(null),[busy,setBusy]=useState(false);
 const load=async()=>{const {data,error}=await supabase.from("profile_cards").select("*").order("sort_order").order("created_at");if(error)toast.error(error.message);else setRows((data||[]) as Card[])};
 useEffect(()=>{void load()},[]);
 const set=(k:keyof Card,v:any)=>setEdit(e=>({...e,[k]:v}));
 const upload=async(k:"bg_media_url"|"thumbnail_url"|"frame_media_url",f:File)=>{
   if(!edit)return;
   const allowed=k==="thumbnail_url"?f.type.startsWith("image/"):(f.type.startsWith("image/")||f.type==="video/mp4"||f.type==="video/webm");
   if(!allowed)return toast.error("Use PNG/JPG for thumbnails, or PNG/JPG/MP4/WebM for frames");
   try{
     const path="profile-cards/"+Date.now()+"_"+f.name.replace(/[^\w.-]+/g,"_");
     const url=await uploadFileAtPath("shop-assets",path,f); set(k,url);
     if(k==="bg_media_url")set("bg_media_type",f.type==="video/mp4"?"mp4":f.type==="video/webm"?"webm":"image");
     if(k==="frame_media_url")set("frame_media_type",f.type==="video/mp4"?"mp4":f.type==="video/webm"?"webm":"image");
     toast.success("Uploaded to R2");
   }catch(e){toast.error(e instanceof Error?e.message:"Upload failed")}
 };
 const save=async()=>{
   if(!edit?.key?.trim()||!edit.name?.trim())return toast.error("Key and name are required");
   if(!edit.bg_media_url?.trim())return toast.error("Background media is required");
   setBusy(true);
   const p={...edit}; delete (p as any).id; delete (p as any).created_at; delete (p as any).updated_at;
   const r=await supabase.rpc("admin_upsert_profile_card",{_payload:edit.id?{...p,id:edit.id}:p});
   setBusy(false); if(r.error)return toast.error(r.error.message);
   toast.success("Profile Card saved");setEdit(null);void load();
 };
 const del=async(id:string)=>{if(!confirm("Delete this Profile Card?"))return;const r=await supabase.rpc("admin_delete_profile_card",{_id:id});if(r.error)toast.error(r.error.message);else void load()};
 return <div className="mx-auto max-w-6xl p-4">
  <div className="mb-5 flex items-center justify-between"><div><h1 className="text-2xl font-black">Profile Card Frames</h1><p className="text-xs text-muted-foreground">Outer card frame assets are separate from User DP Frames.</p></div><button onClick={()=>setEdit({...blank})} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold"><Plus className="mr-1 inline h-4 w-4"/>New</button></div>
  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">{rows.map(c=><div key={c.id} className="rounded-2xl border border-border bg-card p-3">
    <MediaPreview url={c.thumbnail_url||c.bg_media_url} type={c.thumbnail_url?"image":c.bg_media_type} className="h-32 w-full" />
    <div className="mt-2 flex items-center justify-between"><p className="font-bold">{c.name}</p>{c.frame_media_url&&<span className="rounded-full border px-2 py-0.5 text-[10px]">Outer Frame</span>}</div>
    <p className="text-xs text-muted-foreground">{c.category} · {c.rarity}</p>
    <div className="mt-2 flex gap-2"><button onClick={()=>setEdit(c)} className="flex-1 rounded-lg border py-2 text-xs">Edit</button><button onClick={()=>void del(c.id)} className="rounded-lg border border-red-500/30 px-3 text-red-400"><Trash2 className="h-4 w-4"/></button></div>
  </div>)}</div>
  {edit&&<div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4"><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-card p-4">
    <div className="flex justify-between"><div><h2 className="text-lg font-black">{edit.id?"Edit":"New"} Profile Card</h2><p className="text-xs text-muted-foreground">Upload the frame that wraps the card's outside edge.</p></div><button onClick={()=>setEdit(null)}><X/></button></div>
    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
      {([["key","Key"],["name","Name"],["description","Description"],["category","Category"],["bg_media_url","Background URL"],["thumbnail_url","Thumbnail URL"]] as const).map(([k,l])=><label key={k} className="space-y-1"><span className="text-xs font-semibold">{l}</span><div className="flex gap-1"><input value={(edit as any)[k]??""} onChange={e=>set(k,e.target.value)} className="w-full rounded-lg border bg-background px-2 py-2 text-xs"/>{(k==="bg_media_url"||k==="thumbnail_url")&&<label className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border"><Upload className="h-4 w-4"/><input type="file" accept={k==="thumbnail_url"?"image/*":"image/*,video/mp4,video/webm"} className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)void upload(k,f)}}/></label>}</div></label>)}
      <label className="col-span-2 rounded-xl border border-primary/30 bg-primary/5 p-3"><span className="text-xs font-bold">Outer Profile Card Frame Asset</span><div className="mt-2 flex gap-2"><input value={edit.frame_media_url??""} onChange={e=>set("frame_media_url",e.target.value)} placeholder="PNG / MP4 / WebM URL" className="w-full rounded-lg border bg-background px-2 py-2 text-xs"/><label className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border"><Upload className="h-4 w-4"/><input type="file" accept="image/*,video/mp4,video/webm" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)void upload("frame_media_url",f)}}/></label></div><p className="mt-1 text-[10px] text-muted-foreground">PNG = static frame. MP4/WebM = animated frame, autoplay + loop.</p>{edit.frame_media_url&&<MediaPreview url={edit.frame_media_url} type={edit.frame_media_type} className="mt-2 h-28 w-full bg-black/20"/></label>
      <label><span className="text-xs">Frame Media Type</span><select value={edit.frame_media_type||"none"} onChange={e=>set("frame_media_type",e.target.value)} className="w-full rounded-lg border bg-background p-2">{["none","image","mp4","webm"].map(x=><option key={x}>{x}</option>)}</select></label>
      <label><span className="text-xs">Frame Chroma Key</span><select value={edit.frame_chromakey||"none"} onChange={e=>set("frame_chromakey",e.target.value)} className="w-full rounded-lg border bg-background p-2">{["none","green","black","luma"].map(x=><option key={x}>{x}</option>)}</select></label>
      <label><span className="text-xs">Media Type</span><select value={edit.bg_media_type||"image"} onChange={e=>set("bg_media_type",e.target.value)} className="w-full rounded-lg border bg-background p-2">{["builtin","image","mp4","webm","lottie","svga"].map(x=><option key={x}>{x}</option>)}</select></label>
      <label><span className="text-xs">Background Chroma Key</span><select value={edit.bg_chromakey||"none"} onChange={e=>set("bg_chromakey",e.target.value)} className="w-full rounded-lg border bg-background p-2">{["none","green","black","luma"].map(x=><option key={x}>{x}</option>)}</select></label>
      {([["price_coins","Coins"],["price_diamonds","Diamonds"],["min_vip_level","Min VIP"],["duration_days","Duration Days"],["sort_order","Sort Order"]] as const).map(([k,l])=><label key={k}><span className="text-xs">{l}</span><input type="number" value={(edit as any)[k]??""} onChange={e=>set(k,e.target.value===""?null:Number(e.target.value))} className="w-full rounded-lg border bg-background p-2"/></label>)}
      <label className="col-span-2 flex gap-2"><input type="checkbox" checked={!!edit.is_active} onChange={e=>set("is_active",e.target.checked)}/>Active</label>
    </div>
    <button disabled={busy} onClick={()=>void save()} className="mt-4 w-full rounded-xl bg-primary py-3 font-bold">{busy?<Loader2 className="mx-auto h-4 w-4 animate-spin"/>:<><Save className="mr-1 inline h-4 w-4"/>Save Profile Card</>}</button>
  </div></div>}
 </div>
}
export const Route=createFileRoute("/_authenticated/admin/profile-cards")({component:Page});
