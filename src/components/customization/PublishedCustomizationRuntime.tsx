import { useEffect, useState } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { CustomizationBuilderBridge } from './CustomizationBuilderBridge';

type ElementRule = { selector: string; styles?: Record<string, string>; text?: string; visible?: boolean };
type PublishedConfig = { page?: string; theme?: Record<string, unknown>; navigation?: Record<string, unknown>; settings?: Record<string, unknown>; elements?: ElementRule[] };

const PAGE_KEYS: Record<string, string> = {
  '/': 'home', '/discover': 'discover', '/live': 'live', '/rooms': 'rooms', '/wallet': 'wallet', '/recharge': 'recharge',
  '/gifts': 'gifts', '/ranking': 'ranking', '/chat': 'chat', '/messages': 'messages', '/notifications': 'notifications',
  '/settings': 'settings', '/login': 'login', '/register': 'register', '/splash': 'splash',
};
const toCssValue = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : '';

export function PublishedCustomizationRuntime() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [config, setConfig] = useState<PublishedConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    const pageKey = PAGE_KEYS[pathname] ?? (pathname.startsWith('/room/') ? 'voice-room' : pathname.startsWith('/profile/') || pathname.startsWith('/u/') ? 'profile' : null);
    if (!pageKey) { setConfig(null); return; }
    const load = async () => {
      const { data: page } = await supabase.from('app_customization_pages').select('id').eq('page_key', pageKey).maybeSingle();
      if (!page) { if (!cancelled) setConfig(null); return; }
      const { data, error } = await supabase.from('app_customization_published').select('config,is_current').eq('is_current', true).eq('page_id', page.id).maybeSingle();
      if (!cancelled) setConfig(error || !data ? null : (data.config as PublishedConfig));
    };
    void load();
    return () => { cancelled = true; };
  }, [pathname]);

  useEffect(() => {
    const root = document.documentElement;
    const previous: Record<string, string> = {};
    const theme = config?.theme ?? {};
    const mappings: Record<string, string> = { primary: '--primary', background: '--background', card: '--card', text: '--foreground', muted: '--muted-foreground', radius: '--radius', fontFamily: '--font-customization' };
    Object.entries(mappings).forEach(([key, cssVar]) => { const value = toCssValue(theme[key]); if (!value) return; previous[cssVar] = root.style.getPropertyValue(cssVar); root.style.setProperty(cssVar, value); });
    const title = toCssValue(config?.settings?.title);
    if (title) { previous['--customization-page-title'] = root.style.getPropertyValue('--customization-page-title'); root.style.setProperty('--customization-page-title', title); }

    const applied: Array<{ el: HTMLElement; styles: Record<string, string> }> = [];
    (config?.elements ?? []).forEach((rule) => {
      if (!rule.selector) return;
      try {
        document.querySelectorAll(rule.selector).forEach((node) => {
          const el = node as HTMLElement;
          const styles = rule.styles ?? {};
          Object.entries(styles).forEach(([key, value]) => el.style.setProperty(key, value));
          if (rule.visible === false) el.style.setProperty('display', 'none');
          if (rule.visible === true) el.style.removeProperty('display');
          if (typeof rule.text === 'string' && el.children.length === 0) el.textContent = rule.text;
          applied.push({ el, styles });
        });
      } catch { /* invalid selector in an old config cannot break the app */ }
    });
    return () => {
      Object.entries(previous).forEach(([key, value]) => root.style.setProperty(key, value));
      applied.forEach(({ el, styles }) => Object.keys(styles).forEach((key) => el.style.removeProperty(key)));
    };
  }, [config]);

  return <CustomizationBuilderBridge />;
}
