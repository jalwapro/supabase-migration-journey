import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowLeft,
  Send,
  Loader2,
  Paperclip,
  Mic,
  Square,
  Image as ImageIcon,
  Lock,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { uploadToUserFolder } from "@/lib/uploads";

export const Route = createFileRoute("/messages_/$peerId")({
  component: DmThread,
});

type DM = {
  id: string;
  sender_id: string;
  recipient_id: string;
  message: string | null;
  kind: "text" | "image" | "video" | "file" | "voice" | "album";
  media_url: string | null;
  media_mime: string | null;
  duration_seconds: number | null;
  gallery_image_id: string | null;
  read_at: string | null;
  created_at: string;
};

type Img = { id: string; path: string; is_public: boolean };

function DmThread() {
  const { peerId } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<DM[]>([]);
  const [attachBusy, setAttachBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [showAlbum, setShowAlbum] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const mediaRec = useRef<MediaRecorder | null>(null);
  const recordChunks = useRef<Blob[]>([]);
  const recordStart = useRef<number>(0);

  const peer = useQuery({
    queryKey: ["profile", peerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,username,avatar,user_code,bubble")
        .eq("id", peerId)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; username: string | null; avatar: string | null; user_code: string | null; bubble: string | null } | null;
    },
  });

  const myBubble = useQuery({
    queryKey: ["my-bubble", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("bubble").eq("id", user!.id).maybeSingle();
      return (data?.bubble as string | null) ?? null;
    },
  });

  // My private gallery — for sharing into chat
  const myPrivateAlbum = useQuery({
    queryKey: ["my-private-album", user?.id],
    enabled: !!user && showAlbum,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gallery_images")
        .select("id, path, is_public")
        .eq("user_id", user!.id)
        .eq("is_public", false)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Img[];
    },
  });

  // Gallery images referenced in this thread — resolve paths for album kind
  const albumRefs = useQuery({
    queryKey: ["album-refs", messages.map((m) => m.gallery_image_id).filter(Boolean).join(",")],
    enabled: messages.some((m) => m.kind === "album" && m.gallery_image_id),
    queryFn: async () => {
      const ids = messages
        .filter((m) => m.kind === "album" && m.gallery_image_id)
        .map((m) => m.gallery_image_id as string);
      if (ids.length === 0) return {};
      const { data, error } = await supabase
        .from("gallery_images")
        .select("id, path")
        .in("id", ids);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const r of data ?? []) map[r.id as string] = r.path as string;
      return map;
    },
  });

  // Load history + mark read
  useEffect(() => {
    if (!user) return;
    let cancel = false;
    (async () => {
      const { data, error } = await supabase
        .from("direct_messages")
        .select("*")
        .or(
          `and(sender_id.eq.${user.id},recipient_id.eq.${peerId}),and(sender_id.eq.${peerId},recipient_id.eq.${user.id})`,
        )
        .order("created_at", { ascending: true })
        .limit(200);
      if (cancel) return;
      if (error) { toast.error(error.message); return; }
      setMessages((data ?? []) as DM[]);
      await supabase
        .from("direct_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("sender_id", peerId)
        .eq("recipient_id", user.id)
        .is("read_at", null);
      qc.invalidateQueries({ queryKey: ["dm_index", user.id] });
    })();
    return () => { cancel = true; };
  }, [user, peerId, qc]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`dm-${user.id}-${peerId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "direct_messages",
      }, (payload) => {
        const m = payload.new as DM;
        const pair =
          (m.sender_id === user.id && m.recipient_id === peerId) ||
          (m.sender_id === peerId && m.recipient_id === user.id);
        if (!pair) return;
        setMessages((prev) => [...prev, m]);
        if (m.recipient_id === user.id) {
          void supabase
            .from("direct_messages")
            .update({ read_at: new Date().toISOString() })
            .eq("id", m.id);
        }
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user, peerId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function insertMsg(row: Partial<DM>) {
    if (!user) return;
    const { error } = await supabase.from("direct_messages").insert({
      sender_id: user.id,
      recipient_id: peerId,
      ...row,
    });
    if (error) {
      if (error.message.includes("row-level")) {
        toast.error("Friends banne ke baad hi DM bhej sakte ho");
      } else {
        toast.error(error.message);
      }
      return false;
    }
    return true;
  }

  async function sendText() {
    const v = text.trim();
    if (!v) return;
    setText("");
    const ok = await insertMsg({ kind: "text", message: v });
    if (!ok) setText(v);
  }

  async function pickAttachment(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (file.size > 30 * 1024 * 1024) {
      toast.error("Max 30MB");
      return;
    }
    try {
      setAttachBusy(true);
      const res = await uploadToUserFolder("chat-media", file, user.id);
      const kind: DM["kind"] = file.type.startsWith("image/")
        ? "image"
        : file.type.startsWith("video/")
          ? "video"
          : "file";
      await insertMsg({
        kind,
        media_url: res.url,
        media_mime: file.type,
        message: file.type.startsWith("image") || file.type.startsWith("video") ? null : file.name,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setAttachBusy(false);
    }
  }

  async function startRecord() {
    if (!user) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      recordChunks.current = [];
      recordStart.current = Date.now();
      rec.ondataavailable = (ev) => { if (ev.data.size > 0) recordChunks.current.push(ev.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordChunks.current, { type: "audio/webm" });
        const duration = Math.max(1, Math.round((Date.now() - recordStart.current) / 1000));
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
        try {
          setAttachBusy(true);
          const res = await uploadToUserFolder("voice-notes", file, user.id);
          await insertMsg({
            kind: "voice",
            media_url: res.url,
            media_mime: "audio/webm",
            duration_seconds: duration,
          });
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Voice send failed");
        } finally {
          setAttachBusy(false);
        }
      };
      rec.start();
      mediaRec.current = rec;
      setRecording(true);
    } catch {
      toast.error("Mic access denied");
    }
  }

  function stopRecord() {
    mediaRec.current?.stop();
    mediaRec.current = null;
    setRecording(false);
  }

  async function shareAlbumImage(img: Img) {
    setShowAlbum(false);
    await insertMsg({ kind: "album", gallery_image_id: img.id });
  }

  if (!user) return null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <div className="mx-auto flex h-full w-full max-w-md flex-col">

        <header
          className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/80 px-3 py-3 backdrop-blur-xl"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
        >
          <button
            onClick={() => nav({ to: "/messages" })}
            aria-label="Back"
            className="grid h-9 w-9 place-items-center rounded-full bg-card/60"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <Link to="/messages" className="flex min-w-0 flex-1 items-center gap-2">
            <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-[color:var(--secondary)]/40 text-xs font-bold">
              {peer.data?.avatar ? (
                <img src={peer.data.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                (peer.data?.username ?? "?").slice(0, 1).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">@{peer.data?.username ?? "user"}</p>
              <p className="text-[10px] text-muted-foreground">ID {peer.data?.user_code ?? "—"}</p>
            </div>
          </Link>
        </header>

        <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
          {peer.isLoading && (
            <div className="pt-6 text-center">
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {messages.length === 0 && !peer.isLoading && (
            <p className="pt-8 text-center text-xs text-muted-foreground">
              Send a message to start the conversation
            </p>
          )}
          {messages.map((m) => {
            const mine = m.sender_id === user.id;
            const bubbleSkin = mine ? (myBubble.data ?? null) : (peer.data?.bubble ?? null);
            const skinStyle = bubbleSkin
              ? { backgroundImage: `url(${bubbleSkin})`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat" as const }
              : undefined;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  style={skinStyle}
                  className={`max-w-[78%] break-words rounded-2xl px-3 py-2 text-sm ${
                    bubbleSkin
                      ? "text-white drop-shadow"
                      : mine
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-card border border-border rounded-bl-sm"
                  }`}
                >
                  <MessageBody
                    m={m}
                    mine={mine}
                    albumSrc={m.gallery_image_id ? albumRefs.data?.[m.gallery_image_id] : undefined}
                  />
                  <p className={`mt-0.5 text-[9px] ${bubbleSkin ? "text-white/80" : mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Composer */}
        <div
          className="sticky bottom-0 border-t border-border bg-background/90 px-2 py-2 backdrop-blur-xl"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*,application/pdf"
            className="hidden"
            onChange={pickAttachment}
          />
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={attachBusy || recording}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-card/60 text-muted-foreground disabled:opacity-40"
              aria-label="Attach"
            >
              {attachBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => setShowAlbum(true)}
              disabled={attachBusy || recording}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-card/60 text-[color:var(--gold)] disabled:opacity-40"
              aria-label="Share from private album"
              title="Private album se share karo"
            >
              <Lock className="h-4 w-4" />
            </button>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendText()}
              placeholder={recording ? "Recording…" : "Type a message…"}
              disabled={recording}
              className="flex-1 rounded-full border border-border bg-card/60 px-4 py-2.5 text-sm outline-none focus:border-[color:var(--primary)] disabled:opacity-60"
            />
            {text.trim() ? (
              <button
                onClick={sendText}
                aria-label="Send"
                className="glow-4d grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
              >
                <Send className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onMouseDown={startRecord}
                onMouseUp={stopRecord}
                onTouchStart={startRecord}
                onTouchEnd={stopRecord}
                aria-label={recording ? "Release to send" : "Hold to record"}
                className={`glow-4d grid h-10 w-10 shrink-0 place-items-center rounded-full text-primary-foreground ${
                  recording ? "bg-red-500 animate-pulse" : "bg-primary"
                }`}
              >
                {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
            )}
          </div>
          {recording && (
            <p className="mt-1 text-center text-[10px] text-red-400">
              Recording… release to send
            </p>
          )}
        </div>
      </div>

      {/* Private album picker */}
      {showAlbum && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/70" onClick={() => setShowAlbum(false)}>
          <div
            className="max-h-[75vh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-border bg-background p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold">Private album se share karo</p>
              <button onClick={() => setShowAlbum(false)} className="grid h-7 w-7 place-items-center rounded-full bg-card">
                <X className="h-4 w-4" />
              </button>
            </div>
            {myPrivateAlbum.isLoading ? (
              <div className="grid h-32 place-items-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (myPrivateAlbum.data ?? []).length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                Koi private photo nahi. Gallery me pehle upload karo.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {myPrivateAlbum.data!.map((img) => (
                  <button
                    key={img.id}
                    onClick={() => shareAlbumImage(img)}
                    className="relative aspect-square overflow-hidden rounded-xl bg-card/60"
                  >
                    <img src={img.path} alt="" className="h-full w-full object-cover" />
                    <div className="absolute left-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-[color:var(--gold)]">
                      <Lock className="h-3 w-3" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>

  );
}

function MessageBody({
  m,
  mine,
  albumSrc,
}: {
  m: DM;
  mine: boolean;
  albumSrc?: string;
}) {
  if (m.kind === "text") return <>{m.message}</>;
  if (m.kind === "image") {
    return (
      <a href={m.media_url ?? "#"} target="_blank" rel="noreferrer">
        <img src={m.media_url ?? ""} alt="" className="max-h-64 rounded-lg" />
      </a>
    );
  }
  if (m.kind === "video") {
    return <video src={m.media_url ?? ""} controls className="max-h-64 rounded-lg" />;
  }
  if (m.kind === "voice") {
    return (
      <div className="flex items-center gap-2">
        <audio controls src={m.media_url ?? ""} className="h-8" />
        {m.duration_seconds && (
          <span className={`text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
            {m.duration_seconds}s
          </span>
        )}
      </div>
    );
  }
  if (m.kind === "file") {
    return (
      <a
        href={m.media_url ?? "#"}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2 underline"
      >
        <Paperclip className="h-3 w-3" />
        {m.message ?? "File"}
      </a>
    );
  }
  if (m.kind === "album") {
    return (
      <div className="relative">
        {albumSrc ? (
          <a href={albumSrc} target="_blank" rel="noreferrer">
            <img src={albumSrc} alt="private album" className="max-h-64 rounded-lg" />
          </a>
        ) : (
          <div className="grid h-40 w-40 place-items-center rounded-lg bg-black/40 text-[color:var(--gold)]">
            <Lock className="h-6 w-6" />
          </div>
        )}
        <span className="absolute left-1 top-1 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[9px] font-bold text-[color:var(--gold)]">
          <Lock className="h-2.5 w-2.5" /> Private album
        </span>
      </div>
    );
  }
  return <ImageIcon className="h-4 w-4" />;
}
