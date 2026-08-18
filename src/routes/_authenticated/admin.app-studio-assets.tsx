import { createFileRoute } from "@tanstack/react-router";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { StudioAssetManager } from "@/components/studio/StudioAssetManager";

export const Route = createFileRoute("/_authenticated/admin/app-studio-assets")({ component: AppStudioAssets });

function AppStudioAssets() {
  return <div className="-m-4 min-h-[calc(100vh-64px)] bg-muted/20 md:-m-6 lg:-m-8">
    <div className="border-b border-border bg-background px-4 py-3 md:px-6"><AdminPageHeader title="App Studio — Assets & Fonts" subtitle="Manage real production assets used by the Jalwa visual editor." /></div>
    <div className="p-4 md:p-6"><div className="mx-auto min-h-[650px] max-w-7xl overflow-hidden rounded-xl border border-border bg-background shadow-sm"><StudioAssetManager /></div></div>
  </div>;
}
