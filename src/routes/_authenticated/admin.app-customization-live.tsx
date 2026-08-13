import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminPageHeader } from '@/components/admin/AdminShell';
import { toast } from 'sonner';
import { Eye, Monitor, RefreshCw, Save, Smartphone, Tablet, Upload } from 'lucide-react';

export const Route = createFileRoute('/_authenticated/admin/app-customization-live')({ component: LiveCustomizationStudio });

type Device = 'mobile' | 'tablet' | 'desktop';
type Rule = { selector: string; text?: string; visible?: boolean; styles: Record<string, string>; responsive?: Record<string, Record<string, string>> };
type Section = { id: string; name: string; selector: string; enabled: boolean };
type Config = { page: string; theme: Record<string, unknown>; settings: Record<string, unknown>; navigation: Record<string, unknown>; elements: Rule[]; sections: Section[] };
type Page = { id: string; page_key: string; name: string; route_pattern: string };
type Selected = Rule & { tag: string; rect?: { x?: number; y?: number; width: number; height: number } };

const paths: Record<string, string> = {
  home: '/', discover: '/discover', search: '/search', live: '/live', rooms: '/rooms', wallet: '/wallet', recharge: '/wallet',
  gifts: '/gifts', ranking: '/ranking', chat: '/messages', messages: '/messages', notifications: '/notifications', settings: '/settings',
  login: '/login', register: '/register', splash: '/splash', profile: '/profile',
  'voice-room': '/admin/room-frames-preview?mode=voice', 'video-room': '/admin/room-frames-preview?mode=video', 'pk-battle': '/admin/room-frames-preview?mode=pk',
};
const empty = (page: string): Config => ({ page, theme: {}, settings: {}, navigation: {}, elements: [], sections: [] });
const controls: Array<[string, string]> = [
  ['color', 'Text color'], ['background-color', 'Background'], ['font-size', 'Font size'], ['font-weight', 'Font weight'], ['line-height', 'Line height'],
  ['letter-spacing', 'Letter spacing'], ['text-align', 'Text align'], ['border-radius', 'Radius'], ['border-width', 'Border width'], ['border-style', 'Border style'],
  ['padding', 'Padding'], ['margin', 'Margin'], ['width', 'Width'], ['height', 'Height'], ['min-width', 'Min width'], ['max-width', 'Max width'],
  ['opacity', 'Opacity'], ['display', 'Display'], ['position', 'Position'], ['top', 'Top'], ['right', 'Right'], ['bottom', 'Bottom'], ['left', 'Left'], ['z-index', 'Z-index'], ['transform', 'Transform'], ['gap', 'Gap'],
];

