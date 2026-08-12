import { useEffect } from 'react';

function selectorFor(el: Element) {
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node.nodeType === 1 && parts.length < 8) {
    let part = node.tagName.toLowerCase();
    if (node.id) part += `#${CSS.escape(node.id)}`;
    else {
      const classes = [...node.classList].filter((c) => !c.startsWith('group-hover')).slice(0, 2);
      if (classes.length) part += `.${classes.map(CSS.escape).join('.')}`;
    }
    parts.unshift(part);
    node = node.parentElement;
  }
  return parts.join(' > ');
}

export function CustomizationBuilderBridge() {
  useEffect(() => {
    if (typeof window === 'undefined' || window.self === window.top) return;
    if (new URLSearchParams(window.location.search).get('adminPreview') !== '1') return;

    const outline = document.createElement('div');
    Object.assign(outline.style, { position: 'fixed', pointerEvents: 'none', zIndex: '2147483647', border: '2px solid #a855f7', background: 'rgba(168,85,247,.08)', display: 'none' });
    document.body.appendChild(outline);
    let drag: { el: HTMLElement; startX:number; startY:number; startLeft:number; startTop:number; startWidth:number; startHeight:number; mode:'move'|'resize' } | null = null;

    const describe = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return { selector: selectorFor(el), tag: el.tagName.toLowerCase(), text: (el.children.length === 0 ? el.textContent : '').trim().slice(0, 500), rect: { x: r.x, y: r.y, width: r.width, height: r.height }, styles: { color: cs.color, backgroundColor: cs.backgroundColor, fontSize: cs.fontSize, fontWeight: cs.fontWeight, borderRadius: cs.borderRadius, padding: cs.padding, margin: cs.margin, opacity: cs.opacity, width: cs.width, height: cs.height, position: cs.position, top: cs.top, right: cs.right, bottom: cs.bottom, left: cs.left, transform: cs.transform, display: cs.display, gap: cs.gap } };
    };
    const showOutline = (el: HTMLElement) => { const r = el.getBoundingClientRect(); Object.assign(outline.style, { display:'block', left:`${r.left}px`, top:`${r.top}px`, width:`${r.width}px`, height:`${r.height}px` }); };
    const move = (e: MouseEvent) => { if (drag) return; const target=e.target as HTMLElement|null; if(!target||target===outline||target.closest('[data-customization-ignore]'))return; showOutline(target); };
    const click = (e: MouseEvent) => { if(drag)return; const target=e.target as HTMLElement|null; if(!target||target===outline||target.closest('[data-customization-ignore]'))return; e.preventDefault(); e.stopPropagation(); window.parent.postMessage({type:'jalwa:customization:selected',payload:describe(target)},'*'); };
    const down = (e: MouseEvent) => { const target=e.target as HTMLElement|null; if(!target||target===outline||target.closest('[data-customization-ignore]'))return; if(e.button!==0)return; const r=target.getBoundingClientRect(); const edge=12; const resize=e.clientX>=r.right-edge&&e.clientY>=r.bottom-edge; drag={el:target,startX:e.clientX,startY:e.clientY,startLeft:r.left,startTop:r.top,startWidth:r.width,startHeight:r.height,mode:resize?'resize':'move'}; e.preventDefault(); e.stopPropagation(); window.parent.postMessage({type:'jalwa:customization:selected',payload:describe(target)},'*'); };
    const dragMove = (e: MouseEvent) => { if(!drag)return; const dx=e.clientX-drag.startX, dy=e.clientY-drag.startY; const el=drag.el; const cs=getComputedStyle(el); if(drag.mode==='resize'){el.style.width=`${Math.max(24,drag.startWidth+dx)}px`;el.style.height=`${Math.max(24,drag.startHeight+dy)}px`;}else{if(cs.position==='static')el.style.position='relative';el.style.left=`${dx}px`;el.style.top=`${dy}px`;} showOutline(el); };
    const up = () => { if(!drag)return; const payload=describe(drag.el); window.parent.postMessage({type:'jalwa:customization:layoutChanged',payload},'*'); drag=null; };
    const message = (e: MessageEvent) => { if(e.source!==window.parent)return; const data=e.data; if(data?.type==='jalwa:customization:apply-batch'&&Array.isArray(data.rules)){data.rules.forEach((rule:any)=>applyRule(rule));return;} if(data?.type!=='jalwa:customization:apply'||!data.selector)return; applyRule(data); };
    const applyRule=(data:any)=>{try{document.querySelectorAll(data.selector).forEach(node=>{const el=node as HTMLElement;Object.entries(data.styles??{}).forEach(([key,value])=>{if(typeof value==='string')el.style.setProperty(key,value);});if(typeof data.text==='string'&&el.children.length===0)el.textContent=data.text;if(typeof data.visible==='boolean')el.style.setProperty('display',data.visible?'':'none');});}catch{/* invalid selector */}};
    document.addEventListener('mousemove',move,true); document.addEventListener('mousedown',down,true); document.addEventListener('click',click,true); document.addEventListener('mousemove',dragMove,true); document.addEventListener('mouseup',up,true); window.addEventListener('message',message);
    return()=>{document.removeEventListener('mousemove',move,true);document.removeEventListener('mousedown',down,true);document.removeEventListener('click',click,true);document.removeEventListener('mousemove',dragMove,true);document.removeEventListener('mouseup',up,true);window.removeEventListener('message',message);outline.remove();};
  },[]);
  return null;
}
