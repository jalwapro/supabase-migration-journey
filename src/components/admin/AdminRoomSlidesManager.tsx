import { useEffect, useRef, useState } from "react";
import { Trash2, Plus, Power, Upload, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RoomSlide { id:string; title:string; image_url:string; link_url:string|null; is_active:boolean; sort_order:number; }

export function AdminRoomSlidesManager() {
  const [slides,setSlides]=useState<RoomSlide[]>([]);
  const [title,setTitle]=useState("");
  const [imageUrl,setImageUrl]=useState("");
  const [linkUrl,setLinkUrl]=useState("");
  const [loading,setLoading]=useState(false);
  const [uploading,setUploading]=useState(false);
  const fileRef=useRef<HTMLInputElement>(null);

  const fetchSlides=async()=>{
    const {data,error}=await supabase.from("room_slides").select("id,title,image_url,link_url,is_active,sort_order").order("sort_order",{ascending:true});
    if(error)return toast.error(error.message);
    setSlides((data??[]) as RoomSlide[]);
  };
  useEffect(()=>{void fetchSlides();},[]);

  const uploadImage=async(file:File)=>{
    if(!file.type.startsWith("image/")) return toast.error("Please select an image file");
    if(file.size>8*1024*1024) return toast.error("Image must be 8MB or smaller");
    setUploading(true);
    try{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.access_token) throw new Error("Please sign in again");
      const form=new FormData();
      form.append("file",file);
      form.append("folder","voice-room-slides");
      const {data,error}=await supabase.functions.invoke("r2-upload",{body:form,headers:{Authorization:`Bearer ${session.access_token}`}});
      if(error) throw error;
      const url=String((data as {url?:string})?.url||"");
      if(!url) throw new Error("R2 did not return an image URL");
      setImageUrl(url);
      toast.success("Image uploaded to R2");
    }catch(error){
      toast.error(error instanceof Error?error.message:"Image upload failed");
    }finally{setUploading(false);}
  };

  const add=async(e:React.FormEvent)=>{
    e.preventDefault();
    if(!title.trim()||!imageUrl.trim())return toast.error("Title and image are required");
    setLoading(true);
    const {error}=await supabase.from("room_slides").insert({title:title.trim(),image_url:imageUrl.trim(),link_url:linkUrl.trim()||null,is_active:true,sort_order:slides.length+1});
    setLoading(false);
    if(error)return toast.error(error.message);
    setTitle("");setImageUrl("");setLinkUrl("");
    if(fileRef.current) fileRef.current.value="";
    toast.success("Slide added");
    void fetchSlides();
  };

  const toggle=async(s:RoomSlide)=>{
    const {error}=await supabase.from("room_slides").update({is_active:!s.is_active}).eq("id",s.id);
    if(error)return toast.error(error.message);
    toast.success(s.is_active?"Slide deactivated":"Slide activated");
    void fetchSlides();
  };

  const remove=async(id:string)=>{
    const {error}=await supabase.from("room_slides").delete().eq("id",id);
    if(error)return toast.error(error.message);
    toast.success("Slide deleted");
    void fetchSlides();
  };

  return <div className="mx-auto max-w-4xl rounded-2xl bg-slate-900 p-6 text-white shadow-xl">
    <div className="mb-4 flex items-center justify-between gap-3">
      <div><h2 className="text-xl font-bold text-amber-400">Voice Room Slides</h2><p className="mt-1 text-xs text-slate-400">Manage slides shown in voice rooms. Images upload directly to Cloudflare R2.</p></div>
      <button type="button" onClick={()=>void fetchSlides()} className="rounded-lg bg-white/10 p-2 hover:bg-white/20" aria-label="Refresh"><RefreshCw className="h-4 w-4"/></button>
    </div>

    <form onSubmit={add} className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-slate-700 bg-slate-800 p-4 md:grid-cols-3">
      <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Slide Title" className="rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-xs" required/>
      <div className="flex gap-2 md:col-span-2">
        <input value={imageUrl} onChange={e=>setImageUrl(e.target.value)} placeholder="R2 image URL" className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-xs" required/>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)void uploadImage(f);}}/>
        <button type="button" disabled={uploading} onClick={()=>fileRef.current?.click()} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-300 disabled:opacity-50"><Upload className="h-3.5 w-3.5"/>{uploading?"Uploading...":"Upload"}</button>
      </div>
      <input value={linkUrl} onChange={e=>setLinkUrl(e.target.value)} placeholder="Link URL (Optional)" className="rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-xs md:col-span-3"/>
      {imageUrl&&<div className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900 p-2 md:col-span-3"><img src={imageUrl} alt="Preview" className="h-14 w-24 rounded-md object-cover"/><span className="min-w-0 truncate text-[10px] text-slate-400">{imageUrl}</span></div>}
      <button type="submit" disabled={loading||uploading} className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-purple-600 py-2.5 text-xs font-bold disabled:opacity-50 md:col-span-3"><Plus className="h-4 w-4"/>{loading?"Adding...":"Add New Slide"}</button>
    </form>

    <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b border-slate-700 text-slate-400"><th className="p-3">Preview</th><th className="p-3">Title</th><th className="p-3">Status</th><th className="p-3 text-center">Actions</th></tr></thead><tbody>
      {slides.length===0?<tr><td colSpan={4} className="p-8 text-center text-slate-500">No slides yet.</td></tr>:slides.map(s=><tr key={s.id} className="border-b border-slate-800 hover:bg-slate-800/50"><td className="p-3"><img src={s.image_url} alt="" className="h-10 w-16 rounded-lg border border-slate-700 object-cover"/></td><td className="p-3 font-semibold">{s.title}</td><td className="p-3"><span className={s.is_active?"text-emerald-400":"text-slate-500"}>{s.is_active?"Active":"Inactive"}</span></td><td className="p-3"><div className="flex justify-center gap-2"><button type="button" onClick={()=>void toggle(s)} className="rounded-lg bg-white/10 p-2 hover:bg-white/20" aria-label={s.is_active?"Deactivate":"Activate"}><Power className="h-4 w-4"/></button><button type="button" onClick={()=>void remove(s.id)} className="rounded-lg bg-red-500/20 p-2 text-red-400 hover:bg-red-500 hover:text-white" aria-label="Delete"><Trash2 className="h-4 w-4"/></button></div></td></tr>)}
    </tbody></table></div>
  </div>;
}
