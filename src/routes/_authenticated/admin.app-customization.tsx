import { createFileRoute, Link } from '@tanstack/react-router';
import { LiveCustomizationStudio } from './admin.app-customization-live';

export const Route = createFileRoute('/_authenticated/admin/app-customization')({ component: AppCustomization });

function AppCustomization(){
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2 rounded-xl border bg-background p-2">
      <Link to="/admin/app-customization" className="rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground">Visual Editor</Link>
      <Link to="/admin/app-customization-assets" className="rounded-lg border px-3 py-2 text-xs">Assets</Link>
      <Link to="/admin/app-customization-navigation" className="rounded-lg border px-3 py-2 text-xs">Navigation</Link>
      <Link to="/admin/app-customization-preview" className="rounded-lg border px-3 py-2 text-xs">Preview</Link>
    </div>
    <LiveCustomizationStudio />
  </div>
}
