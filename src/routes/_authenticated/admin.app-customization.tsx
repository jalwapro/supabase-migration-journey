import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { Eye, Monitor, Smartphone, Save, Rocket, Undo2, History, RotateCcw } from 'lucide-react';
import { DEFAULT_APP_CUSTOMIZATION, type AppCustomizationConfig, type AppPage } from '@/lib/app-customization';
import { AppVisualBuilder } from '@/components/admin/AppVisualBuilder';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const Route = createFileRoute('/_authenticated/admin/app-customization')({ component: AppCustomizationPage });
const pages: { id: AppPage; label: string }[] = [
  { id: 'home', label: 'Home' }, { id: 'voice', label: 'Voice Rooms' }, { id: 'video', label: 'Video Rooms' },
  { id: 'pk', label: 'PK Rooms' }, { id: 'profile', label: 'Profile' }, { id: 'wallet', label: 'Wallet' },
  { id: 'navigation', label: 'Navigation' }, { id: 'popups', label: 'Popups' },
];

type PublishedVersion = { id: string; version: number; config_json: AppCustomizationConfig; created_at: string; change_description: string | null };

function AppCustomizationPage() {
  const { user } = useAuth();
  const [config, setConfig] = useState<AppCustomizationConfig>(DEFAULT_APP_CUSTOMIZATION);
  const [page, setPage] = useState<AppPage>('home');
  const [device, setDevice] = useState<'mobile' | 'desktop'>('mobile');
  const [message, setMessage] = useState('');
  const [versions, setVersions] = useState<PublishedVersion[]>([]);
  const previewWidth = device === 'mobile' ? 390 : 900;

  const loadVersions = async () => {
    const { data } = await supabase.from('app_customizations').select('id,version,config_json,created_at').eq('status', 'published').order('version', { ascending: false }).limit(20);
    setVersions((data ?? []) as unknown as PublishedVersion[]);
  };
  useEffect(() => { void loadVersions(); }, []);

  const updateTheme = (key: keyof AppCustomizationConfig['theme'], value: string | number) => setConfig((current) => ({ ...current, theme: { ...current.theme, [key]: value } }));
  const saveDraft = async () => {
    if (!user?.id) return;
    const { error } = await supabase.from('app_customizations').insert({ name: 'Main App', config_json: config, status: 'draft', version: config.version, created_by: user.id });
    setMessage(error ? `Save failed: ${error.message}` : 'Draft saved');
  };
  const publish = async () => {
    if (!user?.id) return;
    const { data: current } = await supabase.from('app_customizations').select('version').eq('status', 'published').order('version', { ascending: false }).limit(1).maybeSingle();
    const version = (current?.version ?? 0) + 1;
    const publishedConfig = { ...config, version };
    const { error } = await supabase.from('app_customizations').insert({ name: 'Main App', config_json: publishedConfig, status: 'published', version, created_by: user.id, published_at: new Date().toISOString() });
    if (!error) { setConfig(publishedConfig); await loadVersions(); }
    setMessage(error ? `Publish failed: ${error.message}` : `Published version ${version}`);
  };
  const restoreVersion = (version: PublishedVersion) => { setConfig({ ...version.config_json, version: version.version }); setMessage(`Version ${version.version} loaded into the editor. Publish it to make it live.`); };
  const pageLabel = useMemo(() => pages.find((item) => item.id === page)?.label ?? 'Home', [page]);

  return <div className="min-h-screen bg-[#09090f] text-white p-6">
    <div className="max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-3xl font-bold">App Customization Studio</h1><p className="text-white/50 mt-1">Wix-style visual editor for your complete app.</p></div>
        <div className="flex gap-2"><button onClick={() => setConfig(DEFAULT_APP_CUSTOMIZATION)} className="px-4 py-2 rounded-lg bg-white/10 flex gap-2 items-center"><Undo2 className="w-4 h-4"/>Reset</button><button onClick={saveDraft} className="px-4 py-2 rounded-lg bg-white/10 flex gap-2 items-center"><Save className="w-4 h-4"/>Save Draft</button><button onClick={publish} className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 flex gap-2 items-center font-semibold"><Rocket className="w-4 h-4"/>Publish</button></div>
      </div>
      {message && <div className="mb-4 rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-sm">{message}</div>}
      <div className="grid grid-cols-[220px_minmax(400px,1fr)_300px] gap-5">
        <aside className="rounded-xl border border-white/10 bg-white/[.03] p-3"><p className="text-xs uppercase text-white/40 px-3 py-2">Pages</p>{pages.map((item) => <button key={item.id} onClick={() => setPage(item.id)} className={`w-full text-left px-3 py-3 rounded-lg mb-1 ${page === item.id ? 'bg-violet-600/30 text-violet-200' : 'hover:bg-white/5 text-white/70'}`}>{item.label}</button>)}</aside>
        <main className="rounded-xl border border-white/10 bg-white/[.03] p-5 min-h-[720px]">
          <div className="flex justify-between items-center mb-4"><div><span className="text-sm text-white/40">Visual Builder</span><h2 className="text-xl font-semibold">{pageLabel}</h2></div><div className="flex gap-2"><button onClick={() => setDevice('mobile')} className={`p-2 rounded ${device === 'mobile' ? 'bg-white/15' : 'bg-white/5'}`}><Smartphone className="w-4 h-4"/></button><button onClick={() => setDevice('desktop')} className={`p-2 rounded ${device === 'desktop' ? 'bg-white/15' : 'bg-white/5'}`}><Monitor className="w-4 h-4"/></button></div></div>
          <div style={{ maxWidth: previewWidth }} className="mx-auto"><AppVisualBuilder config={config} page={page} onChange={setConfig}/></div>
        </main>
        <aside className="space-y-5">
          <div className="rounded-xl border border-white/10 bg-white/[.03] p-5"><div className="flex items-center gap-2 mb-5"><Eye className="w-4 h-4 text-violet-400"/><h3 className="font-semibold">Global Theme</h3></div><label className="block text-xs text-white/50 mb-2">Primary Color</label><input type="color" value={config.theme.primaryColor} onChange={(e) => updateTheme('primaryColor', e.target.value)} className="w-full h-10 mb-5 bg-transparent"/><label className="block text-xs text-white/50 mb-2">Secondary Color</label><input type="color" value={config.theme.secondaryColor} onChange={(e) => updateTheme('secondaryColor', e.target.value)} className="w-full h-10 mb-5 bg-transparent"/><label className="block text-xs text-white/50 mb-2">Background</label><input type="color" value={config.theme.backgroundColor} onChange={(e) => updateTheme('backgroundColor', e.target.value)} className="w-full h-10 mb-5 bg-transparent"/><label className="block text-xs text-white/50 mb-2">Surface</label><input type="color" value={config.theme.surfaceColor} onChange={(e) => updateTheme('surfaceColor', e.target.value)} className="w-full h-10 mb-5 bg-transparent"/><label className="block text-xs text-white/50 mb-2">Border Radius: {config.theme.borderRadius}px</label><input type="range" min="0" max="32" value={config.theme.borderRadius} onChange={(e) => updateTheme('borderRadius', Number(e.target.value))} className="w-full"/></div>
          <div className="rounded-xl border border-white/10 bg-white/[.03] p-5"><div className="flex items-center gap-2 mb-4"><History className="w-4 h-4 text-violet-400"/><h3 className="font-semibold">Published Versions</h3></div>{versions.length === 0 ? <p className="text-xs text-white/40">No published versions yet.</p> : <div className="space-y-2 max-h-72 overflow-auto">{versions.map((version) => <div key={version.id} className="flex items-center justify-between rounded-lg bg-white/5 p-2.5"><div><p className="text-sm font-semibold">Version {version.version}</p><p className="text-[10px] text-white/40">{new Date(version.created_at).toLocaleString()}</p></div><button onClick={() => restoreVersion(version)} className="rounded-md bg-white/10 px-2 py-1 text-xs hover:bg-white/15"><RotateCcw className="mr-1 inline h-3 w-3"/>Load</button></div>)}</div>}</div>
        </aside>
      </div>
    </div>
  </div>;
}
