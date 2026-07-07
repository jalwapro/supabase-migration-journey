import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { Mic, Video, Lock, Loader2, ArrowLeft, Radio, Plus, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/create-room")({
  component: CreateRoom,
});

type Category = { id: string; name: string; slug: string; icon: string | null };

function CreateRoom() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const hostName = profile?.username?.trim() || user?.email?.split("@")[0] || "jalwa";
  const autoTitle = `${hostName}'s Live`;
  const [type, setType] = useState<"voice" | "video">("voice");
  const [locked, setLocked] = useState(false);
  const [password, setPassword] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(true);
  const [seatCount, setSeatCount] = useState<number>(20);

  // Keep seat count valid for the current room type
  const setRoomType = (t: "voice" | "video") => {
    setType(t);
    if (t === "video" && ![1, 2, 4].includes(seatCount)) setSeatCount(1);
    if (t === "voice" && ![4, 6, 8, 12, 20].includes(seatCount)) setSeatCount(20);
  };

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

  const categoryList: Category[] =
    cats.data && cats.data.length > 0
      ? cats.data
      : [
          { id: "popular", name: "Popular", slug: "popular", icon: null },
          { id: "music", name: "Music", slug: "music", icon: null },
          { id: "gaming", name: "Gaming", slug: "gaming", icon: null },
          { id: "party", name: "Party", slug: "party", icon: null },
          { id: "chat", name: "Chat", slug: "chat", icon: null },
        ];

  async function create() {
    if (!user) return;
    setBusy(true);

    // One live room per user — jump to existing one if already live.
    const { data: existing } = await supabase
      .from("live_rooms")
      .select("id")
      .eq("host_id", user.id)
      .eq("status", "live")
      .maybeSingle();
    if (existing?.id) {
      setBusy(false);
      toast.info("You already have a live room — opening it.");
      navigate({ to: "/room/$roomId", params: { roomId: existing.id } });
      return;
    }

    const channel = `jalwa-${crypto.randomUUID().slice(0, 12)}`;
    const { data, error } = await supabase
      .from("live_rooms")
      .insert({
        host_id: user.id,
        title: autoTitle,
        room_type: type,
        seat_count: seatCount,
        is_locked: locked,
        password: locked ? password || null : null,
        category_id: categoryId,
        agora_channel: channel,
      })
      .select("id")
      .single();
    setBusy(false);
    if (error) {
      // Unique-index violation → user already has a live room
      if (error.code === "23505") {
        toast.error("You already have an active live room.");
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success("You're live!");
    navigate({ to: "/room/$roomId", params: { roomId: data.id } });
  }


  return (
    <>
      <main className="min-h-dvh bg-background pb-40">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-5">
          <button
            onClick={() => navigate({ to: "/" })}
            aria-label="Back"
            className="grid h-9 w-9 place-items-center rounded-full bg-card/70 border border-border"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-2xl font-extrabold tracking-tight">
            <span className="bg-gradient-to-r from-[color:var(--primary)] to-[color:var(--secondary)] bg-clip-text text-transparent">
              Live
            </span>{" "}
            Rooms
          </h1>
        </div>

        {/* Type selector cards */}
        <div className="mt-5 grid grid-cols-2 gap-3 px-4">
          <button
            onClick={() => {
              setType("voice");
              setSheetOpen(true);
            }}
            className={`relative overflow-hidden rounded-2xl border p-4 text-left transition ${
              type === "voice"
                ? "border-[color:var(--primary)]/60 bg-gradient-to-br from-[color:var(--primary)]/25 via-card to-card shadow-lg shadow-[color:var(--primary)]/10"
                : "border-border bg-card/60"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--secondary)] text-primary-foreground">
                <Mic className="h-5 w-5" />
              </span>
              <div>
                <div className="text-sm font-bold">Voice Room</div>
                <div className="text-[11px] text-muted-foreground">Audio party</div>
              </div>
            </div>
          </button>
          <button
            onClick={() => {
              setType("video");
              setSheetOpen(true);
            }}
            className={`relative overflow-hidden rounded-2xl border p-4 text-left transition ${
              type === "video"
                ? "border-[color:var(--gold)]/60 bg-gradient-to-br from-[color:var(--gold)]/25 via-card to-card shadow-lg shadow-[color:var(--gold)]/10"
                : "border-border bg-card/60"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-[color:var(--gold)] to-[color:var(--primary)] text-primary-foreground">
                <Video className="h-5 w-5" />
              </span>
              <div>
                <div className="text-sm font-bold">Live Video Room</div>
                <div className="text-[11px] text-muted-foreground">Camera live</div>
              </div>
            </div>
          </button>
        </div>

        {/* Empty state */}
        <div className="mt-4 px-4">
          <div className="rounded-2xl border border-border bg-card/60 px-6 py-8 text-center">
            <Radio className="mx-auto h-7 w-7 text-[color:var(--primary)]" />
            <p className="mt-3 text-sm font-bold">No live rooms yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Be the first to go live and start the party.
            </p>
            <button
              onClick={() => setSheetOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[color:var(--gold)] to-[color:var(--primary)] px-5 py-2 text-xs font-bold text-primary-foreground"
            >
              <Plus className="h-3.5 w-3.5" /> Create Room
            </button>
          </div>
        </div>
      </main>

      {/* Go Live bottom sheet */}
      {sheetOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setSheetOpen(false)}
          />
          <div
            className="fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 rounded-t-3xl border-t border-border bg-card p-5 shadow-2xl"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-extrabold">Go Live</h2>
              <button
                onClick={() => setSheetOpen(false)}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-full bg-background/60 border border-border"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
              Room title
            </label>
            <div className="w-full rounded-2xl border border-border bg-background/60 px-4 py-3 text-sm">
              <div className="font-semibold">{autoTitle}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                Auto-set from your profile · ID {user?.id?.slice(0, 8)}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {(["voice", "video"] as const).map((t) => {
                const Icon = t === "video" ? Video : Mic;
                const active = type === t;
                return (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`flex items-center justify-center gap-2 rounded-full py-3 text-sm font-bold capitalize transition ${
                      active
                        ? "bg-gradient-to-r from-[color:var(--primary)] to-[color:var(--secondary)] text-primary-foreground"
                        : "border border-border bg-background/60 text-foreground/80"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {t}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 scrollbar-hide flex gap-2 overflow-x-auto pb-1">
              {categoryList.map((c, i) => {
                const active = categoryId === c.id || (!categoryId && i === 0);
                return (
                  <button
                    key={c.id}
                    onClick={() => setCategoryId(active ? null : c.id)}
                    className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold ${
                      active
                        ? "bg-gradient-to-r from-[color:var(--destructive)] to-[color:var(--primary)] text-primary-foreground"
                        : "border border-border bg-background/60"
                    }`}
                  >
                    {c.icon ? `${c.icon} ` : ""}
                    {c.name}
                  </button>
                );
              })}
            </div>

            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                Seats
              </label>
              <div className="flex gap-2">
                {(type === "video"
                  ? ([
                      { n: 1, label: "Solo" },
                      { n: 2, label: "1 / 1" },
                      { n: 4, label: "2 / 2" },
                    ] as const)
                  : ([
                      { n: 4, label: "4" },
                      { n: 6, label: "6" },
                      { n: 8, label: "8" },
                      { n: 12, label: "12" },
                      { n: 20, label: "20" },
                    ] as const)
                ).map(({ n, label }) => {
                  const active = seatCount === n;
                  return (
                    <button
                      key={n}
                      onClick={() => setSeatCount(n)}
                      className={`flex-1 rounded-full py-2 text-xs font-bold transition ${
                        active
                          ? "bg-gradient-to-r from-[color:var(--primary)] to-[color:var(--secondary)] text-primary-foreground"
                          : "border border-border bg-background/60"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-border bg-background/60 p-3">
              <label className="flex cursor-pointer items-center justify-between gap-3">
                <span className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-card">
                    <Lock className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-bold">Private Room (PIN lock)</span>
                    <span className="block text-[11px] text-muted-foreground">
                      Only friends with the PIN can enter
                    </span>
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={locked}
                  onChange={(e) => setLocked(e.target.checked)}
                  className="h-5 w-9 accent-[color:var(--primary)]"
                />
              </label>
              {locked && (
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Room PIN"
                  className="mt-3 w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-[color:var(--primary)]"
                />
              )}
            </div>

            <button
              onClick={create}
              disabled={busy}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--secondary)] py-4 text-base font-extrabold text-primary-foreground disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
              Start Live Room
            </button>
          </div>
        </>
      )}

      <BottomNav />
      <Link to="/" className="hidden" />
    </>
  );
}
