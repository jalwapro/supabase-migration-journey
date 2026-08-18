import { useCallback, useMemo } from "react";
import type { AppPageConfig } from "@/lib/app-customization/schema";
import { LiveRoomLayersPanel } from "./LiveRoomLayersPanel";
import type { LiveRoomKind } from "@/lib/app-customization/live-room-registry";

export function LiveRoomLayersBridge({ kind, config, onChange, iframeRef }: { kind: LiveRoomKind; config: AppPageConfig; onChange: (config: AppPageConfig) => void; iframeRef: React.RefObject<HTMLIFrameElement | null> }) {
  const nodes = useMemo(() => config.sections.filter((n) => n.props?.roomType === kind), [config.sections, kind]);
  const hiddenIds = useMemo(() => new Set(nodes.filter((n) => n.visible === false).map((n) => String(n.id))), [nodes]);
  const lockedIds = useMemo(() => new Set(nodes.filter((n) => n.locked).map((n) => String(n.id))), [nodes]);

  const focus = useCallback((nodeId: string) => {
    const node = config.sections.find((n) => n.id === nodeId);
    if (!node) return;
    iframeRef.current?.contentWindow?.postMessage({
      type: "jalwa-live-focus",
      nodeId,
      componentId: String(node.props?.componentId ?? ""),
      instanceIndex: Number(node.props?.instanceIndex ?? 0),
      stableKey: `${String(node.props?.componentId ?? "")}:${Number(node.props?.instanceIndex ?? 0)}`,
      roomType: kind,
      roomState: String(node.props?.roomState ?? "normal"),
    }, "*");
  }, [config.sections, iframeRef, kind]);

  const patchNode = useCallback((nodeId: string, patch: { visible?: boolean; locked?: boolean }) => {
    const next = structuredClone(config);
    next.sections = next.sections.map((node) => node.id === nodeId ? { ...node, ...patch } : node);
    onChange(next);
    focus(nodeId);
  }, [config, onChange, focus]);

  return <LiveRoomLayersPanel
    kind={kind}
    hiddenIds={hiddenIds}
    lockedIds={lockedIds}
    onSelect={focus}
    onVisibilityChange={(id, visible) => patchNode(id, { visible })}
    onLockChange={(id, locked) => patchNode(id, { locked })}
  />;
}
