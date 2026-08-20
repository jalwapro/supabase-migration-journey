import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { Mic, Lock, Loader2, ArrowLeft, Radio, Plus, X } from "lucide-react";
import { toast } from "sonner";

type Category = { id: string; name: string; slug: string; icon: string | null };

export const Route = createFileRoute("/_authenticated/create-room")({ component: CreateRoom });

function CreateRoom() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const hostName = profile?.username?.trim() || user?.email?.split("@")[0] || "jalwa";
  const [locked, setLocked] = useState(false);
  const [password, setPassword] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(true);
  const [seatCount, setSeatCount] = useState(20);

  const cats = useQuery({
    queryKey: ["voice-room-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id,name,slug,icon").eq("active", true).order("sort_order");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });

  const categoryList = cats.data?.length
    ? cats.data.filter((c) => !/pk|battle|video/i.test(`${c.slug} ${c.name}`))
    : [
        { id: "popular", name: "Popular", slug: "popular", icon: null },
        { id: "music", name: "Music", slug: "music", icon: null },
        { id: "party", name: "Party", slug: "party", icon: null },
        { id: "chat", name: "Chat", slug: "chat", icon: null },
      ];

  async function create() {
    if (!user) return toast.error("Sign in required");
    if (busy) return;
    setBusy(true);
    try {
      const { data: existing } = await supabase.from("live_rooms").select("id").eq("host_id", user.id).eq("status", "live").maybeSingle();
      if (existing?.id) {
        toast.info("You already have a live room — opening it.");
        navigate({ to: "/room/$roomId", params: { roomId: existing.id } });
        return;
      }
      const channel = `jalwa-${crypto.randomUUID().slice(0, 12)}`;
      const { data, error } = await supabase.from("live_rooms").insert({
        host_id: user.id,
        title: `${hostName}'s Voice Room`,
        room_type: "voice",
        seat_count: seatCount,
        pk_battle: false,
        is_locked: locked,
        password: locked ? password || null : null,
        category_id: categoryId,
        rtc_channel: channel,
      }).select("id").maybeSingle();
      if (error) throw error;
      if (!data?.id) throw new Error("Room created but ID was not returned.");
      toast.success("Your Voice Room is live!");
      navigate({ to: "/room/$roomId", params: { roomId: data.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create Voice Room");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <main className="min-h-dvh bg-background pb-32">
        <div className="flex items-center gap-3 px-4 pt-5">
          <button onClick={() => navigate({ to: "/" })} aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card/70"><ArrowLeft className="h-4 w-4" /></button>
          <div><h1 className="text-2xl font-extrabold tracking-tight">Create Voice Room</h1><p className="text-xs text-muted-foreground">Start a live audio room for your community</p></div>
        </div>
        <section className="mx-4 mt-6 rounded-3xl border border-[color:var(--primary)]/30 bg-gradient-to-br from-[color:var(--primary)]/15 via-card to-card p-5"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--secondary)] shadow-lg"><Mic className="h-8 w-8 text-primary-foreground" /></div><h2 className="mt-4 text-center text-lg font-black">Voice Room</h2><p className="mt-1 text-center text-xs text-muted-foreground">Audio only · No camera · No battle</p></section>
        <section className="mt-4 px-4"><div className="rounded-2xl border border-border bg-card/60 p-4"><p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Voice Seats</p><div className="grid grid-cols-5 gap-2">{[4, 6, 8, 12, 20].map((n) => <button key={n} onClick={() => setSeatCount(n)} className={`rounded-full py-2 text-xs font-bold ${seatCount === n ? "bg-gradient-to-r from-[color:var(--primary)] to-[color:var(--secondary)] text-primary-foreground" : "border border-border bg-background/60"}`}>{n}</button>)}</div></div></section>
        <section className="mt-4 px-4"><div className="rounded-2xl border border-border bg-card/60 p-4"><p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Room Category</p><div className="flex gap-2 overflow-x-auto pb-1">{categoryList.map((category) => <button key={category.id} onClick={() => setCategoryId(categoryId === category.id ? null : category.id)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold ${categoryId === category.id ? "bg-gradient-to-r from-[color:var(--primary)] to-[color:var(--secondary)] text-primary-foreground" : "border border-border bg-background/60"}`}>{category.icon ? `${category.icon} ` : ""}{category.name}</button>)}</div></div></section>
      </main>
      {sheetOpen && <><div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setSheetOpen(false)} /><div className="fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 rounded-t-3xl border-t border-border bg-card p-5 shadow-2xl" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}><div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" /><div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-extrabold">Go Live</h2><p className="text-[11px] text-muted-foreground">Voice Room only</p></div><button onClick={() => setSheetOpen(false)} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full border border-border bg-background/60"><X className="h-4 w-4" /></button></div><div className="rounded-2xl border border-[color:var(--primary)]/30 bg-[color:var(--primary)]/10 p-3"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--secondary)]"><Mic className="h-5 w-5 text-primary-foreground" /></div><div><p className="font-bold">{hostName}'s Voice Room</p><p className="text-[11px] text-muted-foreground">Audio room · {seatCount} seats</p></div></div></div><div className="mt-4 flex items-center justify-between rounded-2xl border border-border bg-background/60 p-3"><div className="flex items-center gap-2"><Lock className="h-4 w-4" /><div><p className="text-xs font-bold">Private Room</p><p className="text-[10px] text-muted-foreground">Require a password to join</p></div></div><button onClick={() => setLocked((value) => !value)} className={`h-6 w-11 rounded-full p-1 transition ${locked ? "bg-primary" : "bg-white/15"}`}><span className={`block h-4 w-4 rounded-full bg-white transition ${locked ? "translate-x-5" : "translate-x-0"}`} /></button></div>{locked && <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Room password" className="mt-2 w-full rounded-2xl border border-border bg-background/60 px-4 py-3 text-sm outline-none" />}<button disabled={busy} onClick={create} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[color:var(--primary)] to-[color:var(--secondary)] py-3.5 text-sm font-extrabold text-primary-foreground shadow-lg disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Start Voice Room</button><div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-muted-foreground"><Radio className="h-3 w-3" /> Voice streaming only</div></div></>}
      <BottomNav />
    </>
  );
}
