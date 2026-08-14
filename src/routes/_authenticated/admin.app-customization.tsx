import { createFileRoute } from '@tanstack/react-router';
import { AppBuilderV2 } from '@/components/customization/AppBuilderV2';

export const Route = createFileRoute('/_authenticated/admin/app-customization')({ component: AppCustomization });

function AppCustomization() {
  return (
    <div data-customization-studio-version="builder-v2" className="h-full min-h-0">
      <AppBuilderV2 />
    </div>
  );
}
