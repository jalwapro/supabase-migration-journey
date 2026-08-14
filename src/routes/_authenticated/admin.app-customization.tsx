import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/admin/app-customization')({ component: AppCustomization });

function AppCustomization() {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-background p-5">
        <h1 className="text-xl font-bold">Customization Studio</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reset complete. We will rebuild the User App visual editor one step at a time.
        </p>
      </div>
      <div className="rounded-xl border bg-background p-5">
        <p className="font-semibold">Step 1 — Home</p>
        <p className="mt-1 text-sm text-muted-foreground">
          No theme editor, iframe editor, or automatic layout changes are active yet.
        </p>
      </div>
    </div>
  );
}
