import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Plus, Save, Trash2, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/cms")({
  component: CmsAdmin,
});

type Page = {
  id: string;
  slug: string;
  title: string;
  content: string;
  is_published: boolean;
  updated_at: string;
};

function CmsAdmin() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["admin_cms"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cms_pages").select("*").order("slug");
      if (error) throw error;
      return (data ?? []) as Page[];
    },
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<{ slug: string; title: string; content: string; is_published: boolean }>({
    slug: "",
    title: "",
    content: "",
    is_published: true,
  });

  useEffect(() => {
    if (!selectedId) return;
    const p = list.data?.find((x) => x.id === selectedId);
    if (p) setForm({ slug: p.slug, title: p.title, content: p.content, is_published: p.is_published });
  }, [selectedId, list.data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.slug.trim() || !form.title.trim()) throw new Error("Slug + title required");
      if (selectedId) {
        const { error } = await supabase.from("cms_pages").update(form).eq("id", selectedId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cms_pages").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["admin_cms"] });
      setSelectedId(null);
      setForm({ slug: "", title: "", content: "", is_published: true });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cms_pages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_cms"] });
      setSelectedId(null);
      setForm({ slug: "", title: "", content: "", is_published: true });
    },
  });

  return (
    <>
      <AdminPageHeader title="CMS / Content" subtitle="Announcements, policies, FAQ, static pages" />
      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        <div className="space-y-2">
          <button
            onClick={() => {
              setSelectedId(null);
              setForm({ slug: "", title: "", content: "", is_published: true });
            }}
            className="glow-4d flex w-full items-center justify-center gap-1 rounded-full bg-primary py-2 text-xs font-bold text-primary-foreground"
          >
            <Plus className="h-3 w-3" /> New page
          </button>
          {list.isLoading ? (
            <div className="grid h-20 place-items-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : (
            list.data?.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-xs ${selectedId === p.id ? "bg-primary/15" : "bg-card/60"}`}
              >
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{p.title}</span>
                {!p.is_published && <span className="rounded-full bg-white/10 px-1.5 text-[9px]">draft</span>}
              </button>
            ))
          )}
        </div>

        <div className="glass rounded-2xl p-4">
          <div className="grid grid-cols-2 gap-2">
            <input
              placeholder="slug (e.g. terms)"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              className="rounded-lg border border-border bg-input px-2 py-1.5 text-xs"
            />
            <input
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="rounded-lg border border-border bg-input px-2 py-1.5 text-xs"
            />
          </div>
          <textarea
            placeholder="Content (Markdown)"
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            className="mt-2 min-h-[280px] w-full rounded-lg border border-border bg-input px-2 py-1.5 font-mono text-xs"
          />
          <label className="mt-2 flex items-center gap-2 text-xs">
            <input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} />
            Published
          </label>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="glow-4d inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
            >
              <Save className="h-3 w-3" /> {selectedId ? "Update" : "Create"}
            </button>
            {selectedId && (
              <button
                onClick={() => confirm("Delete page?") && remove.mutate(selectedId)}
                className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-4 py-2 text-xs font-bold text-red-400"
              >
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
