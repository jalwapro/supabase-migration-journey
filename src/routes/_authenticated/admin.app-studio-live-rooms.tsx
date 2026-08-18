import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { LiveRoomStudioPanel, type LiveRoomKind } from "@/components/studio/LiveRoomStudioPanel";
import { normalizePageConfig, type AppPageConfig } from "@/lib/app-customization/schema";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, Radio } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/app-studio-live-rooms")({ component: LiveRoomsStudioRoute });

type PageRow = { id: string; page_key: LiveRoomKind; name: string; route_pattern: string | null };

function LiveRoomsStudioRoute() {
  const [kind, setKind] = useState<LiveRoomKind>("voice-room");
  const [pages, setPages] = useState<PageRow[]>([]);
  const [config, setConfig] = useState<AppPageConfig>(normalizePageConfig(null, "voice-room"));
  const [roomId, setRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const page = useMemo(() => pages.find((item) => item.page_key === kind) ?? null, [pages, kind]);
  const realRoute = kind === "pk-battle" ? (roomId ? `/pk/${roomId}` : null) : (roomId ? `/room/${roomId}` : null);
  const previewUrl = realRoute ? `${realRoute}${realRoute.includes("?") ? "&" : "?"}studioPreview=1` : null;

  function sendStudioConfig() {
    iframeRef.current?.contentWindow?.postMessage({ type: "jalwa-live-studio-config", config, pageKey: kind }, "*");
  }

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase.from("app_customization_pages").select("id,page_key,name,route_pattern").in("page_key", ["voice-room", "video-room", "pk-battle"]);
      if (error) toast.error(error.message); else setPages((data ?? []) as PageRow[]);
      const { data: room } = await supabase.from("rooms").select("id").limit(1).maybeSingle();
      if (room?.id) setRoomId(room.id);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!page) return;
    void (async () => {
      const { data, error } = await supabase.from("app_customization_versions").select("config").eq("page_id", page.id).eq("status", "draft").order("version", { ascending: false }).limit(1).maybeSingle();
      if (error) toast.error(error.message);
      setConfig(normalizePageConfig(data?.config, kind));
    })();
  }, [page?.id, kind]);

  useEffect(() => { sendStudioConfig(); }, [config, kind, previewUrl]);

  async function saveDraft() {
    if (!page) return false;
    setSaving(true);
    const { data: existing, error: findError } = await supabase.from("app_customization_versions").select("id").eq("page_id", page.id).eq("status", "draft").order("version", { ascending: false }).limit(1).maybeSingle();
    if (findError) { toast.error(findError.message); setSaving(false); return false; }
    const result = existing?.id
      ? await supabase.from("app_customization_versions").update({ config }).eq("id", existing.id)
      : await supabase.from("app_customization_versions").insert({ page_id: page.id, version: 1, status: "draft", config });
    setSaving(false);
    if (result.error) { toast.error(result.error.message); return false; }
    toast.success(`${page.name} draft saved`);
    return true;
  }

  async function publish() {
    if (!page) return;
    const saved = await saveDraft();
    if (!saved) return;
    setSaving(true);
    const { data: latest, error: latestError } = await supabase.from("app_customization_versions").select("version").eq("page_id", page.id).order("version", { ascending: false }).limit(1).maybeSingle();
    if (latestError) { toast.error(latestError.message); setSaving(false); return; }
    const version = (latest?.version ?? 0) + 1;
    const { data: published, error: insertError } = await supabase.from("app_customization_versions").insert({ page_id: page.id, version, status: "published", config, published_at: new Date().toISOString() }).select("id").single();
    if (insertError || !published) { toast.error(insertError?.message ?? "Publish failed"); setSaving(false); return; }
    await supabase.from("app_customization_published").update({ is_current: false }).eq("page_id", page.id).eq("is_current", true);
    const { error } = await supabase.from("app_customization_published").insert({ page_id: page.id, version_id: published.id, config, version, published_at: new Date().toISOString(), is_current: true });
    setSaving(false);
    if (error) toast.error(error.message); else toast.success(`${page.name} is now live`);
  }

  if (loading) return <div className="grid min-h-[70vh] place-items-center text-sm text-muted-foreground">Loading Live Room Studio…</div>;

  return <div className="-m-4 min-h-[calc(100vh-64px)] bg-muted/20 md:-m-6 lg:-m-8">
    <AdminPageHeader title="App Studio → Live Rooms" subtitle="Design the existing Voice Room, Video Room and PK Battle presentation without replacing live functionality." right={previewUrl ? <button className="rounded-lg border bg-background px-3 py-2 text-sm" onClick={() => window.open(previewUrl, "_blank", "noopener,noreferrer")}><ExternalLink className="mr-1 inline h-4 w-4" />Open real room</button> : undefined} />
    <div className="border-b bg-background px-4 py-3"><div className="flex gap-2">{(["voice-room", "video-room", "pk-battle"] as LiveRoomKind[]).map((item) => <button key={item} onClick={() => setKind(item)} className={`rounded-lg px-4 py-2 text-sm ${kind === item ? "bg-primary text-primary-foreground" : "border hover:bg-muted"}`}><Radio className="mr-2 inline h-4 w-4" />{item === "voice-room" ? "Voice Room" : item === "video-room" ? "Video Room" : "PK Battle"}</button>)}</div></div>
    <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="rounded-xl border bg-background p-3"><div className="mb-2 flex items-center justify-between"><div><div className="text-xs font-semibold">REAL APPLICATION CANVAS</div><div className="text-[10px] text-muted-foreground">This is the existing room route. Draft Studio config is streamed into studioPreview mode.</div></div><span className="text-[10px] text-muted-foreground">{realRoute ?? "No room available"}</span></div>{previewUrl ? <iframe ref={iframeRef} title={`${kind} real application preview`} src={previewUrl} onLoad={sendStudioConfig} className="h-[760px] w-full rounded-xl border bg-black" /> : <div className="grid h-[760px] place-items-center rounded-xl border bg-muted/20 text-sm text-muted-foreground">No existing room record is available for preview.</div>}</section>
      <section className="rounded-xl border bg-background p-3"><LiveRoomStudioPanel pageKey={kind} config={config} onChange={setConfig} onSaveDraft={() => void saveDraft()} onPublish={() => void publish()} /></section>
    </div>
    {saving && <div className="fixed bottom-5 right-5 rounded-lg border bg-background px-3 py-2 text-xs shadow-lg">Saving…</div>}
  </div>;
}
