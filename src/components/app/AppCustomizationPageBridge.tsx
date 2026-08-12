import { PublishedAppComponents } from './PublishedAppComponents';
import type { AppCustomizationConfig, AppPage } from '@/lib/app-customization';

export function AppCustomizationPageBridge({ page, children }: { page: AppPage; children?: React.ReactNode }) {
  return <div className="relative min-h-full"><PublishedAppComponents page={page} />{children}</div>;
}
