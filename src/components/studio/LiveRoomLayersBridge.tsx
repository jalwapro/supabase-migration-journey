import { useCallback, useMemo } from "react";
import type { AppPageConfig } from "@/lib/app-customization/schema";
import { LiveRoomLayersPanel } from "./LiveRoomLayersPanel";
import type { LiveRoomKind } from "@/lib/app-customization/live-room-registry";

export function LiveRoomLayersBridge({ kind, config, onChange, iframeRef }: { kind: LiveRoomKind; config: AppPageConfig; onChange: (config: AppPageConfig) => void; iframeRef: React.RefObject<HTMLIFrameElement | null> }) {
  const nodes = useMemo(() => config.sections.filter((n) => n.props?.roomType === kind), [config.sections, kind]);
  const hiddenIds = useMemo(() => new Set(nodes.filter((n) => n.visible === false).map((n) => String(n.props?.componentId))), [nodes]);
  const lockedIds = useMemo(() => new Set(nodes.filter((n) => n.locked).map((n) => String(n.props?.componentId))), [nodes]);

  const focus = useCallback((componentId: string) => {
    iframeRef.current?.contentWindow?.postMessage({ type: "jalwa-live-focus", componentId }, "*");
  }, [iframeRef]);

  const patchComponent = useCallback((componentId: string, patch: { visible?: boolean; locked?: boolean }) => {
    const next = structuredClone(config);
    next.sections = next.sections.map((node) => node.props?.roomType === kind && node.props?.componentId === componentId ? { ...node, ...patch } : node);
    onChange(next);
    focus(componentId);
  }, [config, kind, onChange, focus]);

  return <LiveRoomLayersPanel kind={kind} hiddenIds={hiddenIds} lockedIds={lockedIds} onSelect={focus} onVisibilityChange={(id, visible) => patchComponent(id, { visible })} onLockChange={(id, locked) => patchComponent(id, { locked })} />;
}
