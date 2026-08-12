import { useEffect, useMemo, useState } from 'react';
import { loadPublishedAppCustomization } from '@/lib/published-app-customization';
import { DEFAULT_HOME_SECTIONS, type HomeSectionConfig } from '@/lib/app-customization';

export function useHomeCustomization() {
  const [sections, setSections] = useState<HomeSectionConfig[]>(DEFAULT_HOME_SECTIONS);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const config = await loadPublishedAppCustomization(true);
      if (active && config.homeSections) setSections(config.homeSections);
    };
    void load();
    const onConfig = (event: Event) => {
      const next = (event as CustomEvent<{ homeSections?: HomeSectionConfig[] }>).detail?.homeSections;
      if (next) setSections(next);
    };
    window.addEventListener('jalwa:app-config', onConfig);
    return () => { active = false; window.removeEventListener('jalwa:app-config', onConfig); };
  }, []);

  const byId = useMemo(() => new Map(sections.map((section) => [section.id, section])), [sections]);
  const isVisible = (id: HomeSectionConfig['id']) => byId.get(id)?.visible !== false;
  const order = (id: HomeSectionConfig['id']) => byId.get(id)?.order ?? 999;
  const title = (id: HomeSectionConfig['id'], fallback: string) => byId.get(id)?.title || fallback;
  return { sections: [...sections].sort((a, b) => a.order - b.order), isVisible, order, title };
}
