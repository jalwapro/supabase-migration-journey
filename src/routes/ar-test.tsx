import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AR_OVERLAYS, preloadOverlay, drawOverlay, type AROverlayDef } from "@/lib/camPipeline/arOverlays";
import { detectStatic } from "@/lib/camPipeline/faceTracker";

export const Route = createFileRoute("/ar-test")({
  head: () => ({ meta: [{ title: "AR Overlay Test Harness" }, { name: "robots", content: "noindex" }] }),
  component: ArTestPage,
});

const FACES = [
  { id: "front",      label: "Front",      src: "/ar-test/face-front.jpg" },
  { id: "tilt-left",  label: "Head Tilt",  src: "/ar-test/face-tilt-left.jpg" },
  { id: "turn-right", label: "3/4 Turn",   src: "/ar-test/face-turn-right.jpg" },
];

const OVERLAY_IDS = Object.keys(AR_OVERLAYS);

interface Cell { face: string; overlay: string; status: "ok" | "no-face" | "err"; msg?: string }

function ArTestPage() {
  const [status, setStatus] = useState("initializing…");
  const [cells, setCells] = useState<Cell[]>([]);
  const canvasRefs = useRef<Map<string, HTMLCanvasElement | null>>(new Map());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus("loading MediaPipe model…");
      try {
        // preload all overlay bitmaps in parallel
        const bmps = await Promise.all(
          OVERLAY_IDS.map((id) => preloadOverlay(AR_OVERLAYS[id].src).then((b) => [id, b] as const)),
        );
        const bmpMap = new Map(bmps);

        const results: Cell[] = [];
        for (const face of FACES) {
          setStatus(`detecting face: ${face.label}…`);
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = face.src;
          await img.decode();

          let pose = null;
          try {
            pose = await detectStatic(img);
          } catch (e) {
            for (const oid of OVERLAY_IDS) {
              results.push({ face: face.id, overlay: oid, status: "err", msg: String(e) });
            }
            continue;
          }
          if (!pose) {
            for (const oid of OVERLAY_IDS) {
              results.push({ face: face.id, overlay: oid, status: "no-face" });
            }
            continue;
          }

          for (const oid of OVERLAY_IDS) {
            const key = `${face.id}__${oid}`;
            const canvas = canvasRefs.current.get(key);
            if (!canvas) { results.push({ face: face.id, overlay: oid, status: "err", msg: "no canvas" }); continue; }
            const ctx = canvas.getContext("2d");
            if (!ctx) { results.push({ face: face.id, overlay: oid, status: "err", msg: "no ctx" }); continue; }
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const bmp = bmpMap.get(oid);
            if (bmp) drawOverlay(ctx, bmp, AR_OVERLAYS[oid] as AROverlayDef, pose, canvas.width, canvas.height, false);
            results.push({ face: face.id, overlay: oid, status: "ok" });
          }
        }
        if (!cancelled) { setCells(results); setStatus("done"); }
      } catch (e) {
        if (!cancelled) setStatus(`error: ${String(e)}`);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ padding: 12, background: "#111", color: "#eee", minHeight: "100vh", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 16, margin: "0 0 8px" }}>AR Overlay Test Harness</h1>
      <div data-testid="ar-status" style={{ fontSize: 12, marginBottom: 12 }}>{status}</div>
      {FACES.map((face) => (
        <section key={face.id} style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 13, margin: "8px 0" }}>{face.label}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
            {OVERLAY_IDS.map((oid) => {
              const key = `${face.id}__${oid}`;
              const cell = cells.find((c) => c.face === face.id && c.overlay === oid);
              return (
                <div key={key} data-testid={`cell-${key}`} style={{ background: "#000", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ fontSize: 10, padding: "2px 4px", background: cell?.status === "ok" ? "#164" : cell?.status === "no-face" ? "#640" : "#600" }}>
                    {AR_OVERLAYS[oid].id} · {cell?.status ?? "…"}
                  </div>
                  <canvas
                    ref={(el) => { canvasRefs.current.set(key, el); }}
                    style={{ width: "100%", height: "auto", display: "block" }}
                  />
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
