/**
 * CamPipelineProvider — global state for camera studio filters + beauty.
 * Uses a canvas-2D `ctx.filter` pipeline (no MediaPipe, no ML models).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CamPipelineConfig } from "@/lib/camPipeline/CamProcessor";
import { CamProcessor, isBypass } from "@/lib/camPipeline/CamProcessor";

async function waitForVideoFrames(stream: MediaStream, timeoutMs = 2000): Promise<void> {
  const track = stream.getVideoTracks()[0];
  if (!track || typeof document === "undefined") return;
  const probe = document.createElement("video");
  probe.muted = true;
  probe.playsInline = true;
  probe.autoplay = true;
  probe.srcObject = stream;
  void probe.play().catch(() => {});
  const start = performance.now();
  try {
    while (performance.now() - start < timeoutMs) {
      if (probe.readyState >= 2 && probe.videoWidth > 0 && probe.videoHeight > 0) return;
      await new Promise((r) => setTimeout(r, 50));
    }
  } finally {
    try { probe.pause(); } catch { /* ignore */ }
    try { probe.srcObject = null; } catch { /* ignore */ }
  }
}

const LS_KEY = "cam-pipeline-cfg-v2";

const DEFAULT_CFG: CamPipelineConfig = {
  filterId: "none",
  beautyOn: false,
  beautyIntensity: 0.5,
};

interface CamPipelineCtx {
  cfg: CamPipelineConfig;
  setFilter: (id: string) => void;
  setBeautyOn: (on: boolean) => void;
  setBeautyIntensity: (v: number) => void;
  processStream: (raw: MediaStream) => Promise<MediaStream>;
  releaseProcessor: () => void;
}

const Ctx = createContext<CamPipelineCtx | null>(null);

export function CamPipelineProvider({ children }: { children: ReactNode }) {
  const [cfg, setCfg] = useState<CamPipelineConfig>(() => {
    if (typeof window === "undefined") return DEFAULT_CFG;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return DEFAULT_CFG;
      const parsed = JSON.parse(raw) as Partial<CamPipelineConfig>;
      return { ...DEFAULT_CFG, ...parsed };
    } catch {
      return DEFAULT_CFG;
    }
  });

  const processorRef = useRef<CamProcessor | null>(null);
  const rawStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(cfg)); } catch { /* ignore */ }
  }, [cfg]);

  useEffect(() => {
    processorRef.current?.updateConfig(cfg);
  }, [cfg]);

  const setFilter = useCallback((id: string) => setCfg((p) => ({ ...p, filterId: id })), []);
  const setBeautyOn = useCallback((on: boolean) => setCfg((p) => ({ ...p, beautyOn: on })), []);
  const setBeautyIntensity = useCallback((v: number) => setCfg((p) => ({ ...p, beautyIntensity: v })), []);

  const processStream = useCallback(async (raw: MediaStream) => {
    rawStreamRef.current = raw;
    // Bypass — no filter, no beauty. Publish raw stream for max quality.
    if (isBypass(cfg)) {
      processorRef.current?.stop();
      processorRef.current = null;
      return raw;
    }
    // (Re)build processor on top of the fresh raw stream.
    processorRef.current?.stop();
    const proc = new CamProcessor(raw, cfg);
    processorRef.current = proc;
    const out = await proc.start();
    await waitForVideoFrames(out).catch(() => {});
    return out;
  }, [cfg]);

  const releaseProcessor = useCallback(() => {
    processorRef.current?.stop();
    processorRef.current = null;
    rawStreamRef.current = null;
  }, []);

  const value = useMemo<CamPipelineCtx>(
    () => ({ cfg, setFilter, setBeautyOn, setBeautyIntensity, processStream, releaseProcessor }),
    [cfg, setFilter, setBeautyOn, setBeautyIntensity, processStream, releaseProcessor],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCamPipeline(): CamPipelineCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCamPipeline outside provider");
  return v;
}
