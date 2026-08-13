import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useEffect, useRef, useState } from 'react';
import { AdminPageHeader } from '@/components/admin/AdminShell';
import { Monitor, Smartphone, Tablet, ExternalLink, RefreshCw, Save, Upload, Eye, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const Route = createFileRoute('/_authenticated/admin/app-customization-preview')({ component: ExistingAppPreview });
type Device = 'mobile' | 'tablet' | 'desktop';
type Selected = { selector: string; tag: string; text: string; styles: Record<string, string>; rect: { width: number; height: number } };
type Rule = { selector: string; styles: Record<string, string>; text?: string; visible?: boolean };

const pages = [
  ['home', '/', 'Home'], ['discover', '/discover', 'Discover'], ['search', '/search', 'Search'], ['live', '/live', 'Live'],
  ['rooms', '/rooms', 'Rooms'], ['room-details', '/room-details', 'Room Details'], ['profile', '/profile', 'Profile'],
  ['followers', '/followers', 'Followers'], ['following', '/following', 'Following'], ['wallet', '/wallet', 'Wallet'],
  ['recharge', '/recharge', 'Recharge'], ['recharge-history', '/recharge-history', 'Recharge History'], ['withdraw', '/withdraw', 'Withdraw'],
  ['gifts', '/gifts', 'Gifts'], ['ranking', '/ranking', 'Ranking'], ['messages', '/messages', 'Messages'], ['chat', '/chat', 'Chat'],
  ['notifications', '/notifications', 'Notifications'], ['settings', '/settings', 'Settings'], ['vip', '/vip', 'VIP'],
  ['levels', '/levels', 'Levels'], ['tasks', '/tasks', 'Tasks'], ['games', '/games', 'Games'],
  ['voice-room', '/voice-room-preview', 'Voice Room'], ['video-room', '/video-room-preview', 'Video Room'], ['pk-battle', '/pk-battle-preview', 'PK Battle'],
  ['login', '/login', 'Login'], ['register', '/register', 'Register'], ['splash', '/splash', 'Splash'],
];

function ExistingAppPreview() {
  const { user } = useAuth();
  const [page, setPage] = useState('home');
  const [device, setDevice] = useState<Device>('mobile');
  const [reloadKey, setReloadKey] = useState(0);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [status, setStatus] = useState('Ready — click an element in the app preview.');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const selectedPage = pages.find(([key]) => key === page) ?? pages[0];
  const src = useMemo(() => `${window.location.origin}${selectedPage[1]}?adminPreview=1&customizationMode=design&previewIdentity=neutral`, [selectedPage]);
  const width = device === 'mobile' ? 390 : device === 'tablet' ? 768 : 1180;

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow || event.data?.type !== 'jalwa:customization:selected') return;
      setSelected(event.data.payload as Selected);
      setStatus(`Selected ${event.data.payload.tag}: ${event.data.payload.selector}`);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const apply = (patch: Partial<Selected>) => {
    if (!selected) return;
    const next = { ...selected, ...patch, styles: { ...selected.styles, ...(patch.styles ?? {}) } };
    setSelected(next);
    iframeRef.current?.contentWindow?.postMessage({ type: 'jalwa:customization:apply', selector: next.selector, styles: next.styles, text: next.text }, '*');
    setRules((old) => { const rest = old.filter((r) => r.selector !== next.selector); return [...rest, { selector: next.selector, styles: next.styles, text: next.text }]; });
  };

  const save = async (publish: boolean) => {
    if (!user) { setStatus('Admin session not available.'); return; }
    setStatus(publish ? 'Publishing…' : 'Saving draft…');
    const { data: pageRow, error: pageError } = await supabase.from('app_customization_pages').select('id').eq('page_key', page).single();
    if (pageError || !pageRow) { setStatus(pageError?.message ?? 'Page not found'); return; }
    const config = { schemaVersion: 3, mode: 'design-only', page, elements: rules };
    const { error: draftError } = await supabase.from('app_customization_drafts').insert({ page_id: pageRow.id, name: `${selectedPage[2]} Builder Draft`, config, status: 'draft', is_active: true, created_by: user.id });
    if (draftError) { setStatus(`Draft error: ${draftError.message}`); return; }
    if (publish) {
      const { data: latest } = await supabase.from('app_customization_versions').select('version').eq('page_id', pageRow.id).order('version', { ascending: false }).limit(1).maybeSingle();
      const nextVersion = Number(latest?.version ?? 0) + 1;
      const { data: version, error: versionError } = await supabase.from('app_customization_versions').insert({ page_id: pageRow.id, version: nextVersion, status: 'published', config, change_description: 'Published from Visual Editor', created_by: user.id, published_at: new Date().toISOString() }).select('id').single();
      if (versionError || !version) { setStatus(`Version error: ${versionError?.message ?? 'unknown'}`); return; }
      await supabase.from('app_customization_published').update({ is_current: false }).eq('page_id', pageRow.id).eq('is_current', true);
      const { error: pubError } = await supabase.from('app_customization_published').insert({ page_id: pageRow.id, version_id: version.id, config, version: nextVersion, published_by: user.id, is_current: true });
      if (pubError) { setStatus(`Publish error: ${pubError.message}`); return; }
      setStatus(`Published ${selectedPage[2]} v${nextVersion}. Visual overrides are ready for the live runtime.`);
    } else setStatus(`Draft saved for ${selectedPage[2]}.`);
  };

  return (
    <div className="-m-4 min-h-[calc(100vh-64px)] bg-muted/20 md:-m-6 lg:-m-8">
      <div className="sticky top-0 z-30 border-b bg-background/95 px-4 py-3 backdrop-blur md:px-6">
        <AdminPageHeader title="App Customization — Full App Studio" subtitle="The existing frontend is loaded in isolated design-only mode. Identity and functional actions are locked." right={<div className="flex gap-2"><button className="rounded-lg border p-2" onClick={() => setReloadKey((v) => v + 1)} title="Reload"><RefreshCw className="h-4 w-4" /></button><a className="rounded-lg border px-3 py-2 text-sm" href={src} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 inline h-4 w-4" />Open Preview</a></div>} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select value={page} onChange={(e) => { setPage(e.target.value); setRules([]); setSelected(null); }} className="max-w-[220px] rounded-lg border bg-background px-3 py-2 text-sm">{pages.map(([key, , label]) => <option key={key} value={key}>{label}</option>)}</select>
          {(['mobile', 'tablet', 'desktop'] as Device[]).map((d) => <button key={d} onClick={() => setDevice(d)} className={`rounded-full px-3 py-1.5 text-xs ${device === d ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>{d === 'mobile' ? <Smartphone className="mr-1 inline h-3.5 w-3.5" /> : d === 'tablet' ? <Tablet className="mr-1 inline h-3.5 w-3.5" /> : <Monitor className="mr-1 inline h-3.5 w-3.5" />}{d}</button>)}
          <button onClick={() => void save(false)} className="rounded-lg bg-muted px-3 py-2 text-sm"><Save className="mr-1 inline h-4 w-4" />Save Draft</button>
          <button onClick={() => void save(true)} className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"><Upload className="mr-1 inline h-4 w-4" />Publish</button>
          <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3 w-3" />Functionality Locked</span>
        </div>
      </div>
      <main className="grid min-h-[calc(100vh-160px)] grid-cols-[minmax(0,1fr)_300px] overflow-hidden bg-zinc-950">
        <section className="overflow-auto p-4 md:p-8">
          <div className="mb-2 flex items-center justify-between text-[10px] text-zinc-400"><span><Eye className="mr-1 inline h-3 w-3" />REAL EXISTING APP — DESIGN MODE</span><span>{selectedPage[2]} • {width}px</span></div>
          <div className="mx-auto overflow-hidden rounded-[28px] border border-zinc-700 bg-black shadow-2xl" style={{ width, maxWidth: '100%', minHeight: device === 'desktop' ? 760 : 780 }}>
            <iframe ref={iframeRef} key={`${src}-${reloadKey}`} title={`Editable ${selectedPage[2]} app preview`} src={src} sandbox="allow-scripts allow-forms allow-popups allow-modals" className="h-[780px] w-full border-0 bg-black" style={{ display: 'block' }} />
          </div>
        </section>
        <aside className="overflow-y-auto border-l border-white/10 bg-background p-4">
          <h3 className="font-semibold">Design Properties</h3>
          {!selected ? <p className="mt-3 text-sm text-muted-foreground">Click any visible element in the existing app to select it.</p> : <>
            <div className="mt-3 rounded-xl border bg-muted/30 p-3"><div className="text-xs font-medium">{selected.tag}</div><div className="mt-1 break-all text-[10px] text-muted-foreground">{selected.selector}</div><div className="mt-2 text-[10px] text-muted-foreground">{Math.round(selected.rect.width)} × {Math.round(selected.rect.height)}</div></div>
            <label className="mt-4 block text-xs font-medium">Text</label><textarea value={selected.text} onChange={(e) => apply({ text: e.target.value })} className="mt-1 min-h-20 w-full rounded-lg border bg-background p-2 text-sm" />
            <label className="mt-4 block text-xs font-medium">Background</label><input type="text" value={selected.styles.backgroundColor} onChange={(e) => apply({ styles: { backgroundColor: e.target.value } })} className="mt-1 w-full rounded-lg border bg-background p-2 text-sm" />
            <label className="mt-4 block text-xs font-medium">Text Color</label><input type="text" value={selected.styles.color} onChange={(e) => apply({ styles: { color: e.target.value } })} className="mt-1 w-full rounded-lg border bg-background p-2 text-sm" />
            <label className="mt-4 block text-xs font-medium">Font Size</label><input type="text" value={selected.styles.fontSize} onChange={(e) => apply({ styles: { fontSize: e.target.value } })} className="mt-1 w-full rounded-lg border bg-background p-2 text-sm" />
            <label className="mt-4 block text-xs font-medium">Border Radius</label><input type="text" value={selected.styles.borderRadius} onChange={(e) => apply({ styles: { borderRadius: e.target.value } })} className="mt-1 w-full rounded-lg border bg-background p-2 text-sm" />
            <label className="mt-4 block text-xs font-medium">Opacity</label><input type="text" value={selected.styles.opacity} onChange={(e) => apply({ styles: { opacity: e.target.value } })} className="mt-1 w-full rounded-lg border bg-background p-2 text-sm" />
          </>}
          <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">Only frontend visual overrides are stored. Routes, click handlers, APIs, database operations and business logic are not editable by this Studio.</div>
        </aside>
      </main>
    </div>
  );
}