import type { ComponentType } from "./schema";

export const STUDIO_COMPONENT_ATTR = "data-jalwa-component-id";
export const STUDIO_COMPONENT_TYPE_ATTR = "data-jalwa-component-type";

export type EditablePropertyGroup = "design" | "typography" | "layout" | "responsive" | "content" | "interaction";
export interface StudioComponentDefinition { type: ComponentType; label: string; category: "layout" | "content" | "controls" | "navigation" | "jalwa" | "overlay" | "media"; editable: EditablePropertyGroup[]; supportsChildren?: boolean; supportsBinding?: boolean; supportsInteraction?: boolean; }
const common = ["design", "layout", "responsive", "interaction"] as EditablePropertyGroup[];
const content = ["design", "layout", "responsive", "content", "interaction"] as EditablePropertyGroup[];
const definitions: StudioComponentDefinition[] = [
  ["container","Container","layout",true],["row","Row","layout",true],["column","Column","layout",true],["stack","Stack","layout",true],["grid","Grid","layout",true],
  ["text","Text","content",false],["heading","Heading","content",false],["paragraph","Paragraph","content",false],["image","Image","media",false],["icon","Icon","media",false],["avatar","Avatar","media",false],
  ["button","Button","controls",false],["icon-button","Icon Button","controls",false],["input","Input","controls",false],["search-box","Search Box","controls",false],["select","Select","controls",false],["checkbox","Checkbox","controls",false],["toggle","Toggle","controls",false],["slider","Slider","controls",false],
  ["card","Card","content","children"],["banner","Banner","content","children"],["list","List","content",true],["list-item","List Item","content",true],["tabs","Tabs","navigation",true],
  ["header","Header","navigation",true],["footer","Footer","navigation",true],["navigation","Navigation","navigation",true],["bottom-navigation","Bottom Navigation","navigation",true],
  ["live-room-card","Live Room Card","jalwa",false],["voice-room-card","Voice Room Card","jalwa",false],["video-room-card","Video Room Card","jalwa",false],["pk-battle-card","PK Battle Card","jalwa",false],["user-profile-card","User Profile Card","jalwa",false],["gift-card","Gift Card","jalwa",false],["gift-grid","Gift Grid","jalwa",false],["coin-balance","Coin Balance","jalwa",false],["diamond-balance","Diamond Balance","jalwa",false],["recharge-packages","Recharge Packages","jalwa",false],["ranking-list","Ranking List","jalwa",false],["leaderboard","Leaderboard","jalwa",false],["room-seat-layout","Room Seat Layout","jalwa",true],
  ["video-container","Video Container","media",false],["audio-container","Audio Container","media",false],["popup","Popup","overlay",true],["modal","Modal","overlay",true],["dialog","Dialog","overlay",true],["bottom-sheet","Bottom Sheet","overlay",true],["drawer","Drawer","overlay",true],["toast","Toast","overlay",true],["tooltip","Tooltip","overlay",true],["dropdown","Dropdown","overlay",true],["menu","Menu","overlay",true],["overlay","Overlay","overlay",true]
].map(([type,label,category,children])=>({type:type as ComponentType,label:String(label),category:category as StudioComponentDefinition["category"],editable:type==="text"||type==="heading"||type==="paragraph"?[...content,"typography"]:type==="image"||type==="icon"||type==="avatar"?[...content]:[...common],supportsChildren:children===true||children==="children",supportsBinding:["live-room-card","voice-room-card","video-room-card","pk-battle-card","user-profile-card","gift-card","gift-grid","coin-balance","diamond-balance","recharge-packages","ranking-list","leaderboard","room-seat-layout","list","list-item"].includes(type as ComponentType),supportsInteraction:["button","icon-button","follow-button","live-button","create-room-button","pk-battle-button","navigation","bottom-navigation","tabs","popup","modal","dialog","bottom-sheet","drawer","dropdown","menu"].includes(type as ComponentType)}));
export const STUDIO_COMPONENT_REGISTRY: Record<ComponentType, StudioComponentDefinition> = Object.fromEntries(definitions.map(d=>[d.type,d])) as Record<ComponentType,StudioComponentDefinition>;
export function getStudioComponentDefinition(type: ComponentType){return STUDIO_COMPONENT_REGISTRY[type];}
export function getStudioComponentsByCategory(category: StudioComponentDefinition["category"]){return definitions.filter(d=>d.category===category);}
export function studioRuntimeId(scope:string,key:string|number){return `${scope}:${String(key)}`.replace(/[^a-zA-Z0-9:_-]/g,"-");}
export function studioComponentProps(id:string,type?:ComponentType){return {[STUDIO_COMPONENT_ATTR]:id,...(type?{[STUDIO_COMPONENT_TYPE_ATTR]:type}:{})};}
export function markStudioComponent<T extends Element>(element:T,id:string,type?:ComponentType){element.setAttribute(STUDIO_COMPONENT_ATTR,id);if(type)element.setAttribute(STUDIO_COMPONENT_TYPE_ATTR,type);return element;}
export function studioSelector(id:string){return `[${STUDIO_COMPONENT_ATTR}="${id.replace(/"/g,'\\"')}"]`;}
