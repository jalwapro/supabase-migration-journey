import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_APP_CUSTOMIZATION, type AppCustomizationConfig } from './app-customization';

let cachedConfig: AppCustomizationConfig | null = null;

export async function loadPublishedAppCustomization(force = false): Promise<AppCustomizationConfig> {
  if (cachedConfig && !force) return cachedConfig;
  const { data, error } = await supabase.rpc('get_published_app_customization');
  if (error || !data || typeof data !== 'object') {
    cachedConfig = DEFAULT_APP_CUSTOMIZATION;
    return cachedConfig;
  }
  cachedConfig = { ...DEFAULT_APP_CUSTOMIZATION, ...(data as Partial<AppCustomizationConfig>) };
  return cachedConfig;
}

export function clearPublishedAppCustomizationCache() {
  cachedConfig = null;
}
