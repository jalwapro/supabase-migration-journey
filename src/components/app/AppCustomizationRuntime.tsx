import { useEffect, useState, type ReactNode } from 'react';
import { loadPublishedAppCustomization } from '@/lib/published-app-customization';
import type { AppCustomizationConfig, AppPage, AppComponentConfig } from '@/lib/app-customization';

export function AppCustomizationRuntime({ page, children }: { page: AppPage; children?: ReactNode }) {
  const [config, setConfig] = useState<AppCustomizationConfig | null>(null);

  useEffect(() => {
    let alive = true;
    loadPublishedAppCustomization().then((value) => alive && setConfig(value));
    return () => { alive = false; };
  }, []);

  if (!config) return <>{children}</>;
  const pageConfig = config.pages[page];
  if (!pageConfig?.enabled) return null;

  return <div style={{ minHeight: '100%', background: pageConfig.background || config.theme.backgroundColor, color: config.theme.textColor, fontFamily: config.theme.fontFamily, position: 'relative' }}>
    {children}
    {pageConfig.components.filter((item) => item.visible).sort((a, b) => a.zIndex - b.zIndex).map((item) => <PublishedComponent key={item.id} item={item} theme={config.theme} />)}
  </div>;
}

function PublishedComponent({ item, theme }: { item: AppComponentConfig; theme: AppCustomizationConfig['theme'] }) {
  const style = { position: 'absolute' as const, left: item.x, top: item.y, width: item.width, height: item.height, zIndex: item.zIndex, borderRadius: theme.borderRadius };
  if (item.type === 'text') return <div style={{ ...style, padding: 12, color: theme.textColor }}>{String(item.props.text ?? '')}</div>;
  if (item.type === 'image') return <img src={String(item.props.src ?? '')} alt="" style={{ ...style, objectFit: 'cover' }} />;
  if (item.type === 'grid') return <div style={{ ...style, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: 8, background: theme.surfaceColor }} />;
  return <div style={{ ...style, padding: 16, background: theme.surfaceColor, color: theme.textColor }}>{String(item.props.text ?? '')}</div>;
}
