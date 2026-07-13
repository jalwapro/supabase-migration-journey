/**
 * CamPipelineProvider — global state for camera studio effects.
 * Replaces the old CSS-only CamFilter system.
 *
 * The provider only holds the CONFIG. The actual CamProcessor is instantiated
 * inside useZegoRoom's toggleVideo path when the user turns camera on,
 * because we need the raw camera MediaStream first (obtained via
 * navigator.mediaDevices.getUserMedia before publishing).
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
    if (isBypass(cfg)) {
      // teardown any old processor
      processorRef.current?.stop();
      processorRef.current = null;
      return raw;
    }
    const proc = new CamProcessor(raw, cfg);
    processorRef.current = proc;
    const out = await proc.start();
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
