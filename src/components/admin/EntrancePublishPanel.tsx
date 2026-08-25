import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, UploadCloud, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { publishEntranceRender } from "@/lib/entrancePublisher";

export type EntrancePublishItem = {
  id: string;
  name: string;
  mediaUrl: string | null;
  mediaType?: string | null;
  durationMs?: number | null;
  renderConfig: unknown;
  publishedRenderUrl?: string | null;
};

export default function EntrancePublishPanel({ items }: { items: EntrancePublishItem[] }) {
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? "");
  const [publishing, setPublishing] = useState(false);
  const selected = items.find((x) => x.id === selectedId) ?? null;

  const publish = async () => {
    if (!selected?.mediaUrl) return toast.error("This entrance has no source video.");
    setPublishing(true);
    try {
      const result = await publishEntranceRender({
        id: selected.id,
        mediaUrl: selected.mediaUrl,
        mediaType: selected.mediaType,
        durationMs: selected.durationMs,
        renderConfig: selected.renderConfig,
      });
      toast.success(`Published ${selected.name} (${(result.bytes / 1048576).toFixed(1)} MB)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Entrance render failed");
    } finally {
      setPublishing(false);
    }
  };

  if (!items.length) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Publish Entrance Render</h3>
          <p className="text-xs text-muted-foreground">Render the current Studio config into a permanent R2 video.</p>
        </div>
        {selected?.publishedRenderUrl && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-500"><CheckCircle2 className="h-4 w-4" /> Published</span>
        )}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-sm"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={publishing}
        >
          {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <Button onClick={publish} disabled={publishing || !selected?.mediaUrl}>
          {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
          {publishing ? "Rendering…" : "Publish Render"}
        </Button>
      </div>
      {selected?.publishedRenderUrl && (
        <p className="mt-2 truncate text-[11px] text-muted-foreground">Permanent: {selected.publishedRenderUrl}</p>
      )}
    </div>
  );
}
