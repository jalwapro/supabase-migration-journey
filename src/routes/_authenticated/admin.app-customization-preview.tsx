import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { AdminPageHeader } from '@/components/admin/AdminShell';
import { Monitor, Smartphone, Tablet, ExternalLink, RefreshCw } from 'lucide-react';

export const Route = createFileRoute('/_authenticated/admin/app-customization-preview')({ component: ExistingAppPreview });

type Device = 'mobile' | 'tablet' | 'desktop';

const pages = [
  ['home', '/', 'Home'],
  ['discover', '/discover', 'Discover'],
  ['live', '/live', 'Live'],
  ['rooms', '/rooms', 'Rooms'],
  ['profile', '/profile', 'Profile'],
  ['wallet', '/wallet', 'Wallet'],
  ['recharge', '/recharge', 'Recharge'],
  ['gifts', '/gifts', 'Gifts'],
  ['ranking', '/ranking', 'Ranking'],
  ['chat', '/chat', 'Chat'],
  ['messages', '/messages', 'Messages'],
  ['notifications', '/notifications', 'Notifications'],
  ['settings', '/settings', 'Settings'],
  ['login', '/login', 'Login'],
  ['register', '/register', 'Register'],
  ['splash', '/splash', 'Splash'],
];

function ExistingAppPreview() {
  const [page, setPage] = useState('home');
  const [device, setDevice] = useState<Device>('mobile');
  const [reloadKey, setReloadKey] = useState(0);
  const selected = pages.find(([key]) => key === page) ?? pages[0];
  const src = useMemo(() => `${window.location.origin}${selected[1]}?adminPreview=1`, [selected]);
  const width = device === 'mobile' ? 390 : device === 'tablet' ? 768 : 1180;

  return (
    <div className="-m-4 min-h-[calc(100vh-64px)] bg-muted/20 md:-m-6 lg:-m-8">
      <div className="sticky top-0 z-30 border-b bg-background/95 px-4 py-3 backdrop-blur md:px-6">
        <AdminPageHeader
          title="App Customization — Live App Preview"
          subtitle="Admin-only preview of the existing user app. This page does not modify the user app."
          right={
            <div className="flex items-center gap-2">
              <button className="rounded-lg border p-2" onClick={() => setReloadKey((v) => v + 1)} title="Reload preview"><RefreshCw className="h-4 w-4" /></button>
              <a className="rounded-lg border px-3 py-2 text-sm" href={src} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 inline h-4 w-4" />Open App</a>
            </div>
          }
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select value={page} onChange={(e) => setPage(e.target.value)} className="rounded-lg border bg-background px-3 py-2 text-sm">
            {pages.map(([key, , label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          {(['mobile', 'tablet', 'desktop'] as Device[]).map((d) => (
            <button key={d} onClick={() => setDevice(d)} className={`rounded-full px-3 py-1.5 text-xs ${device === d ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              {d === 'mobile' ? <Smartphone className="mr-1 inline h-3.5 w-3.5" /> : d === 'tablet' ? <Tablet className="mr-1 inline h-3.5 w-3.5" /> : <Monitor className="mr-1 inline h-3.5 w-3.5" />}{d}
            </button>
          ))}
          <span className="ml-auto text-xs text-muted-foreground">{selected[2]} • {width}px • preview only</span>
        </div>
      </div>

      <main className="flex min-h-[calc(100vh-160px)] justify-center overflow-auto bg-zinc-950 p-4 md:p-8">
        <div style={{ width, maxWidth: '100%' }} className="transition-all">
          <div className="mb-2 flex items-center justify-between text-[10px] text-zinc-400">
            <span>EXISTING USER APP — ADMIN PREVIEW</span>
            <span>Customization is not applied to this frame</span>
          </div>
          <div className="overflow-hidden rounded-[28px] border border-zinc-700 bg-black shadow-2xl" style={{ minHeight: device === 'desktop' ? 760 : 780 }}>
            <iframe
              key={`${src}-${reloadKey}`}
              title={`Existing ${selected[2]} app preview`}
              src={src}
              className="h-[780px] w-full border-0 bg-black"
              style={{ display: 'block' }}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
