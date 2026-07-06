import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { Mic, Video, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/create-room")({
  component: CreateRoom,
});

type Category = { id: string; name: string; slug: string; icon: string | null };

function CreateRoom() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"voice" | "video">("voice");
  const [seats, setSeats] = useState(8);
  const [locked, setLocked] = useState(false);
  const [password, setPassword] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const cats = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id,name,slug,icon")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data as Category[];
    },
  });

  async function create() {
    if (!user) return;
    if (!title.trim()) {
      toast.error("Give your room a title");
      return;
    }
    setBusy(true);
    const channel = `jalwa-${crypto.randomUUID().slice(0, 12)}`;
    const { data, error } = await supabase
      .from("live_rooms")
      .insert({
        host_id: user.id,
        title: title.trim(),
        room_type: type,
        seat_count: seats,
        is_locked: locked,
        password: locked ? password || null : null,
        category_id: categoryId,
        agora_channel: channel,
      })
      .select("id")
      .single();
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("You're live!");
    navigate({ to: "/room/$roomId", params: { roomId: data.id } });
  }

  return (
    <>
      <AppShell title="Go Live" subtitle="Create your party">
        <div className="space-y-5 px-4 pt-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Room title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Friday night vibes 🎉"
              maxLength={60}
              className="w-full rounded-2xl border border-border bg-card/60 px-4 py-3 outline-none focus:border-[color:var(--primary)]"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(["voice", "video"] as const).map((t) => {
                const Icon = t === "video" ? Video : Mic;
                const active = type === t;
                return (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`flex items-center justify-center gap-2 rounded-2xl border py-4 font-semibold capitalize transition ${
                      active
                        ? "border-transparent bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--secondary)] text-primary-foreground"
                        : "border-border bg-card/60 text-foreground/80"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Category
            </label>
            <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
              {(cats.data ?? []).map((c) => {
                const active = categoryId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setCategoryId(active ? null : c.id)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                      active
                        ? "bg-gradient-to-r from-[color:var(--primary)] to-[color:var(--secondary)] text-primary-foreground"
                        : "border border-border bg-card/60"
                    }`}
                  >
                    <span>{c.icon}</span>
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Seats · {seats}
            </label>
            <input
              type="range"
              min={2}
              max={12}
              value={seats}
              onChange={(e) => setSeats(Number(e.target.value))}
              className="w-full accent-[color:var(--primary)]"
            />
          </div>

          <div className="rounded-2xl border border-border bg-card/60 p-4">
            <label className="flex cursor-pointer items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Lock className="h-4 w-4" /> Lock room with password
              </span>
              <input
                type="checkbox"
                checked={locked}
                onChange={(e) => setLocked(e.target.checked)}
                className="h-5 w-5 accent-[color:var(--primary)]"
              />
            </label>
            {locked && (
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Room password"
                className="mt-3 w-full rounded-xl border border-border bg-input px-3 py-2 text-sm outline-none focus:border-[color:var(--primary)]"
              />
            )}
          </div>

          <button
            onClick={create}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--secondary)] py-4 text-base font-bold text-primary-foreground disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Go Live
          </button>
        </div>
      </AppShell>
      <BottomNav />
    </>
  );
}
