import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_APP_CUSTOMIZATION, type AppCustomizationConfig, type AppComponentConfig, type AppPage } from '@/lib/app-customization';

function currentPage(): AppPage {
  if (typeof window === 'undefined') return 'home';
  const path = window.location.pathname;
  if (path.includes('/wallet')) return 'wallet';
  if (path.includes('/profile') || path === '/me') return 'profile';
  if (path.includes('/pk')) return 'pk';
  if (path.includes('/video')) return 'video';
  if (path.includes('/voice') || path.includes('/room/')) return 'voice';
  if (path.includes('/navigation')) return 'navigation';
  if (path.includes('/popup')) return 'popups';
  return 'home';
}

export function PublishedAppConfig() {
  const [config, setConfig] = useState<AppCustomizationConfig>(DEFAULT_APP_CUSTOMIZATION);
  const [page, setPage] = useState<AppPage>(currentPage);

  useEffect(() => {
    let cancelled = false;
    const apply = (value: AppCustomizationConfig) => {
      if (cancelled || typeof document === 'undefined') return;
      setConfig(value);
      const root = document.documentElement;
      root.style.setProperty('--app-custom-primary', value.theme.primaryColor);
      root.style.setProperty('--app-custom-secondary', value.theme.secondaryColor);
      root.style.setProperty('--app-custom-background', value.theme.backgroundColor);
      root.style.setProperty('--app-custom-surface', value.theme.surfaceColor);
      root.style.setProperty('--app-custom-accent', value.theme.accentColor);
      root.style.setProperty('--app-custom-radius', `${value.theme.borderRadius}px`);
      root.dataset.appConfigVersion = String(value.version);
      window.dispatchEvent(new CustomEvent('jalwa:app-config', { detail: value }));
    };
    const load = async () => {
      const { data } = await supabase.rpc('get_published_app_customization');
      if (cancelled) return;
      const value = data as unknown;
      if (value && typeof value === 'object' && 'theme' in value) apply(value as AppCustomizationConfig);
      else apply(DEFAULT_APP_CUSTOMIZATION);
    };
    void load();
    const onRoute = () => setPage(currentPage());
    window.addEventListener('popstate', onRoute);
    const channel = supabase.channel('published-app-customization').on('postgres_changes', { event: '*', schema: 'public', table: 'app_customizations' }, () => void load()).subscribe();
    return () => { cancelled = true; window.removeEventListener('popstate', onRoute); void supabase.removeChannel(channel); };
  }, []);

  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) return null;
  const pageConfig = config.pages[page];
  if (!pageConfig?.enabled || pageConfig.components.length === 0) return null;

  return <>
    {pageConfig.components.filter((item) => item.visible).sort((a, b) => a.zIndex - b.zIndex).map((item) => <PublishedComponent key={item.id} item={item} config={config} />)}
  </>;
}

function PublishedComponent({ item, config }: { item: AppComponentConfig; config: AppCustomizationConfig }) {
  const base = { position: 'fixed' as const, left: item.x, top: item.y, width: item.width, height: item.height, zIndex: 40 + item.zIndex, borderRadius: config.theme.borderRadius, fontFamily: config.theme.fontFamily };
  if (item.type === 'text') return <div style={{ ...base, padding: 12, color: config.theme.textColor, pointerEvents: 'none' }}>{String(item.props.text ?? '')}</div>;
  if (item.type === 'image') return <div style={{ ...base, overflow: 'hidden' }}>{item.props.src ? <img src={String(item.props.src)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}</div>;
  if (item.type === 'button') return <button style={{ ...base, border: 0, color: '#fff', background: config.theme.primaryColor }}>{String(item.props.text ?? 'Button')}</button>;
  if (item.type === 'grid') return <div style={{ ...base, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: 8, background: config.theme.surfaceColor }} />;
  return <div style={{ ...base, padding: 16, background: config.theme.surfaceColor, color: config.theme.textColor }}>{String(item.props.text ?? '')}</div>;
}
