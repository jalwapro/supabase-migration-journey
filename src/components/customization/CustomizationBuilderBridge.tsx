import { useEffect } from 'react';

type SelectedPayload = {
  selector: string;
  stableId: string;
  tag: string;
  text: string;
  rect: { x: number; y: number; width: number; height: number };
  styles: Record<string, string>;
  functionalLocked: boolean;
  editableProperties: string[];
};

const DESIGN_PROPERTIES = ['width','height','min-width','max-width','min-height','max-height','margin','margin-top','margin-right','margin-bottom','margin-left','padding','padding-top','padding-right','padding-bottom','padding-left','gap','color','background','background-color','border','border-width','border-style','border-color','border-radius','box-shadow','opacity','font-family','font-size','font-weight','line-height','letter-spacing','text-align','text-transform','display','position','top','right','bottom','left','z-index','transform','visibility','object-fit','object-position','flex','flex-grow','flex-shrink','flex-basis','align-items','justify-content','align-self','order','grid-template-columns','grid-template-rows','grid-area'];
const SAFE_STYLE_KEYS = new Set(DESIGN_PROPERTIES);

function selectorFor(el: Element) {
  const explicit = el.getAttribute('data-customization-id') || el.getAttribute('data-testid');
  if (explicit) return `[data-customization-id="${CSS.escape(explicit)}"], [data-testid="${CSS.escape(explicit)}"]`;
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node.nodeType === 1 && parts.length < 8) {
    let part = node.tagName.toLowerCase();
    if (node.id) part += `#${CSS.escape(node.id)}`;
    else { const classes = [...node.classList].filter((c) => !c.startsWith('group-hover')).slice(0, 2); if (classes.length) part += `.${classes.map(CSS.escape).join('.')}`; }
    parts.unshift(part); node = node.parentElement;
  }
  return parts.join(' > ');
}
function stableId(el: HTMLElement) { return el.getAttribute('data-customization-id') || el.getAttribute('data-testid') || el.getAttribute('aria-label') || el.id || selectorFor(el); }
function isFunctionalElement(el: HTMLElement) { return !!el.closest('button,a,[role="button"],input,textarea,select,form,[data-functional],[data-action],[data-route]') || ['BUTTON','A','INPUT','TEXTAREA','SELECT','FORM'].includes(el.tagName); }
function describe(el: HTMLElement): SelectedPayload {
  const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
  return { selector: selectorFor(el), stableId: stableId(el), tag: el.tagName.toLowerCase(), text: el.children.length === 0 && !['INPUT','TEXTAREA','SELECT'].includes(el.tagName) ? (el.textContent ?? '').trim().slice(0, 500) : '', rect: { x:r.x,y:r.y,width:r.width,height:r.height }, styles: { color:cs.color,background:cs.background,backgroundColor:cs.backgroundColor,fontFamily:cs.fontFamily,fontSize:cs.fontSize,fontWeight:cs.fontWeight,lineHeight:cs.lineHeight,letterSpacing:cs.letterSpacing,textAlign:cs.textAlign,border:cs.border,borderRadius:cs.borderRadius,boxShadow:cs.boxShadow,padding:cs.padding,margin:cs.margin,opacity:cs.opacity,width:cs.width,height:cs.height,minWidth:cs.minWidth,maxWidth:cs.maxWidth,position:cs.position,top:cs.top,right:cs.right,bottom:cs.bottom,left:cs.left,transform:cs.transform,display:cs.display,gap:cs.gap,alignItems:cs.alignItems,justifyContent:cs.justifyContent,order:cs.order }, functionalLocked: isFunctionalElement(el), editableProperties: DESIGN_PROPERTIES };
}
function validStyle(property: string) { return SAFE_STYLE_KEYS.has(property.toLowerCase()); }

