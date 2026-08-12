import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_APP_CUSTOMIZATION, type AppCustomizationConfig } from '@/lib/app-customization';

export function PublishedAppConfig() {
  useEffect(() => {
    let cancelled = false;
    const apply = (config: AppCustomizationConfig) => {
      if (cancelled || typeof document === 'undefined') return;
      const root = document.documentElement;
      root.style.setProperty('--app-custom-primary', config.theme.primaryColor);
      root.style.setProperty('--app-custom-secondary', config.theme.secondaryColor);
      root.style.setProperty('--app-custom-background', config.theme.backgroundColor);
      root.style.setProperty('--app-custom-surface', config.theme.surfaceColor);
      root.style.setProperty('--app-custom-accent', config.theme.accentColor);
      root.style.setProperty('--app-custom-radius', `${config.theme.borderRadius}px`);
      root.dataset.appConfigVersion = String(config.version);
      window.dispatchEvent(new CustomEvent('jalwa:app-config', { detail: config }));
    };

    const load = async () => {
      const { data } = await supabase.rpc('get_published_app_customization');
      if (cancelled) return;
      const value = data as unknown;
      if (value && typeof value === 'object' && 'theme' in value) apply(value as AppCustomizationConfig);
      else apply(DEFAULT_APP_CUSTOMIZATION);
    };

    void load();
    const channel = supabase.channel('published-app-customization').on('postgres_changes', { event: '*', schema: 'public', table: 'app_customizations' }, () => void load()).subscribe();
    return () => { cancelled = true; void supabase.removeChannel(channel); };
  }, []);

  return null;
}
