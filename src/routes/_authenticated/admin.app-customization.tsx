import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { Eye, Layout, Lock, Smartphone, Tablet, Monitor, Save, Send, Plus, Settings2 } from 'lucide-react';
import { APP_PAGE_CATALOG, createDefaultAppVisualDraft, type AppPageId } from '@/lib/app-visual-customization';

export const Route = createFileRoute('/_authenticated/admin/app-customization')({ component: AppCustomizationStudio });

function AppCustomizationStudio() {
  const navigate = useNavigate();
  const [page, setPage] = useState<AppPageId>('home');
  const [device, setDevice] = useState<'mobile' | 'tablet' | 'desktop'>('mobile');
  const draft = useMemo(() => createDefaultAppVisualDraft(), []);
  const current = draft.pages.find((p) => p.id === page)!;
  const previewWidth = device === 'mobile' ? 390 : device === 'tablet' ? 768 : 1280;

  return <div className="min-h-screen bg-[#090a10] p-6 text-white">
    <div className="mx-auto max-w-[1500px]">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-3xl font-bold">App Customization Studio</h1><p className="mt-1 text-white/60">Customize your complete app A–Z, page by page, then publish each page independently.</p></div>
        <div className="flex gap-2"><button className="rounded-lg bg-white/10 px-4 py-2"><Save className="mr-2 inline h-4 w-4"/>Save Draft</button><button className="rounded-lg bg-purple-600 px-4 py-2"><Send className="mr-2 inline h-4 w-4"/>Publish Page</button></div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[240px_1fr_300px]">
        <aside className="rounded-xl border border-white/10 bg-white/[.03] p-3"><h2 className="mb-3 font-semibold">Pages</h2>{APP_PAGE_CATALOG.map((item) => <button key={item.id} onClick={() => setPage(item.id)} className={`mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${page === item.id ? 'bg-purple-600' : 'hover:bg-white/10'}`}>{item.name}<span className="text-[10px] opacity-50">{item.route}</span></button>)}</aside>
        <main className="rounded-xl border border-white/10 bg-black/20 p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-xl font-semibold">{current.name}</h2><p className="text-sm text-white/50">{current.route}</p></div><div className="flex gap-1 rounded-lg bg-white/5 p-1"><button onClick={() => setDevice('mobile')} className={`rounded p-2 ${device==='mobile'?'bg-white/15':''}`}><Smartphone className="h-4 w-4"/></button><button onClick={() => setDevice('tablet')} className={`rounded p-2 ${device==='tablet'?'bg-white/15':''}`}><Tablet className="h-4 w-4"/></button><button onClick={() => setDevice('desktop')} className={`rounded p-2 ${device==='desktop'?'bg-white/15':''}`}><Monitor className="h-4 w-4"/></button></div></div><div className="mx-auto min-h-[650px] rounded-2xl border border-dashed border-white/20 bg-[#10111a] p-4" style={{maxWidth: previewWidth}}><div className="flex h-full min-h-[620px] items-center justify-center text-center text-white/35"><div><Layout className="mx-auto mb-3 h-10 w-10"/><p className="font-medium">{current.name} Visual Canvas</p><p className="mt-1 text-xs">Select an element from the right panel or add a new component.</p><button className="mt-4 rounded-lg bg-purple-600 px-4 py-2 text-sm"><Plus className="mr-2 inline h-4 w-4"/>Add Element</button></div></div></div></main>
        <aside className="rounded-xl border border-white/10 bg-white/[.03] p-4"><h2 className="mb-4 font-semibold">Properties</h2><div className="space-y-3 text-sm"><div className="rounded-lg bg-white/5 p-3"><Settings2 className="mb-2 h-4 w-4"/><p>Element properties</p><p className="mt-1 text-xs text-white/40">Position, size, colors, typography, spacing, visibility, content and ordering.</p></div><div className="rounded-lg bg-white/5 p-3"><Eye className="mb-2 h-4 w-4"/><p>Live Preview</p><p className="mt-1 text-xs text-white/40">Preview the selected page before publishing.</p></div><div className="rounded-lg bg-white/5 p-3"><Lock className="mb-2 h-4 w-4"/><p>Publish Safety</p><p className="mt-1 text-xs text-white/40">Draft changes remain private until this page is published.</p></div></div></aside>
      </div>
    </div>
  </div>;
}
