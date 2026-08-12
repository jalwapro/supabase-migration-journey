import { useEffect, useState } from 'react';
import { loadPublishedAppCustomization } from '@/lib/published-app-customization';
import type { AppComponentConfig, AppCustomizationConfig } from '@/lib/app-customization';

export function PublishedAppComponents({ page }: { page: keyof AppCustomizationConfig['pages'] }) {
  const [config, setConfig] = useState<AppCustomizationConfig | null>(null);
  useEffect(() => { let active = true; loadPublishedAppCustomization().then((value) => { if (active) setConfig(value); }); return () => { active = false; }; }, []);
  const components = config?.pages?.[page]?.components?.filter((item) => item.visible) ?? [];
  if (!config || !components.length) return null;
  return <>{components.sort((a, b) => a.zIndex - b.zIndex).map((item) => <PublishedComponent key={item.id} item={item} config={config} />)}</>;
}

function PublishedComponent({ item, config }: { item: AppComponentConfig; config: AppCustomizationConfig }) {
  const style = { position: 'absolute' as const, left: item.x, top: item.y, width: item.width, height: item.height, zIndex: item.zIndex, borderRadius: config.theme.borderRadius, color: config.theme.textColor };
  if (item.type === 'text') return <div style={{ ...style, padding: 12 }}>{String(item.props.text ?? '')}</div>;
  if (item.type === 'image') return <div style={{ ...style, background: config.theme.surfaceColor, overflow: 'hidden' }}>{item.props.src ? <img src={String(item.props.src)} alt="" className="h-full w-full object-cover" /> : null}</div>;
  if (item.type === 'grid') return <div style={{ ...style, background: config.theme.surfaceColor, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, padding: 8 }} />;
  return <div style={{ ...style, background: config.theme.surfaceColor, padding: 16 }}>{String(item.props.text ?? '')}</div>;
}
