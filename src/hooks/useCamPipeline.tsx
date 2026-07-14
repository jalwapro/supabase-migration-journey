/**
 * CamPipelineProvider — global state for camera studio effects.
 * Replaces the old CSS-only CamFilter system.
 *
 * The provider holds the CONFIG plus the live CamProcessor. The processor is
 * created inside useZegoRoom's camera-toggle path because we need the raw
 * camera MediaStream first, but once created it stays active even when no
 * effect is selected so filter changes apply immediately while camera is on.
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
import { CamProcessor } from "@/lib/camPipeline/CamProcessor";

/**
 * Wait until the first video frame is available on the given MediaStream.
 * Resolves as soon as the track reports non-zero dimensions or after a short
 * timeout — keeps camera-on snappy while avoiding ZEGO's 1103061 error when
 * `createZegoStream` receives an empty canvas-capture track.
 */
async function waitForVideoFrames(stream: MediaStream, timeoutMs = 2500): Promise<void> {
  const track = stream.getVideoTracks()[0];
  if (!track) return;
  if (typeof document === "undefined") return;

  const probe = document.createElement("video");
  probe.muted = true;
  probe.playsInline = true;
  probe.autoplay = true;
  probe.srcObject = stream;
  void probe.play().catch(() => {});

  const start = performance.now();
  try {
    while (performance.now() - start < timeoutMs) {
      const s = track.getSettings?.();
      if (probe.readyState >= 2 && (probe.videoWidth > 0 || !!s?.width) && (probe.videoHeight > 0 || !!s?.height)) return;
      await new Promise((r) => setTimeout(r, 50));
    }
  } finally {
    try { probe.pause(); } catch { /* ignore */ }
    try { probe.srcObject = null; } catch { /* ignore */ }
  }
}

const LS_KEY = "cam-pipeline-cfg-v1";

const DEFAULT_CFG: CamPipelineConfig = {
  stickerId: "none",
  backgroundId: "none",
  customBgUrl: null,
  beautyOn: false,
  beautyIntensity: 0.5,
};

interface CamPipelineCtx {
  cfg: CamPipelineConfig;
  setSticker: (id: string) => void;
  setBackground: (id: string) => void;
  setCustomBg: (url: string | null) => void;
  setBeautyOn: (on: boolean) => void;
  setBeautyIntensity: (v: number) => void;
  /**
   * Called by the room's camera-toggle path to build/process a stream.
   * Returns either the raw stream (if bypass) or a canvas-processed one.
   * Keeps track of the processor so future config edits reach it live.
   */
  processStream: (raw: MediaStream) => Promise<MediaStream>;
  /** Tear down the internal processor when camera turns off. */
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
      return { ...DEFAULT_CFG, ...parsed, customBgUrl: null };
    } catch {
      return DEFAULT_CFG;
    }
  });

  const processorRef = useRef<CamProcessor | null>(null);
  const rawStreamRef = useRef<MediaStream | null>(null);

  // Persist config
  useEffect(() => {
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({
          stickerId: cfg.stickerId,
          backgroundId: cfg.backgroundId,
          beautyOn: cfg.beautyOn,
          beautyIntensity: cfg.beautyIntensity,
        }),
      );
    } catch { /* ignore */ }
  }, [cfg]);

  // Push config to live processor
  useEffect(() => {
    processorRef.current?.updateConfig(cfg);
  }, [cfg]);

  const setSticker = useCallback((id: string) => setCfg((p) => ({ ...p, stickerId: id })), []);
  const setBackground = useCallback((id: string) => setCfg((p) => ({ ...p, backgroundId: id, customBgUrl: null })), []);
  const setCustomBg = useCallback((url: string | null) => setCfg((p) => ({ ...p, customBgUrl: url })), []);
  const setBeautyOn = useCallback((on: boolean) => setCfg((p) => ({ ...p, beautyOn: on })), []);
  const setBeautyIntensity = useCallback((v: number) => setCfg((p) => ({ ...p, beautyIntensity: v })), []);

  const processStream = useCallback(async (raw: MediaStream) => {
    rawStreamRef.current = raw;
    processorRef.current?.stop();
    const proc = new CamProcessor(raw, cfg);
    processorRef.current = proc;
    const out = await proc.start();
    // Wait until the canvas capture stream is actually producing frames,
    // otherwise ZEGO sees an empty track and aborts publish with 1103061.
    await waitForVideoFrames(out);
    return out;
  }, [cfg]);

  const releaseProcessor = useCallback(() => {
    processorRef.current?.stop();
    processorRef.current = null;
    rawStreamRef.current = null;
  }, []);

  const value = useMemo<CamPipelineCtx>(
    () => ({
      cfg,
      setSticker,
      setBackground,
      setCustomBg,
      setBeautyOn,
      setBeautyIntensity,
      processStream,
      releaseProcessor,
    }),
    [cfg, setSticker, setBackground, setCustomBg, setBeautyOn, setBeautyIntensity, processStream, releaseProcessor],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCamPipeline(): CamPipelineCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCamPipeline outside provider");
  return v;
}
