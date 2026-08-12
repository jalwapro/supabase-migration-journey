import { useEffect } from 'react';

function selectorFor(el: Element) {
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node.nodeType === 1 && parts.length < 5) {
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

    const describe = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return { selector: selectorFor(el), tag: el.tagName.toLowerCase(), text: (el.textContent ?? '').trim().slice(0, 500), rect: { x: r.x, y: r.y, width: r.width, height: r.height }, styles: { color: cs.color, backgroundColor: cs.backgroundColor, fontSize: cs.fontSize, fontWeight: cs.fontWeight, borderRadius: cs.borderRadius, padding: cs.padding, margin: cs.margin, opacity: cs.opacity } };
    };

    const move = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || target === outline || target.closest('[data-customization-ignore]')) return;
      const r = target.getBoundingClientRect();
      Object.assign(outline.style, { display: 'block', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    };
    const click = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || target === outline || target.closest('[data-customization-ignore]')) return;
      e.preventDefault(); e.stopPropagation();
      window.parent.postMessage({ type: 'jalwa:customization:selected', payload: describe(target) }, '*');
    };
    const message = (e: MessageEvent) => {
      if (e.source !== window.parent) return;
      const data = e.data;
      if (data?.type !== 'jalwa:customization:apply' || !data.selector) return;
      try {
        document.querySelectorAll(data.selector).forEach((node) => {
          const el = node as HTMLElement;
          Object.entries(data.styles ?? {}).forEach(([key, value]) => { if (typeof value === 'string') el.style.setProperty(key, value); });
          if (typeof data.text === 'string' && el.children.length === 0) el.textContent = data.text;
        });
      } catch { /* invalid selector is ignored inside builder */ }
    };
    document.addEventListener('mousemove', move, true);
    document.addEventListener('click', click, true);
    window.addEventListener('message', message);
    return () => { document.removeEventListener('mousemove', move, true); document.removeEventListener('click', click, true); window.removeEventListener('message', message); outline.remove(); };
  }, []);
  return null;
}
