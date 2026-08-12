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
    parts.unshift(part); node = node.parentElement;
  }
  return parts.join(' > ');
}

export function CustomizationBuilderBridge() {
  useEffect(() => {
    if (typeof window === 'undefined' || window.self === window.top || new URLSearchParams(window.location.search).get('adminPreview') !== '1') return;
    const outline = document.createElement('div');
    Object.assign(outline.style, { position:'fixed', pointerEvents:'none', zIndex:'2147483647', border:'2px solid #a855f7', background:'rgba(168,85,247,.08)', display:'none', boxSizing:'border-box' });
    const handle = document.createElement('div');
    Object.assign(handle.style, { position:'fixed', width:'10px', height:'10px', border:'2px solid white', background:'#a855f7', zIndex:'2147483647', display:'none', pointerEvents:'none', boxSizing:'border-box' });
    document.body.append(outline, handle);
    let drag: { el: HTMLElement; startX:number; startY:number; startLeft:number; startTop:number; startWidth:number; startHeight:number; mode:'move'|'resize' } | null = null;
    const show = (el: HTMLElement) => { const r=el.getBoundingClientRect(); Object.assign(outline.style,{display:'block',left:`${r.left}px`,top:`${r.top}px`,width:`${r.width}px`,height:`${r.height}px`}); Object.assign(handle.style,{display:'block',left:`${r.right-5}px`,top:`${r.bottom-5}px`}); };
    const describe=(el:HTMLElement)=>{const r=el.getBoundingClientRect(),cs=getComputedStyle(el);return {selector:selectorFor(el),tag:el.tagName.toLowerCase(),text:(el.children.length===0?el.textContent:'').trim().slice(0,500),rect:{x:r.x,y:r.y,width:r.width,height:r.height},styles:{color:cs.color,backgroundColor:cs.backgroundColor,fontSize:cs.fontSize,fontWeight:cs.fontWeight,borderRadius:cs.borderRadius,padding:cs.padding,margin:cs.margin,opacity:cs.opacity,width:cs.width,height:cs.height,position:cs.position,top:cs.top,right:cs.right,bottom:cs.bottom,left:cs.left,transform:cs.transform,display:cs.display,gap:cs.gap}};};
    const ignored=(t:HTMLElement|null)=>!t||t===outline||t===handle||!!t.closest('[data-customization-ignore]');
    const hover=(e:MouseEvent)=>{if(drag)return;const t=e.target as HTMLElement|null;if(ignored(t))return;show(t);};
    const down=(e:MouseEvent)=>{const t=e.target as HTMLElement|null;if(e.button!==0||ignored(t))return;const r=t!.getBoundingClientRect();const resize=e.clientX>=r.right-14&&e.clientY>=r.bottom-14;drag={el:t!,startX:e.clientX,startY:e.clientY,startLeft:r.left,startTop:r.top,startWidth:r.width,startHeight:r.height,mode:resize?'resize':'move'};show(t!);window.parent.postMessage({type:'jalwa:customization:selected',payload:describe(t!)},'*');e.preventDefault();e.stopPropagation();};
    const move=(e:MouseEvent)=>{if(!drag)return;const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY,el=drag.el;if(drag.mode==='resize'){el.style.width=`${Math.max(24,drag.startWidth+dx)}px`;el.style.height=`${Math.max(24,drag.startHeight+dy)}px`;}else{if(getComputedStyle(el).position==='static')el.style.position='relative';el.style.left=`${drag.startLeft?dx:0}px`;el.style.top=`${drag.startTop?dy:0}px`;}show(el);};
    const up=()=>{if(!drag)return;window.parent.postMessage({type:'jalwa:customization:layoutChanged',payload:describe(drag.el)},'*');drag=null;};
    const click=(e:MouseEvent)=>{if(drag)return;const t=e.target as HTMLElement|null;if(ignored(t))return;e.preventDefault();e.stopPropagation();window.parent.postMessage({type:'jalwa:customization:selected',payload:describe(t!)},'*');};
    const apply=(d:any)=>{try{document.querySelectorAll(d.selector).forEach((n)=>{const el=n as HTMLElement;Object.entries(d.styles??{}).forEach(([k,v])=>{if(typeof v==='string')el.style.setProperty(k,v);});if(typeof d.text==='string'&&el.children.length===0)el.textContent=d.text;if(typeof d.visible==='boolean')el.style.display=d.visible?'':'none';});}catch{}};
    const msg=(e:MessageEvent)=>{if(e.source!==window.parent)return;const d=e.data;if(d?.type==='jalwa:customization:apply-batch'&&Array.isArray(d.rules))d.rules.forEach(apply);else if(d?.type==='jalwa:customization:apply'&&d.selector)apply(d);};
    document.addEventListener('mousemove',hover,true);document.addEventListener('mousedown',down,true);document.addEventListener('mousemove',move,true);document.addEventListener('mouseup',up,true);document.addEventListener('click',click,true);window.addEventListener('message',msg);
    return()=>{document.removeEventListener('mousemove',hover,true);document.removeEventListener('mousedown',down,true);document.removeEventListener('mousemove',move,true);document.removeEventListener('mouseup',up,true);document.removeEventListener('click',click,true);window.removeEventListener('message',msg);outline.remove();handle.remove();};
  },[]);
  return null;
}
