import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Monitor, Play } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { LayoutJSON, RoomType } from '@/lib/room-layouts';
import { publishRoomLayout } from '@/lib/room-layout-publishing';
import { RoomStudioElementPreview } from '@/components/admin/RoomStudioElementPreview';

export const Route = createFileRoute('/_authenticated/admin/room-layouts/$id/preview')({ component: LayoutPreviewPage });

type LayoutRow = { id: string; name: string; type: RoomType; layout_json: LayoutJSON; status: string; version: number };

function LayoutPreviewPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: layout, isLoading, error, refetch } = useQuery({ queryKey: ['room_layout_preview', id], queryFn: async () => { const { data, error } = await supabase.from('room_layouts').select('*').eq('id', id).single(); if (error) throw error; return data as LayoutRow; } });
  const publish = useMutation({ mutationFn: async () => { if (!layout) throw new Error('Layout not loaded'); return publishRoomLayout(layout.id, layout.layout_json, layout.type); }, onSuccess: () => refetch() });

  if (isLoading) return <div className="min-h-screen bg-[#050508] text-white flex items-center justify-center">Loading preview...</div>;
  if (error || !layout) return <div className="min-h-screen bg-[#050508] text-red-400 flex items-center justify-center">Unable to load layout preview.</div>;
  const json = layout.layout_json;
  const background = json.background?.type === 'color' ? json.background.value : json.canvas.backgroundColor || '#0a0a0f';
  const elements = [...json.elements].filter((e) => e.visible !== false).sort((a,b)=>a.zIndex-b.zIndex);

  return <div className="min-h-screen bg-[#050508] text-white p-6"><div className="max-w-[1500px] mx-auto"><div className="flex items-center justify-between mb-5 gap-4"><div><button onClick={()=>navigate({to:`/admin/room-layouts/${id}/edit`})} className="flex items-center gap-2 text-white/60 hover:text-white mb-2"><ArrowLeft className="h-4 w-4"/> Back to Editor</button><div className="flex items-center gap-3"><h1 className="text-2xl font-bold">{layout.name}</h1><span className="px-2 py-1 rounded-full bg-purple-500/15 text-purple-300 text-xs capitalize">{layout.type}</span>{layout.status==='published'&&<span className="flex items-center gap-1 text-emerald-300 text-xs"><CheckCircle2 className="h-3.5 w-3.5"/> Published</span>}</div><p className="text-white/45 text-sm">This is the visual room the admin is designing. Publish only when it is ready.</p></div><div className="flex items-center gap-2"><span className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/50 text-xs"><Monitor className="h-4 w-4"/>{json.canvas.width} × {json.canvas.height}</span><button onClick={()=>publish.mutate()} disabled={publish.isPending} className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 font-semibold flex items-center gap-2"><Play className="h-4 w-4"/>{publish.isPending?'Publishing…':'Publish Live'}</button></div></div><div className="grid xl:grid-cols-[1fr_320px] gap-5"><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 overflow-auto"><div className="flex justify-center min-w-fit"><div className="relative overflow-hidden rounded-2xl border border-white/20 shadow-2xl" style={{width:json.canvas.width,height:json.canvas.height,background}}>{elements.map((element)=><div key={element.id} className="absolute" style={{left:element.x,top:element.y,width:element.width,height:element.height,zIndex:element.zIndex,opacity:element.opacity??1,transform:`rotate(${element.rotation||0}deg) scale(${element.scale||1})`,transformOrigin:'center',borderRadius:element.borderRadius||0,overflow:'hidden',boxShadow:element.style?.boxShadow}}><RoomStudioElementPreview element={element} roomType={layout.type}/></div>)}</div></div></div><aside className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 h-fit"><h2 className="font-semibold mb-4">Page publish status</h2><div className="space-y-3 text-sm"><div className="flex justify-between"><span className="text-white/45">Type</span><span>{layout.type.toUpperCase()}</span></div><div className="flex justify-between"><span className="text-white/45">Version</span><span>{layout.version}</span></div><div className="flex justify-between"><span className="text-white/45">Elements</span><span>{elements.length}</span></div><div className="flex justify-between"><span className="text-white/45">Status</span><span className={layout.status==='published'?'text-emerald-300':'text-amber-300'}>{layout.status}</span></div></div><div className="mt-5 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-200 text-xs leading-5">Voice, Video and PK are independent pages. You can finish one page, publish it, then move to the next page without changing the others.</div></aside></div></div></div>;
}
