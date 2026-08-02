import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Headphones,
  Loader2,
  LogOut,
  Mic,
  MicOff,
  Radio,
  ShieldCheck,
  UserX,
  Users,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useZegoRoom } from "@/hooks/useZegoRoom";
import {
  SUPPORT_CHANNEL,
  uidFromUuid,
  useSupportActions,
  useSupportRoomState,
} from "@/lib/support-room";

export const Route = createFileRoute("/_authenticated/support-room")({
  head: () => ({
    meta: [
      { title: "24/7 Customer Support Voice Room | Jalwa" },
      {
        name: "description",
        content: "Talk to a Jalwa support host live, any time. One host, two callers, everyone else waits in a fair queue.",
      },
      { property: "og:title", content: "Jalwa 24/7 Voice Support" },
      { property: "og:description", content: "Live voice help from the Jalwa support team, around the clock." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SupportRoomPage,
});

function SupportRoomPage() {
  const { user } = useAuth();
  const state = useSupportRoomState();
  const { join, leave, goLive, endSession, kick, setMute } = useSupportActions();
  const [reason, setReason] = useState("");

  const s = state.data;
  const isHost = !!s?.is_host;
  const seated = s?.my_seat != null;
  const connected = isHost ? !!s?.online && s?.host?.id === user?.id : seated;

  const myUid = useMemo(() => (user ? uidFromUuid(user.id) : null), [user]);

  const zego = useZegoRoom({
    channel: connected ? SUPPORT_CHANNEL : null,
    uid: myUid,
    publish: connected,
    video: false,
    enabled: connected,
    kind: "voice",
  });

  // Leaving the page frees the seat / queue slot for the next caller.
  useEffect(() => {
    return () => {
      if (!isHost) void leave.mutateAsync().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost]);

  const handleJoin = async () => {
    try {
      const res = await join.mutateAsync(reason.trim() || undefined);
      if (res.status === "seated") toast.success(`Connected — seat ${res.seat}`);
      else if (res.status === "waiting") toast.info(`You're #${res.position} in the queue`);
    } catch (e) {
      toast.error((e as Error).message.replace(/_/g, " ").toLowerCase());
    }
  };

  return (
    <div className="min-h-[100svh] bg-background">
      <header
        className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <Link to="/" aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 truncate text-base font-black">
              <Headphones className="h-4 w-4 text-[color:var(--primary)]" />
              {s?.config.title ?? "24/7 Customer Support"}
            </h1>
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              {s?.online ? "Support host online" : "No host online"}
            </p>
          </div>
          <span
            className={`ml-auto flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${
              s?.online ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground"
            }`}
          >
            <Radio className="h-3 w-3" /> {s?.online ? "LIVE" : "OFFLINE"}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-4 py-4 pb-32">
        {state.isLoading && (
          <div className="grid place-items-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}

        {s?.config.announcement && (
          <p className="rounded-2xl border border-[color:var(--primary)]/30 bg-[color:var(--primary)]/10 p-3 text-sm">
            {s.config.announcement}
          </p>
        )}
        {s && !s.config.enabled && (
          <p className="rounded-2xl border border-border bg-card p-4 text-center text-sm text-muted-foreground">
            Voice support is currently disabled. Please open a support ticket instead.
          </p>
        )}
        {s?.config.maintenance && (
          <p className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-center text-sm text-amber-300">
            Support room is under maintenance. Back shortly.
          </p>
        )}

        {/* Host + caller seats */}
        <section className="rounded-3xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <Avatar url={s?.host?.avatar ?? null} name={s?.host?.username ?? "Support"} ring="gold" />
            <div>
              <p className="text-sm font-bold">{s?.host?.username ?? "Waiting for host"}</p>
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <ShieldCheck className="h-3 w-3 text-emerald-400" /> Verified support host
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {Array.from({ length: s?.config.max_users ?? 2 }).map((_, i) => {
              const seat = s?.seats.find((x) => x.seat === i + 1);
              return (
                <div key={i} className="rounded-2xl border border-border bg-background/50 p-3 text-center">
                  <Avatar url={seat?.user.avatar ?? null} name={seat?.user.username ?? `Seat ${i + 1}`} />
                  <p className="mt-2 truncate text-xs font-semibold">{seat?.user.username ?? "Empty"}</p>
                  {seat?.muted && (
                    <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-red-400">
                      <MicOff className="h-3 w-3" /> muted
                    </span>
                  )}
                  {seat && (isHost || s?.is_admin) && (
                    <div className="mt-2 flex justify-center gap-2">
                      <button
                        onClick={() => setMute.mutate({ userId: seat.user.id, muted: !seat.muted })}
                        className="rounded-full border border-border p-1.5"
                        aria-label="Toggle mute"
                      >
                        {seat.muted ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={() => kick.mutate({ userId: seat.user.id })}
                        className="rounded-full border border-red-500/40 p-1.5 text-red-400"
                        aria-label="Remove caller"
                      >
                        <UserX className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="mt-3 flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
            <Users className="h-3 w-3" /> {s?.queue_count ?? 0} waiting
            {!seated && !isHost && s?.my_position ? ` · you are #${s.my_position}` : ""}
          </p>
        </section>

        {/* Connection status */}
        {connected && (
          <p className="text-center text-[11px] text-muted-foreground">
            Voice: {zego.status}
            {zego.error ? ` — ${zego.error}` : ""}
          </p>
        )}

        {/* Controls */}
        {isHost ? (
          <div className="space-y-2">
            {s?.online && s.host?.id === user?.id ? (
              <button
                onClick={() => endSession.mutate()}
                className="w-full rounded-2xl bg-red-500 py-3 text-sm font-black text-white"
              >
                End Support Session
              </button>
            ) : (
              <button
                onClick={() =>
                  goLive.mutate(undefined, {
                    onError: (e) => toast.error((e as Error).message.replace(/_/g, " ").toLowerCase()),
                    onSuccess: () => toast.success("You are live for support"),
                  })
                }
                className="w-full rounded-2xl bg-[color:var(--primary)] py-3 text-sm font-black text-white"
              >
                Go Live as Support Host
              </button>
            )}
            {connected && (
              <button
                onClick={() => zego.toggleMute()}
                className="w-full rounded-2xl border border-border bg-card py-3 text-sm font-bold"
              >
                {zego.muted ? "Unmute microphone" : "Mute microphone"}
              </button>
            )}
          </div>
        ) : seated ? (
          <div className="space-y-2">
            <button
              onClick={() => zego.toggleMute()}
              className="w-full rounded-2xl border border-border bg-card py-3 text-sm font-bold"
            >
              {zego.muted ? "Unmute microphone" : "Mute microphone"}
            </button>
            <button
              onClick={() => leave.mutate()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500 py-3 text-sm font-black text-white"
            >
              <LogOut className="h-4 w-4" /> Leave support room
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={120}
              placeholder="What do you need help with? (optional)"
              className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm"
            />
            <button
              onClick={handleJoin}
              disabled={join.isPending || !s?.online || !s?.config.enabled || s?.config.maintenance}
              className="w-full rounded-2xl bg-[color:var(--primary)] py-3 text-sm font-black text-white disabled:opacity-50"
            >
              {join.isPending ? "Connecting…" : s?.my_position ? "Refresh queue position" : "Talk to support"}
            </button>
            {!!s?.my_position && (
              <button
                onClick={() => leave.mutate()}
                className="w-full rounded-2xl border border-border bg-card py-3 text-sm font-bold"
              >
                Leave the queue
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function Avatar({ url, name, ring }: { url: string | null; name: string; ring?: "gold" }) {
  return (
    <div
      className={`mx-auto grid h-14 w-14 place-items-center overflow-hidden rounded-full border-2 ${
        ring === "gold" ? "border-[color:var(--gold)]" : "border-border"
      } bg-background`}
    >
      {url ? (
        <img src={url} alt={name} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <span className="text-sm font-black text-muted-foreground">{name.slice(0, 1).toUpperCase()}</span>
      )}
    </div>
  );
}
