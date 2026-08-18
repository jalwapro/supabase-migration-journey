import type { ComponentStyle, DeviceKind } from "./schema";
import type { LiveVisualPatch } from "./live-room-visual";

export type VisualControlKind = "text" | "number" | "color" | "select" | "spacing" | "shadow" | "radius" | "gradient" | "animation";
export interface VisualControl { key: string; label: string; kind: VisualControlKind; options?: string[]; group: "layout"|"spacing"|"typography"|"appearance"|"border"|"effects"; responsive?: boolean; }

export const LIVE_ROOM_VISUAL_CONTROLS: VisualControl[] = [
  { key:"x", label:"X Position", kind:"number", group:"layout", responsive:true },
  { key:"y", label:"Y Position", kind:"number", group:"layout", responsive:true },
  { key:"width", label:"Width", kind:"text", group:"layout", responsive:true },
  { key:"height", label:"Height", kind:"text", group:"layout", responsive:true },
  { key:"zIndex", label:"Layer", kind:"number", group:"layout", responsive:true },
  { key:"padding", label:"Padding", kind:"spacing", group:"spacing", responsive:true },
  { key:"margin", label:"Margin", kind:"spacing", group:"spacing", responsive:true },
  { key:"gap", label:"Gap", kind:"number", group:"spacing", responsive:true },
  { key:"fontFamily", label:"Font", kind:"select", options:["Inter","Poppins","system-ui"], group:"typography", responsive:true },
  { key:"fontSize", label:"Font Size", kind:"number", group:"typography", responsive:true },
  { key:"fontWeight", label:"Weight", kind:"select", options:["400","500","600","700","800"], group:"typography", responsive:true },
  { key:"lineHeight", label:"Line Height", kind:"number", group:"typography", responsive:true },
  { key:"letterSpacing", label:"Letter Spacing", kind:"text", group:"typography", responsive:true },
  { key:"textAlign", label:"Alignment", kind:"select", options:["left","center","right"], group:"typography", responsive:true },
  { key:"color", label:"Text Color", kind:"color", group:"appearance", responsive:true },
  { key:"background", label:"Background", kind:"text", group:"appearance", responsive:true },
  { key:"opacity", label:"Opacity", kind:"number", group:"appearance", responsive:true },
  { key:"border", label:"Border", kind:"text", group:"border", responsive:true },
  { key:"borderRadius", label:"Radius", kind:"radius", group:"border", responsive:true },
  { key:"boxShadow", label:"Shadow", kind:"shadow", group:"effects", responsive:true },
  { key:"objectFit", label:"Object Fit", kind:"select", options:["cover","contain","fill","none","scale-down"], group:"effects", responsive:true },
];

export const VISUAL_GROUP_LABELS = { layout:"Layout", spacing:"Spacing", typography:"Typography", appearance:"Appearance", border:"Border", effects:"Effects" } as const;

export function coerceVisualValue(control: VisualControl, value: string): unknown {
  if (control.kind === "number") return value === "" ? "" : Number(value);
  return value;
}

export function visualPatch(key: string, value: unknown): LiveVisualPatch { return { [key]: value } as LiveVisualPatch; }

export function responsiveStyle(style: ComponentStyle, device: DeviceKind): ComponentStyle { return { ...style }; }
