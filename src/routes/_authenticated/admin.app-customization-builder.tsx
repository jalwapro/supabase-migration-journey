import { createFileRoute } from '@tanstack/react-router';
import AppBuilderV3 from '@/components/customization/AppBuilderV3';

export const Route = createFileRoute('/_authenticated/admin/app-customization-builder')({
  component: AppCustomizationBuilder,
});

function AppCustomizationBuilder(){
  return <AppBuilderV3 />;
}
