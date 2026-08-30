import { useEffect, useRef, useState } from "react";
import { Trash2, Plus, Power, RefreshCw, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RoomSlide {
  id: string;
  title: string;
  image_url: string;
  link_url: string | null;
  is_active: boolean;
  sort_order: number;
}

export function AdminRoomSlidesManager() {
  const [slides, setSlides] = useState<RoomSlide[]>([]);
  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchSlides = async () => {
    const { data, error } = await supabase
      .from("room_slides")
      .select("id, title, image_url, link_url, is_active, sort_order")
      .order("sort_order", { ascending: true });
    
    if (error) return toast.error(error.message);
    setSlides((data ?? []) as RoomSlide[]);
  };

  useEffect(() => {
    void fetchSlides();
  }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !imageUrl.trim()) {
      return toast.error("Title and public image URL are required");
    }

    setLoading(true);
    const { error } = await supabase.from("room_slides").insert({
      title: title.trim(),
      image_url: imageUrl.trim(),
      link_url: linkUrl.trim() || null,
      is_active: true,
      sort_order: slides.length + 1,
    });
    
    setLoading(false);
    if (error) return toast.error(error.message);

    setTitle("");
    setImageUrl("");
    setLinkUrl("");
    toast.success("Slide added successfully");
    void fetchSlides();
  };

  const toggle = async (s: RoomSlide) => {
    const { error } = await supabase
      .from("room_slides")
      .update({ is_active: !s.is_active })
      .eq("id", s.id);
      
    if (error) return toast.error(error.message);
    toast.success(s.is_active ? "Slide deactivated" : "Slide activated");
    void fetchSlides();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("room_slides").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Slide deleted");
    void fetchSlides();
  };

  return (
    <div className="mx-auto max-w-4xl rounded-2xl bg-slate-900 p-6 text-white shadow-xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-amber-400">Voice Room Slides</h2>
          <p className="mt-1 text-xs text-slate-400">
            Manage slides shown in voice rooms using public image URLs (GitHub, Imgur, etc.).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchSlides()}
          className="rounded-lg bg-white/10 p-2 hover:bg-white/20"
          aria-label="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <form
        onSubmit={add}
        className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-slate-700 bg-slate-800 p-4 md:grid-cols-2"
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Slide Title"
          className="rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-xs text-white"
          required
        />
        <input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="Public Image URL (e.g. GitHub raw link)"
          className="rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-xs text-white"
          required
        />
        <input
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          placeholder="Link URL (Optional)"
          className="rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-xs text-white md:col-span-2"
        />

        {imageUrl && (
          <div className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900 p-2 md:col-span-2">
            <img src={imageUrl} alt="Preview" className="h-14 w-24 rounded-md object-cover" />
            <span className="min-w-0 truncate text-[10px] text-slate-400">{imageUrl}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-purple-600 py-2.5 text-xs font-bold text-white disabled:opacity-50 md:col-span-2"
        >
          <Plus className="h-4 w-4" />
          {loading ? "Adding..." : "Add New Slide"}
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400">
              <th className="p-3">Preview</th>
              <th className="p-3">Title</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {slides.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-500">
                  No slides yet.
                </td>
              </tr>
            ) : (
              slides.map((s) => (
                <tr key={s.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                  <td className="p-3">
                    <img
                      src={s.image_url}
                      alt=""
                      className="h-10 w-16 rounded-lg border border-slate-700 object-cover"
                    />
                  </td>
                  <td className="p-3 font-semibold">{s.title}</td>
                  <td className="p-3">
                    <span className={s.is_active ? "text-emerald-400" : "text-slate-500"}>
                      {s.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => void toggle(s)}
                        className="rounded-lg bg-white/10 p-2 hover:bg-white/20"
                        aria-label={s.is_active ? "Deactivate" : "Activate"}
                      >
                        <Power className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(s.id)}
                        className="rounded-lg bg-red-500/20 p-2 text-red-400 hover:bg-red-500 hover:text-white"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