function LiveCustomizationStudio() {
  const [pages, setPages] = useState<Page[]>([]);
  const [pageKey, setPageKey] = useState('home');
  const [config, setConfig] = useState<Config>(empty('home'));
  const [selected, setSelected] = useState<Selected | null>(null);
  const [device, setDevice] = useState<Device>('mobile');
  const [saving, setSaving] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [history, setHistory] = useState<Config[]>([]);
  const [future, setFuture] = useState<Config[]>([]);
  const [layerFilter, setLayerFilter] = useState('');
  const [panel, setPanel] = useState<'layers' | 'sections' | 'components' | 'theme' | 'properties'>('layers');
  const frame = useRef<HTMLIFrameElement>(null);
  const page = useMemo(() => pages.find((p) => p.page_key === pageKey), [pages, pageKey]);
  const src = paths[pageKey] ?? page?.route_pattern ?? '/';
  const previewSrc = `${src}${src.includes('?') ? '&' : '?'}adminPreview=1&customizationMode=design&previewIdentity=neutral`;
  const layers = useMemo(() => config.elements.filter((r) => `${r.selector} ${r.text ?? ''}`.toLowerCase().includes(layerFilter.toLowerCase())), [config.elements, layerFilter]);
  const width = device === 'mobile' ? 390 : device === 'tablet' ? 768 : 1180;

  useEffect(() => {
    void loadPages();
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === 'jalwa:customization:selected') {
        const payload = event.data.payload as Selected;
        setSelected({ ...payload, styles: payload.styles ?? {} });
        setPanel('properties');
      }
      if (event.data?.type === 'jalwa:customization:layoutChanged') {
        const payload = event.data.payload as Selected;
        const rule: Rule = { selector: payload.selector, text: payload.text, visible: payload.visible, styles: { ...(payload.styles ?? {}), ...(payload.rect?.width ? { width: `${payload.rect.width}px` } : {}), ...(payload.rect?.height ? { height: `${payload.rect.height}px` } : {}) }, responsive: payload.responsive };
        setSelected({ ...payload, styles: rule.styles });
        applyRule(rule);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => { if (page) void loadConfig(page); }, [page?.id]);
  useEffect(() => { if (frame.current?.contentWindow) config.elements.forEach(sendRule); }, [config.elements, iframeKey]);

  async function loadPages() {
    const { data, error } = await supabase.from('app_customization_pages').select('id,page_key,name,route_pattern').order('sort_order');
    if (error) return toast.error(error.message);
    const rows = (data ?? []) as Page[];
    setPages(rows);
    if (rows.length && !rows.some((item) => item.page_key === pageKey)) setPageKey(rows[0].page_key);
  }

  async function loadConfig(currentPage: Page) {
    const { data: draft } = await supabase.from('app_customization_drafts').select('config').eq('page_id', currentPage.id).eq('is_active', true).order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if (draft?.config) { setConfig(draft.config as Config); setHistory([]); setFuture([]); return; }
    const { data: published } = await supabase.from('app_customization_published').select('config').eq('page_id', currentPage.id).eq('is_current', true).maybeSingle();
    setConfig((published?.config as Config) ?? empty(currentPage.page_key));
    setHistory([]); setFuture([]);
  }

  function sendRule(rule: Rule) { frame.current?.contentWindow?.postMessage({ type: 'jalwa:customization:apply', selector: rule.selector, styles: rule.styles, text: rule.text, visible: rule.visible }, '*'); }

  function applyRule(rule: Rule) {
    setConfig((current) => {
      const index = current.elements.findIndex((item) => item.selector === rule.selector);
      const next = index < 0 ? { ...current, elements: [...current.elements, rule] } : { ...current, elements: current.elements.map((item, itemIndex) => itemIndex === index ? rule : item) };
      setHistory((items) => [...items.slice(-19), current]);
      setFuture([]);
      return next;
    });
  }

  function patchSelected(patch: Partial<Selected>) {
    if (!selected) return;
    const next = { ...selected, ...patch, styles: { ...selected.styles, ...(patch.styles ?? {}) } };
    setSelected(next);
    const rule: Rule = { selector: next.selector, text: next.text, visible: next.visible, styles: next.styles, responsive: next.responsive };
    applyRule(rule); sendRule(rule);
  }

  function style(key: string, value: string) {
    const responsive = { ...(selected?.responsive ?? {}), [device]: { ...(selected?.responsive?.[device] ?? {}), [key]: value } };
    patchSelected({ styles: { ...(selected?.styles ?? {}), [key]: value }, responsive });
  }

  function selectLayer(rule: Rule) { setSelected({ ...rule, tag: rule.selector.split(' > ').at(-1)?.split(/[.#]/)[0] ?? 'element' }); sendRule(rule); }
  function removeLayer(selector: string) { setConfig((current) => ({ ...current, elements: current.elements.filter((rule) => rule.selector !== selector) })); if (selected?.selector === selector) setSelected(null); }
  function duplicateLayer(rule: Rule) { const copy: Rule = { ...rule, selector: `${rule.selector}:not([data-customization-duplicate])`, styles: { ...rule.styles, transform: `translate(8px,8px) ${rule.styles.transform ?? ''}`.trim() } }; applyRule(copy); setSelected({ ...copy, tag: 'duplicate' }); sendRule(copy); }
  function addComponent(type: string) { if (!selected) return toast.info('Select a container or section in the preview first'); const rule: Rule = { selector: `${selected.selector} [data-builder-component="${type}"]`, styles: { display: type === 'divider' ? 'block' : 'flex', padding: type === 'spacer' ? '24px' : '12px', minHeight: type === 'spacer' ? '24px' : '40px', background: type === 'card' ? 'var(--card)' : 'transparent' } }; applyRule(rule); sendRule(rule); toast.success(`${type} component added`); }
  function theme(key: string, value: string) { setConfig((current) => ({ ...current, theme: { ...current.theme, [key]: value } })); }
  function addSection() { const id = `section-${Date.now()}`; setConfig((current) => ({ ...current, sections: [...current.sections, { id, name: `Section ${current.sections.length + 1}`, selector: `[data-customization-section="${id}"]`, enabled: true }] })); toast.success('Section added'); }
  function toggleSection(id: string) { setConfig((current) => ({ ...current, sections: current.sections.map((section) => section.id === id ? { ...section, enabled: !section.enabled } : section) })); }
  function renameSection(id: string, name: string) { setConfig((current) => ({ ...current, sections: current.sections.map((section) => section.id === id ? { ...section, name } : section) })); }
  function deleteSection(id: string) { setConfig((current) => ({ ...current, sections: current.sections.filter((section) => section.id !== id) })); }
  function undo() { const previous = history.at(-1); if (!previous) return; setFuture((items) => [config, ...items]); setConfig(previous); setHistory((items) => items.slice(0, -1)); }
  function redo() { const next = future[0]; if (!next) return; setHistory((items) => [...items, config]); setConfig(next); setFuture((items) => items.slice(1)); }

  async function saveDraft() {
    if (!page) return;
    setSaving(true);
    const user = (await supabase.auth.getUser()).data.user;
    const { data: old } = await supabase.from('app_customization_drafts').select('id').eq('page_id', page.id).eq('is_active', true).order('updated_at', { ascending: false }).limit(1).maybeSingle();
    const payload = { page_id: page.id, config, name: `${page.name} Live Draft`, created_by: user?.id, is_active: true };
    const result = old?.id ? await supabase.from('app_customization_drafts').update({ config, name: payload.name }).eq('id', old.id) : await supabase.from('app_customization_drafts').insert(payload);
    if (result.error) toast.error(result.error.message); else toast.success('Draft saved');
    setSaving(false);
  }

  async function publish() {
    if (!page) return;
    const user = (await supabase.auth.getUser()).data.user;
    const { data: last } = await supabase.from('app_customization_versions').select('version').eq('page_id', page.id).order('version', { ascending: false }).limit(1).maybeSingle();
    const next = Number(last?.version ?? 0) + 1;
    const { data: version, error } = await supabase.from('app_customization_versions').insert({ page_id: page.id, version: next, status: 'published', config, created_by: user?.id }).select('id').single();
    if (error || !version) return toast.error(error?.message ?? 'Version creation failed');
    await supabase.from('app_customization_published').update({ is_current: false }).eq('page_id', page.id).eq('is_current', true);
    const { error: publishError } = await supabase.from('app_customization_published').insert({ page_id: page.id, version_id: version.id, config, version: next, published_by: user?.id, is_current: true });
    if (publishError) toast.error(publishError.message); else { toast.success(`${page.name} published`); setIframeKey((value) => value + 1); }
  }

  return (
    <div className="-m-4 min-h-[calc(100vh-64px)] bg-muted/20 md:-m-6 lg:-m-8">
      <AdminPageHeader title="Live App Customization" subtitle="Wix-style visual editing for the real app preview. Draft changes stay isolated until Publish." right={<div className="flex gap-2"><button className="rounded-lg border px-3 py-2 text-sm" onClick={undo} disabled={!history.length}>Undo</button><button className="rounded-lg border px-3 py-2 text-sm" onClick={redo} disabled={!future.length}>Redo</button><button className="rounded-lg border px-3 py-2 text-sm" onClick={saveDraft} disabled={saving}><Save className="mr-1 inline h-4 w-4" />Save Draft</button><button className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground" onClick={publish}><Upload className="mr-1 inline h-4 w-4" />Publish</button></div>} />
      <div className="flex flex-wrap gap-2 border-b bg-background p-3"><select className="rounded-lg border px-3 py-2 text-sm" value={pageKey} onChange={(event) => { setPageKey(event.target.value); setSelected(null); }}>{pages.map((item) => <option key={item.page_key} value={item.page_key}>{item.name}</option>)}</select>{(['mobile', 'tablet', 'desktop'] as Device[]).map((item) => <button key={item} onClick={() => setDevice(item)} className={`rounded-lg px-3 py-2 text-xs ${device === item ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>{item === 'mobile' ? <Smartphone className="mr-1 inline h-3.5 w-3.5" /> : item === 'tablet' ? <Tablet className="mr-1 inline h-3.5 w-3.5" /> : <Monitor className="mr-1 inline h-3.5 w-3.5" />}{item}</button>)}<button className="rounded-lg border px-3 py-2 text-xs" onClick={() => setIframeKey((value) => value + 1)}><RefreshCw className="mr-1 inline h-3.5 w-3.5" />Reload</button></div>
      <div className="grid min-h-[calc(100vh-150px)] lg:grid-cols-[minmax(0,1fr)_460px]">
        <main className="flex justify-center overflow-auto bg-zinc-950 p-5"><div style={{ width, maxWidth: '100%' }} className="overflow-hidden rounded-2xl bg-background shadow-2xl"><div className="flex items-center justify-between border-b border-white/10 bg-black px-3 py-2 text-[10px] text-zinc-400"><span><Eye className="mr-1 inline h-3 w-3" />REAL EXISTING APP — DESIGN MODE</span><span>{device} • {width}px • Demo data only</span></div><iframe key={iframeKey} ref={frame} title="Actual App Preview" src={previewSrc} className="h-[760px] w-full border-0" /></div></main>
        <aside className="max-h-[calc(100vh-150px)] overflow-y-auto border-l bg-background p-4"><div className="mb-4 grid grid-cols-5 gap-1">{([['layers', 'Layers'], ['sections', 'Sections'], ['components', 'Add'], ['theme', 'Theme'], ['properties', 'Style']] as const).map(([key, label]) => <button key={key} onClick={() => setPanel(key)} className={`rounded-lg p-2 text-[10px] ${panel === key ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>{label}</button>)}</div>
          {panel === 'layers' && <div className="rounded-xl border p-3"><div className="mb-2 flex justify-between"><b className="text-sm">Layers</b><span className="text-[10px] text-muted-foreground">{config.elements.length}</span></div><input className="mb-2 w-full rounded-lg border p-2 text-xs" placeholder="Search layers..." value={layerFilter} onChange={(event) => setLayerFilter(event.target.value)} />{layers.map((rule, index) => <div key={`${rule.selector}-${index}`} className={`mb-1 flex rounded-lg border p-1 ${selected?.selector === rule.selector ? 'bg-primary/10' : ''}`}><button className="min-w-0 flex-1 truncate p-1 text-left text-[10px]" onClick={() => selectLayer(rule)}>{rule.text || rule.selector}</button><button onClick={() => duplicateLayer(rule)}>＋</button><button onClick={() => removeLayer(rule.selector)}>×</button></div>)}</div>}
          {panel === 'sections' && <div className="space-y-2"><button onClick={addSection} className="w-full rounded-xl bg-primary p-3 text-sm text-primary-foreground">+ Add Section</button>{config.sections.map((section) => <div key={section.id} className="rounded-xl border p-3"><div className="flex gap-2"><input className="min-w-0 flex-1 rounded border p-2 text-xs" value={section.name} onChange={(event) => renameSection(section.id, event.target.value)} /><button onClick={() => toggleSection(section.id)} className="rounded border px-2 text-xs">{section.enabled ? 'On' : 'Off'}</button><button onClick={() => deleteSection(section.id)} className="rounded border px-2 text-xs">×</button></div></div>)}</div>}
          {panel === 'components' && <div className="grid grid-cols-2 gap-2">{['container', 'text', 'button', 'image', 'card', 'banner', 'divider', 'spacer'].map((type) => <button key={type} onClick={() => addComponent(type)} className="rounded-xl border p-4 text-left"><b className="text-xs">{type}</b><div className="mt-1 text-[10px] text-muted-foreground">Add component</div></button>)}</div>}
          {panel === 'theme' && <div className="space-y-3 rounded-xl border p-3"><b className="text-sm">Theme</b>{([['primaryColor', 'Primary color'], ['accentColor', 'Accent color'], ['backgroundColor', 'Background'], ['surfaceColor', 'Surface'], ['textColor', 'Text color'], ['fontFamily', 'Font family'], ['radius', 'Global radius']] as const).map(([key, label]) => <label key={key} className="block text-xs">{label}<input className="mt-1 w-full rounded-lg border p-2" value={String(config.theme[key] ?? '')} onChange={(event) => theme(key, event.target.value)} /></label>)}</div>}
          {panel === 'properties' && selected && <div className="space-y-3"><div className="rounded-xl border p-3"><b className="text-sm">Selected</b><div className="mt-1 break-all text-[10px] text-muted-foreground">{selected.selector}</div><div className="mt-1 text-[10px] text-muted-foreground">{selected.tag} • {selected.rect ? `${Math.round(selected.rect.width)} × ${Math.round(selected.rect.height)}` : 'live element'}</div></div><label className="block text-xs">Text<input className="mt-1 w-full rounded-lg border p-2" value={selected.text ?? ''} onChange={(event) => patchSelected({ text: event.target.value })} /></label><div className="grid grid-cols-2 gap-2">{controls.map(([key, label]) => <label key={key} className="text-xs">{label}<input className="mt-1 w-full rounded-lg border p-2" value={selected.styles?.[key] ?? ''} onChange={(event) => style(key, event.target.value)} /></label>)}</div><div className="rounded-xl border p-3"><b className="text-xs">Responsive ({device})</b><p className="mt-1 text-[10px] text-muted-foreground">Visual changes are stored per breakpoint. Routes and actions remain locked.</p></div><div className="flex gap-2"><button className="flex-1 rounded-lg border p-2 text-xs" onClick={() => patchSelected({ visible: selected.visible === false })}>{selected.visible === false ? 'Show' : 'Hide'}</button><button className="flex-1 rounded-lg border p-2 text-xs" onClick={() => setSelected(null)}>Clear</button></div></div>}
          {panel === 'properties' && !selected && <div className="rounded-xl border p-4 text-xs text-muted-foreground">Select an element in the real preview first.</div>}
        </aside>
      </div>
    </div>
  );
}
