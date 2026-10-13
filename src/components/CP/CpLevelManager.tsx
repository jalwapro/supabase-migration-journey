import { useEffect, useState } from "react";
import { getCpLevels, saveCpLevel, type CpLevel } from "@/lib/cp/cpApi";

export default function CpLevelManager() {
  const [levels, setLevels] = useState<CpLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    getCpLevels()
      .then((rows) => { if (active) setLevels(rows); })
      .catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : "Could not load CP levels"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const patch = (level: number, update: Partial<CpLevel>) =>
    setLevels((current) => current.map((item) => item.level === level ? { ...item, ...update } : item));

  async function save(level: CpLevel) {
    setSaving(level.level); setError(""); setMessage("");
    try {
      await saveCpLevel(level);
      setMessage(`Level ${level.level} saved.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save CP level");
    } finally { setSaving(null); }
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading CP levels…</div>;

  return (
    <section className="mx-auto w-full max-w-5xl space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-bold">CP Levels & Assets</h1>
        <p className="mt-1 text-sm text-muted-foreground">Configure intimacy thresholds, joint seat frames, entrance effects and badges.</p>
      </header>
      {error && <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
      {message && <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">{message}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {levels.map((level) => (
          <article key={level.level} className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">Level {level.level}</h2>
              <span className="rounded-full bg-muted px-3 py-1 text-xs">{level.name}</span>
            </div>
            <label className="block text-sm">Level name
              <input className="mt-1 w-full rounded-lg border border-border bg-background p-2" value={level.name}
                onChange={(e) => patch(level.level, { name: e.target.value })} maxLength={40} />
            </label>
            <label className="block text-sm">Minimum intimacy
              <input type="number" min={0} step={1} className="mt-1 w-full rounded-lg border border-border bg-background p-2"
                value={level.min_intimacy} onChange={(e) => patch(level.level, { min_intimacy: Math.max(0, Number(e.target.value) || 0) })} />
            </label>
            {([
              ["seat_frame_url", "Joint seat frame URL"],
              ["entrance_effect_url", "Entrance effect URL (.webm)"],
              ["badge_url", "CP badge URL"],
            ] as const).map(([key, label]) => (
              <label key={key} className="block text-sm">{label}
                <input type="url" className="mt-1 w-full rounded-lg border border-border bg-background p-2"
                  placeholder="https://…" value={level[key] ?? ""}
                  onChange={(e) => patch(level.level, { [key]: e.target.value } as Partial<CpLevel>)} />
              </label>
            ))}
            <button type="button" disabled={saving !== null || !level.name.trim()}
              onClick={() => void save(level)}
              className="w-full rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50">
              {saving === level.level ? "Saving…" : "Save level"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
