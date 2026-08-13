import { useEffect, useState } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { CustomizationBuilderBridge } from './CustomizationBuilderBridge';

type ElementRule = { selector: string; styles?: Record<string, string>; responsive?: Record<string, Record<string, string>>; text?: string; visible?: boolean };
type PublishedConfig = { page?: string; theme?: Record<string, unknown>; navigation?: Record<string, unknown>; settings?: Record<string, unknown>; elements?: ElementRule[] };

const PAGE_KEYS: Record<string, string> = {
  '/': 'home', '/discover': 'discover', '/live': 'live', '/rooms': 'rooms', '/wallet': 'wallet', '/recharge': 'recharge',
  '/gifts': 'gifts', '/ranking': 'ranking', '/chat': 'chat', '/messages': 'messages', '/notifications': 'notifications',
  '/settings': 'settings', '/login': 'login', '/register': 'register', '/splash': 'splash', '/me': 'profile', '/profile': 'profile',
};
const toCssValue = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : '';
const getPageKey = (pathname: string) => PAGE_KEYS[pathname]
  ?? (pathname.startsWith('/room/') || pathname.startsWith('/voice-room/') ? 'voice-room'
  : pathname.startsWith('/video-room/') ? 'video-room'
  : pathname.startsWith('/profile/') || pathname.startsWith('/u/') ? 'profile'
  : pathname.startsWith('/pk/') ? 'pk-battle' : null);

function viewportDevice() {
  if (typeof window === 'undefined') return 'desktop';
  if (window.innerWidth < 640) return 'mobile';
  if (window.innerWidth < 1024) return 'tablet';
  return 'desktop';
}

export function PublishedCustomizationRuntime() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [config, setConfig] = useState<PublishedConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    const pageKey = getPageKey(pathname);
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
    const previousRoot: Record<string, string> = {};
    const theme = config?.theme ?? {};
    const mappings: Record<string, string[]> = {
      primary: ['--primary', '--primary-color'], primaryColor: ['--primary', '--primary-color'],
      accent: ['--accent', '--accent-color'], accentColor: ['--accent', '--accent-color'],
      background: ['--background', '--background-color'], backgroundColor: ['--background', '--background-color'],
      surface: ['--card', '--surface-color'], surfaceColor: ['--card', '--surface-color'],
      card: ['--card'], text: ['--foreground', '--text-color'], textColor: ['--foreground', '--text-color'],
      muted: ['--muted-foreground'], radius: ['--radius'], fontFamily: ['--font-customization'],
    };
    Object.entries(mappings).forEach(([key, cssVars]) => {
      const value = toCssValue(theme[key]); if (!value) return;
      cssVars.forEach((cssVar) => { if (!(cssVar in previousRoot)) previousRoot[cssVar] = root.style.getPropertyValue(cssVar); root.style.setProperty(cssVar, value); });
    });

    const previousElements: Array<{ el: HTMLElement; property: string; value: string }> = [];
    const device = viewportDevice();
    (config?.elements ?? []).forEach((rule) => {
      if (!rule.selector) return;
      try {
        document.querySelectorAll(rule.selector).forEach((node) => {
          const el = node as HTMLElement;
          const styles = { ...(rule.styles ?? {}), ...(rule.responsive?.[device] ?? {}) };
          Object.entries(styles).forEach(([property, value]) => {
            if (typeof value !== 'string') return;
            previousElements.push({ el, property, value: el.style.getPropertyValue(property) });
            el.style.setProperty(property, value);
          });
          if (rule.visible === false) {
            previousElements.push({ el, property: 'display', value: el.style.getPropertyValue('display') });
            el.style.setProperty('display', 'none');
          } else if (rule.visible === true) {
            previousElements.push({ el, property: 'display', value: el.style.getPropertyValue('display') });
            el.style.removeProperty('display');
          }
          if (typeof rule.text === 'string' && el.children.length === 0 && !el.matches('input,textarea,select')) {
            previousElements.push({ el, property: '__textContent__', value: el.textContent ?? '' });
            el.textContent = rule.text;
          }
        });
      } catch { /* invalid selector in an old config cannot break the app */ }
    });

    const title = toCssValue(config?.settings?.title);
    const previousTitle = document.title;
    if (title) document.title = title;

    return () => {
      Object.entries(previousRoot).forEach(([key, value]) => value ? root.style.setProperty(key, value) : root.style.removeProperty(key));
      previousElements.reverse().forEach(({ el, property, value }) => {
        if (property === '__textContent__') el.textContent = value;
        else if (value) el.style.setProperty(property, value);
        else el.style.removeProperty(property);
      });
      document.title = previousTitle;
    };
  }, [config]);

  return <CustomizationBuilderBridge />;
}
