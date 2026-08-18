export type CSSLength = number | `${number}px` | `${number}%` | `${number}vw` | `${number}vh` | `${number}rem` | `${number}em` | "auto";
export type PositionMode = "absolute" | "relative" | "fixed" | "sticky" | "flex" | "grid";
export type Breakpoint = "mobile" | "tablet" | "desktop";

export interface BoxSpacing { top: number; right: number; bottom: number; left: number; linked?: boolean; }
export interface SizeConfig { width: CSSLength; height: CSSLength; minWidth?: CSSLength; maxWidth?: CSSLength; minHeight?: CSSLength; maxHeight?: CSSLength; }
export interface PositionConfig { mode: PositionMode; x?: number; y?: number; top?: number; right?: number; bottom?: number; left?: number; zIndex?: number; }
export interface TypographyConfig { fontFamily?: string; fontSize?: CSSLength; fontWeight?: number | string; fontStyle?: "normal" | "italic"; lineHeight?: number | string; letterSpacing?: CSSLength; textAlign?: "left" | "center" | "right" | "justify"; color?: string; opacity?: number; textTransform?: "none" | "uppercase" | "lowercase" | "capitalize"; textDecoration?: "none" | "underline" | "line-through"; textShadow?: string; }
export interface BorderConfig { width?: number; style?: "solid" | "dashed" | "dotted" | "none"; color?: string; radius?: number | string; radiusTopLeft?: number; radiusTopRight?: number; radiusBottomRight?: number; radiusBottomLeft?: number; }
export interface ShadowConfig { x: number; y: number; blur: number; spread?: number; color: string; opacity?: number; }
export interface BackgroundConfig { color?: string; gradient?: string; imageUrl?: string; opacity?: number; blur?: number; objectFit?: "cover" | "contain" | "fill"; objectPosition?: string; }
export interface ResponsiveOverride { visible?: boolean; position?: Partial<PositionConfig>; size?: Partial<SizeConfig>; spacing?: Partial<Pick<ComponentStyle, "margin" | "padding" | "gap">>; typography?: Partial<TypographyConfig>; }
export interface InteractionConfig { actionType?: "existing" | "navigate" | "popup" | "url" | "none"; target?: string; preserveExisting?: boolean; }
export interface ComponentStyle { position: PositionConfig; size: SizeConfig; margin: BoxSpacing; padding: BoxSpacing; gap: number; typography: TypographyConfig; border: BorderConfig; background: BackgroundConfig; shadows: ShadowConfig[]; opacity: number; rotation: number; }
export interface ComponentContent { text?: string; imageUrl?: string; icon?: string; }
export interface ComponentPropertyConfig { id: string; type: string; parentId?: string; content: ComponentContent; style: ComponentStyle; responsive: Record<Breakpoint, ResponsiveOverride>; visibility: boolean; locked: boolean; interaction: InteractionConfig; dataBinding?: string; children: string[]; }

export const DEFAULT_COMPONENT_STYLE: ComponentStyle = {
  position: { mode: "relative", zIndex: 0 },
  size: { width: "auto", height: "auto" },
  margin: { top: 0, right: 0, bottom: 0, left: 0, linked: true },
  padding: { top: 0, right: 0, bottom: 0, left: 0, linked: true },
  gap: 0,
  typography: {},
  border: { width: 0, style: "none", radius: 0 },
  background: {},
  shadows: [],
  opacity: 1,
  rotation: 0,
};

export function createDefaultComponentProperty(id: string, type: string, parentId?: string): ComponentPropertyConfig {
  return { id, type, parentId, content: {}, style: structuredClone(DEFAULT_COMPONENT_STYLE), responsive: { mobile: {}, tablet: {}, desktop: {} }, visibility: true, locked: false, interaction: { actionType: "existing", preserveExisting: true }, children: [] };
}
