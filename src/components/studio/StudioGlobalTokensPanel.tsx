import { useEffect, useState } from "react";
import { DEFAULT_GLOBAL_TOKENS, applyGlobalTokens, loadPublishedGlobalTokens, publishDraftGlobalTokens, saveDraftGlobalTokens, type GlobalDesignTokens } from "@/lib/app-customization/global-tokens";

const groups = ["colors", "typography", "spacing", "radius", "shadows", "fonts"] as const;
type Group = typeof groups[number];

export function StudioGlobalTokensPanel() {
  const [tokens, setTokens] = useState<GlobalDesignTokens>(DEFAULT_GLOBAL_TOKENS);
  const [group, setGroup] = useState<Group>("colors");
  const [state, setState] = useState("Loading…");

  useEffect(() => { let cancelled = false; loadPublishedGlobalTokens().then(v => { if (!cancelled) { setTokens(v); applyGlobalTokens(v); setState("Published"); } }).catch(() => !cancelled && setState("Defaults")); return () => { cancelled = true; }; }, []);

  const update = (key: string, value: string) => setTokens(prev => ({ ...prev, [group]: { ...prev[group], [key]: value } }));
  const save = async () => { setState("Saving…"); try { await saveDraftGlobalTokens(tokens); applyGlobalTokens(tokens); setState("Draft saved ✓"); } catch { setState("Save failed"); } };
  const publish = async () => { setState("Publishing…"); try { await saveDraftGlobalTokens(tokens); await publishDraftGlobalTokens(); applyGlobalTokens(tokens); setState("Published ✓"); } catch { setState("Publish failed"); } };

  return <section className="flex h-full min-h-0 flex-col bg-background text-foreground">
    <header className="flex items-center justify-between border-b border-border px-4 py-3"><div><h3 className="text-sm font-semibold">Global Design Tokens</h3><p className="text-[10px] text-muted-foreground">Colors, typography, spacing, radius, shadows and fonts</p></div><span className="text-[10px] text-muted-foreground">{state}</span></header>
    <div className="flex min-h-0 flex-1">
      <nav className="w-32 shrink-0 border-r border-border p-2">{groups.map(item => <button key={item} onClick={() => setGroup(item)} className={`mb-1 w-full rounded px-2 py-1.5 text-left text-[10px] capitalize ${group === item ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{item}</button>)}</nav>
      <div className="min-w-0 flex-1 overflow-auto p-4"><div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{Object.entries(tokens[group]).map(([key, value]) => <label key={key} className="block"><span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{key}</span><input className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary" value={String(value)} onChange={e => update(key, e.target.value)} /></label>)}</div></div>
    </div>
    <footer className="flex items-center justify-end gap-2 border-t border-border p-3"><button onClick={() => { setTokens(DEFAULT_GLOBAL_TOKENS); applyGlobalTokens(DEFAULT_GLOBAL_TOKENS); setState("Defaults applied"); }} className="rounded-md border border-border px-3 py-1.5 text-xs">Reset</button><button onClick={save} className="rounded-md border border-border px-3 py-1.5 text-xs">Save Draft</button><button onClick={publish} className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground">Publish Tokens</button></footer>
  </section>;
}