export function CustomizationBuilderBridge() {
  useEffect(() => {
    if (typeof window === 'undefined' || window.self === window.top || new URLSearchParams(window.location.search).get('adminPreview') !== '1') return;
    const outline = document.createElement('div'), label = document.createElement('div');
    const handles = ['nw','ne','sw','se'].map((position) => { const h=document.createElement('div'); h.dataset.handle=position; return h; });
    Object.assign(outline.style,{position:'fixed',pointerEvents:'none',zIndex:'2147483647',border:'2px solid #a855f7',background:'rgba(168,85,247,.08)',display:'none',boxSizing:'border-box'});
    Object.assign(label.style,{position:'fixed',pointerEvents:'none',zIndex:'2147483647',display:'none',background:'#a855f7',color:'white',font:'600 10px system-ui',padding:'3px 6px',borderRadius:'4px',whiteSpace:'nowrap'});
    handles.forEach((h)=>Object.assign(h.style,{position:'fixed',width:'10px',height:'10px',border:'2px solid white',background:'#a855f7',zIndex:'2147483647',display:'none',pointerEvents:'none',boxSizing:'border-box',borderRadius:'2px'}));
    document.body.append(outline,label,...handles);
    let drag:{el:HTMLElement;startX:number;startY:number;startWidth:number;startHeight:number;mode:'move'|'resize'}|null=null;
    const show=(el:HTMLElement)=>{const r=el.getBoundingClientRect();Object.assign(outline.style,{display:'block',left:`${r.left}px`,top:`${r.top}px`,width:`${r.width}px`,height:`${r.height}px`});Object.assign(label.style,{display:'block',left:`${r.left}px`,top:`${Math.max(2,r.top-20)}px`});label.textContent=`${stableId(el)} · ${Math.round(r.width)}×${Math.round(r.height)}`;const points:Record<string,[number,number]>={nw:[r.left-5,r.top-5],ne:[r.right-5,r.top-5],sw:[r.left-5,r.bottom-5],se:[r.right-5,r.bottom-5]};handles.forEach((h)=>{const p=points[h.dataset.handle!];Object.assign(h.style,{display:'block',left:`${p[0]}px`,top:`${p[1]}px`});});};
    const ignored=(t:HTMLElement|null)=>!t||t===outline||t===label||handles.includes(t)||!!t.closest('[data-customization-ignore]');
    const hover=(e:MouseEvent)=>{if(drag)return;const t=e.target as HTMLElement|null;if(ignored(t))return;show(t!);};
    const down=(e:MouseEvent)=>{const t=e.target as HTMLElement|null;if(e.button!==0||ignored(t))return;const r=t!.getBoundingClientRect();const resize=Math.abs(e.clientX-r.right)<=14&&Math.abs(e.clientY-r.bottom)<=14;drag={el:t!,startX:e.clientX,startY:e.clientY,startWidth:r.width,startHeight:r.height,mode:resize?'resize':'move'};window.parent.postMessage({type:'jalwa:customization:selected',payload:describe(t!)},'*');e.preventDefault();e.stopPropagation();};
    const move=(e:MouseEvent)=>{if(!drag)return;const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY,el=drag.el;if(drag.mode==='resize'){el.style.width=`${Math.max(24,drag.startWidth+dx)}px`;el.style.height=`${Math.max(24,drag.startHeight+dy)}px`;}else{const base=el.dataset.customizationDragBase||'';el.dataset.customizationDragBase=base;el.style.transform=`${base} translate(${dx}px, ${dy}px)`.trim();}show(el);};
    const up=()=>{if(!drag)return;window.parent.postMessage({type:'jalwa:customization:layoutChanged',payload:describe(drag.el)},'*');drag=null;};
    const click=(e:MouseEvent)=>{if(drag)return;const t=e.target as HTMLElement|null;if(ignored(t))return;e.preventDefault();e.stopPropagation();window.parent.postMessage({type:'jalwa:customization:selected',payload:describe(t!)},'*');};
    const apply=(d:{selector:string;styles?:Record<string,unknown>;text?:string;visible?:boolean})=>{try{document.querySelectorAll(d.selector).forEach((n)=>{const el=n as HTMLElement;Object.entries(d.styles??{}).forEach(([k,v])=>{if(typeof v==='string'&&validStyle(k))el.style.setProperty(k,v);});if(typeof d.text==='string'&&el.children.length===0&&!['INPUT','TEXTAREA','SELECT'].includes(el.tagName))el.textContent=d.text;if(typeof d.visible==='boolean')el.style.setProperty('display',d.visible?'':'none');});}catch{}};
    const msg=(e:MessageEvent)=>{if(e.source!==window.parent)return;const d=e.data;if(d?.type==='jalwa:customization:apply-batch'&&Array.isArray(d.rules))d.rules.forEach(apply);else if(d?.type==='jalwa:customization:apply'&&d.selector)apply(d);};
    document.addEventListener('mousemove',hover,true);document.addEventListener('mousedown',down,true);document.addEventListener('mousemove',move,true);document.addEventListener('mouseup',up,true);document.addEventListener('click',click,true);window.addEventListener('message',msg);
    return()=>{document.removeEventListener('mousemove',hover,true);document.removeEventListener('mousedown',down,true);document.removeEventListener('mousemove',move,true);document.removeEventListener('mouseup',up,true);document.removeEventListener('click',click,true);window.removeEventListener('message',msg);outline.remove();label.remove();handles.forEach((h)=>h.remove());};
  },[]);
  return null;
}
