import { createFileRoute } from '@tanstack/react-router';
import { AppBuilder } from '@/components/customization/AppBuilder';

export const Route = createFileRoute('/_authenticated/admin/app-customization')({ component: AppCustomization });

function AppCustomization() {
  return <AppBuilder />;
}
