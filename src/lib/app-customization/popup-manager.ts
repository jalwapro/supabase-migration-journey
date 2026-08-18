export type PopupKind = "popup" | "modal" | "dialog" | "bottom-sheet" | "drawer";
export type PopupPlacement = "center" | "top" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right" | "custom";
export interface PopupConfig { id: string; name: string; kind: PopupKind; width?: string | number; height?: string | number; minWidth?: string | number; maxWidth?: string | number; minHeight?: string | number; maxHeight?: string | number; placement: PopupPlacement; x?: string | number; y?: string | number; radius?: string | number; overlay?: boolean; overlayOpacity?: number; blur?: number; closeOnOutside?: boolean; closeOnEscape?: boolean; showCloseButton?: boolean; autoCloseMs?: number; animation?: "fade" | "slide" | "zoom" | "bounce" | "scale"; animationDurationMs?: number; responsive?: Record<string, Partial<PopupConfig>>; }

export function normalizePopup(config: Partial<PopupConfig> & Pick<PopupConfig, "id" | "name" | "kind">): PopupConfig {
  return { placement: "center", overlay: true, overlayOpacity: 0.55, blur: 0, closeOnOutside: true, closeOnEscape: true, showCloseButton: true, animation: "fade", animationDurationMs: 180, ...config };
}

export function isBottomSheet(config: PopupConfig) { return config.kind === "bottom-sheet"; }
