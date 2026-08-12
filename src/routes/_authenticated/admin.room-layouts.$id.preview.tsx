import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Monitor } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { LayoutElement, LayoutJSON } from "@/lib/room-layouts";

export const Route = createFileRoute("/_authenticated/admin/room-layouts/$id/preview")({
  component: LayoutPreviewPage,
});

function LayoutPreviewPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: layout, isLoading, error } = useQuery({
    queryKey: ["room_layout_preview", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("room_layouts").select("*").eq("id", id).single();
      if (error) throw error;
      return data as { name: string; type: string; layout_json: LayoutJSON };
    },
  });

  if (isLoading) return <div className="min-h-screen bg-[#050508] text-white flex items-center justify-center">Loading preview...</div>;
  if (error || !layout) return <div className="min-h-screen bg-[#050508] text-red-400 flex items-center justify-center">Unable to load layout preview.</div>;

  const json = layout.layout_json;
  const background = json.background?.type === "color" ? json.background.value : json.canvas.backgroundColor || "#0a0a0f";
  return (
    <div className="min-h-screen bg-[#050508] text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <button onClick={() => navigate({ to: `/admin/room-layouts/${id}/edit` })} className="flex items-center gap-2 text-white/60 hover:text-white mb-3">
              <ArrowLeft className="h-4 w-4" /> Back to Editor
            </button>
            <h1 className="text-2xl font-bold">{layout.name}</h1>
            <p className="text-white/50 capitalize">{layout.type} layout preview</p>
          </div>
          <Monitor className="h-6 w-6 text-white/50" />
        </div>
        <div className="flex justify-center overflow-auto p-8 bg-white/[0.03] rounded-2xl border border-white/10">
          <div className="relative overflow-hidden rounded-xl border border-white/20 shadow-2xl" style={{ width: json.canvas.width, height: json.canvas.height, background }}>
            {json.elements.filter((el) => el.visible).sort((a, b) => a.zIndex - b.zIndex).map((element) => <PreviewElement key={element.id} element={element} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewElement({ element }: { element: LayoutElement }) {
  return <div className="absolute flex items-center justify-center text-white/70 text-xs border border-white/20 bg-white/5" style={{ left: element.x, top: element.y, width: element.width, height: element.height, zIndex: element.zIndex, opacity: element.opacity ?? 1, transform: `rotate(${element.rotation || 0}deg) scale(${element.scale || 1})`, borderRadius: element.borderRadius || 8 }}>{element.type}</div>;
}
