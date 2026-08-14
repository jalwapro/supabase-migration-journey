import { createFileRoute } from '@tanstack/react-router';
import AppBuilderV3 from '@/components/customization/AppBuilderV3';

export const Route = createFileRoute('/_authenticated/admin/app-customization-v3')({
  component: AppCustomizationV3,
});

function AppCustomizationV3(){
  return <AppBuilderV3 />;
}
