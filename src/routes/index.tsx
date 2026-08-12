import { useEffect, useMemo, useState } from 'react';
import { loadHomeSectionSettings, DEFAULT_HOME_SECTIONS, type HomeSectionId, type HomeSectionSetting } from '@/lib/home-customization';

export function usePublishedHomeSections() {
  const [sections, setSections] = useState<HomeSectionSetting[]>(DEFAULT_HOME_SECTIONS);
  useEffect(() => { let active = true; const load = () => loadHomeSectionSettings().then((value) => active && setSections(value)); load(); const handler = () => load(); window.addEventListener('jalwa:app-config', handler); return () => { active = false; window.removeEventListener('jalwa:app-config', handler); }; }, []);
  return useMemo(() => { const map = new Map(sections.map((s) => [s.id, s])); return { sections, visible: (id: HomeSectionId) => map.get(id)?.visible !== false, setting: (id: HomeSectionId) => map.get(id) ?? DEFAULT_HOME_SECTIONS.find((s) => s.id === id)! }; }, [sections]);
}
