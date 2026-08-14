import { createFileRoute } from '@tanstack/react-router';
import { AppBuilderV2 } from '@/components/customization/AppBuilderV2';

export const Route = createFileRoute('/_authenticated/admin/app-customization')({ component: AppCustomization });

function AppCustomization() {
  return <AppBuilderV2 />;
}
