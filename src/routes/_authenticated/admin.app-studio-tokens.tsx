import { createFileRoute } from "@tanstack/react-router";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { StudioGlobalTokensPanel } from "@/components/studio/StudioGlobalTokensPanel";

export const Route = createFileRoute("/_authenticated/admin/app-studio-tokens")({ component: AppStudioTokens });

function AppStudioTokens() {
  return <div className="-m-4 min-h-[calc(100vh-64px)] bg-muted/20 md:-m-6 lg:-m-8">
    <div className="border-b border-border bg-background px-4 py-3 md:px-6"><AdminPageHeader title="App Studio — Global Design Tokens" subtitle="One global design system for the real Jalwa application." /></div>
    <div className="p-4 md:p-6"><div className="mx-auto min-h-[650px] max-w-5xl overflow-hidden rounded-xl border border-border bg-background shadow-sm"><StudioGlobalTokensPanel /></div></div>
  </div>;
}
