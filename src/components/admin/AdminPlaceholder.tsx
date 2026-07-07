import { AdminPageHeader } from "./AdminShell";
import { Construction } from "lucide-react";
import type { ReactNode } from "react";

export function AdminPlaceholder({
  title,
  subtitle,
  bullets,
  children,
}: {
  title: string;
  subtitle?: string;
  bullets?: string[];
  children?: ReactNode;
}) {
  return (
    <>
      <AdminPageHeader title={title} subtitle={subtitle} />
      <div className="glass rounded-2xl border border-dashed border-border p-8 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[color:var(--gold)]/10 text-[color:var(--gold)]">
          <Construction className="h-5 w-5" />
        </div>
        <h3 className="mt-3 font-bold">Module ready — UI coming soon</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Schema and grants are live on Supabase. This admin screen will be wired next.
        </p>
        {bullets && bullets.length > 0 && (
          <ul className="mx-auto mt-4 max-w-md space-y-1 text-left text-xs text-muted-foreground">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[color:var(--gold)]" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}
        {children}
      </div>
    </>
  );
}
