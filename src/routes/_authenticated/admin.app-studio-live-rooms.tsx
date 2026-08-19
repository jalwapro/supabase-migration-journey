import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { LiveRoomStudioPanel, type LiveRoomKind } from "@/components/studio/LiveRoomStudioPanel";
import { LiveRoomLayersBridge } from "@/components/studio/LiveRoomLayersBridge";
import { normalizePageConfig, type AppPageConfig } from "@/lib/app-customization/schema";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, Radio } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/app-studio-live-rooms")({ component: LiveRoomsStudioRoute });

type PageRow = { id: string; page_key: LiveRoomKind; name: string; route_pattern: string | null };
type RoomRow = { id: string; room_type: "voice" | "video" | null; status: string | null };

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
  const previewUrl = realRoute ? `${realRoute}?studioPreview=1&studioState=normal` : null;

  function sendStudioConfig() {
    iframeRef.current?.contentWindow?.postMessage(
      { type: "jalwa-live-studio-config", config, pageKey: kind, state: "normal", roomId },
      window.location.origin,
    );
  }

  useEffect(() => { void (async () => {
    setLoading(true);
    const { data, error } = await supabase.from("app_customization_pages").select("id,page_key,name,route_pattern").in("page_key", ["voice-room", "video-room", "pk-battle"]);
    if (error) toast.error(error.message); else setPages((data ?? []) as PageRow[]);
    const preferredType = kind === "video-room" ? "video" : "voice";
    const active = await supabase.from("live_rooms").select("id,room_type,status").eq("room_type", preferredType).eq("status", "live").order("created_at", { ascending: false }).limit(1).maybeSingle();
    let room = active.data as RoomRow | null;
    if (!room) { const fallback = await supabase.from("live_rooms").select("id,room_type,status").eq("room_type", preferredType).order("created_at", { ascending: false }).limit(1).maybeSingle(); room = (fallback.data as RoomRow | null) ?? null; }
    setRoomId(room?.id ?? null);
    setLoading(false);
  })(); }, [kind]);

  useEffect(() => { if (!page) return; void (async () => { const { data, error } = await supabase.from("app_customization_versions").select("config").eq("page_id", page.id).eq("status", "draft").order("version", { ascending: false }).limit(1).maybeSingle(); if (error) toast.error(error.message); setConfig(normalizePageConfig(data?.config, kind)); })(); }, [page?.id, kind]);
  useEffect(() => { sendStudioConfig(); }, [config, kind, previewUrl, roomId]);

  async function saveDraft() { if (!page) return false; setSaving(true); const { data: existing, error: findError } = await supabase.from("app_customization_versions").select("id").eq("page_id", page.id).eq("status", "draft").order("version", { ascending: false }).limit(1).maybeSingle(); if (findError) { toast.error(findError.message); setSaving(false); return false; } const result = existing?.id ? await supabase.from("app_customization_versions").update({ config }).eq("id", existing.id) : await supabase.from("app_customization_versions").insert({ page_id: page.id, version: 1, status: "draft", config }); setSaving(false); if (result.error) { toast.error(result.error.message); return false; } toast.success(`${page.name} draft saved`); return true; }
  async function publish() { if (!page) return; const saved = await saveDraft(); if (!saved) return; setSaving(true); const { data: latest, error: latestError } = await supabase.from("app_customization_versions").select("version").eq("page_id", page.id).order("version", { ascending: false }).limit(1).maybeSingle(); if (latestError) { toast.error(latestError.message); setSaving(false); return; } const version = (latest?.version ?? 0) + 1; const { data: published, error: insertError } = await supabase.from("app_customization_versions").insert({ page_id: page.id, version, status: "published", config, published_at: new Date().toISOString() }).select("id").single(); if (insertError || !published) { toast.error(insertError?.message ?? "Publish failed"); setSaving(false); return; } await supabase.from("app_customization_published").update({ is_current: false }).eq("page_id", page.id).eq("is_current", true); const { error } = await supabase.from("app_customization_published").insert({ page_id: page.id, version_id: published.id, config, version, published_at: new Date().toISOString(), is_current: true }); setSaving(false); if (error) toast.error(error.message); else toast.success(`${page.name} is now live`); }

  if (loading) return <div className="grid min-h-[70vh] place-items-center text-sm text-muted-foreground">Loading Live Room Studio…</div>;
  return <div className="-m-4 min-h-[calc(100vh-64px)] bg-muted/20 md:-m-6 lg:-m-8">
    <AdminPageHeader title="App Studio → Live Rooms" subtitle="Design the existing Voice Room, Video Room and PK Battle presentation without replacing live functionality." right={previewUrl ? <button className="rounded-lg border bg-background px-3 py-2 text-sm" onClick={() => window.open(previewUrl, "_blank", "noopener,noreferrer")}><ExternalLink className="mr-1 inline h-4 w-4" />Open real room</button> : undefined} />
    <div className="border-b bg-background px-4 py-3"><div className="flex gap-2">{(["voice-room", "video-room", "pk-battle"] as LiveRoomKind[]).map((item) => <button key={item} onClick={() => setKind(item)} className={`rounded-lg px-4 py-2 text-sm ${kind === item ? "bg-primary text-primary-foreground" : "border hover:bg-muted"}`}><Radio className="mr-2 inline h-4 w-4" />{item === "voice-room" ? "Voice Room" : item === "video-room" ? "Video Room" : "PK Battle"}</button>)}</div></div>
    <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="rounded-xl border bg-background p-3"><div className="mb-2 flex items-center justify-between"><div><div className="text-xs font-semibold">REAL APPLICATION CANVAS</div><div className="text-[10px] text-muted-foreground">Actual roomId preview — the existing production room route and real user/runtime data are preserved.</div></div><span className="text-[10px] text-muted-foreground">{roomId ? `roomId: ${roomId}` : "No room available"}</span></div>
        <div className="flex min-h-[820px] items-start justify-center overflow-auto rounded-xl bg-muted/40 p-6">
          <div className="relative h-[780px] w-[390px] max-w-full shrink-0 rounded-[42px] border-[10px] border-foreground/90 bg-black p-[2px] shadow-2xl">
            <div className="pointer-events-none absolute left-1/2 top-0 z-20 h-6 w-32 -translate-x-1/2 rounded-b-2xl bg-foreground/90" />
            <div className="h-full w-full overflow-hidden rounded-[30px] bg-black">
              {previewUrl ? <iframe ref={iframeRef} title={`${kind} actual roomId mobile preview`} src={previewUrl} onLoad={sendStudioConfig} className="block h-full w-full border-0 bg-black" /> : <div className="grid h-full place-items-center px-8 text-center text-sm text-muted-foreground">No existing room record is available for preview. Create a room once, then return here.</div>}
            </div>
          </div>
        </div>
      </section>
      <section className="space-y-4 rounded-xl border bg-background p-3"><LiveRoomLayersBridge kind={kind} config={config} onChange={setConfig} iframeRef={iframeRef} /><LiveRoomStudioPanel pageKey={kind} config={config} onChange={setConfig} onSaveDraft={() => void saveDraft()} onPublish={() => void publish()} /></section>
    </div>
    {saving && <div className="fixed bottom-5 right-5 rounded-lg border bg-background px-3 py-2 text-xs shadow-lg">Saving…</div>}
  </div>;
}
