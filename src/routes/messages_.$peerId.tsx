import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Smile,
  X,
  Check,
  CheckCheck,
  Reply,
  Copy,
  Trash2,
  Forward,
} from "lucide-react";
import { toast } from "sonner";
import { uploadToUserFolder } from "@/lib/uploads";
import { ChatEmojiSheet, type ChatEmoji } from "@/components/chat/ChatEmojiSheet";
import { ChatEmojiOverlay } from "@/components/chat/ChatEmojiOverlay";
import { VoiceRecordingTray } from "@/components/chat/VoiceRecordingTray";
import { VoiceMessage } from "@/components/chat/VoiceMessage";

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
  reply_to_id: string | null;
  delivered_at: string | null;
  read_at: string | null;
  deleted_at: string | null;
  created_at: string;
};

type Img = { id: string; path: string; is_public: boolean };

const SELECT_COLS =
  "id,sender_id,recipient_id,message,kind,media_url,media_mime,duration_seconds,gallery_image_id,reply_to_id,delivered_at,read_at,deleted_at,created_at";

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
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [replyTo, setReplyTo] = useState<DM | null>(null);
  const [actionMsg, setActionMsg] = useState<DM | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const mediaRec = useRef<MediaRecorder | null>(null);
  const recordChunks = useRef<Blob[]>([]);
  const recordStart = useRef<number>(0);
  const recordStream = useRef<MediaStream | null>(null);
  const recordCancelled = useRef<boolean>(false);
  const recordPointerStart = useRef<{ x: number; y: number } | null>(null);
  const [recordDrag, setRecordDrag] = useState(0); // negative = slide-left toward cancel
  const [recordStartTs, setRecordStartTs] = useState(0);
  const typingChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSent = useRef<number>(0);
  const peerTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const peer = useQuery({
    queryKey: ["profile-chat", peerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,username,avatar,user_code,bubble,last_seen")
        .eq("id", peerId)
        .maybeSingle();
      if (error) throw error;
      return data as {
        id: string;
        username: string | null;
        avatar: string | null;
        user_code: string | null;
        bubble: string | null;
        last_seen: string | null;
      } | null;
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

  // Load history + mark delivered/read
  useEffect(() => {
    if (!user) return;
    let cancel = false;
    (async () => {
      const { data, error } = await supabase
        .from("direct_messages")
        .select(SELECT_COLS)
        .or(
          `and(sender_id.eq.${user.id},recipient_id.eq.${peerId}),and(sender_id.eq.${peerId},recipient_id.eq.${user.id})`,
        )
        .order("created_at", { ascending: true })
        .limit(200);
      if (cancel) return;
      if (error) { toast.error(error.message); return; }
      setMessages((prev) => {
        const map = new Map<string, DM>();
        for (const m of (data ?? []) as DM[]) map.set(m.id, m);
        // Preserve any realtime messages that arrived before history finished loading
        for (const m of prev) if (!map.has(m.id)) map.set(m.id, m);
        return Array.from(map.values()).sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );
      });
      const now = new Date().toISOString();
      // Mark all peer→me as delivered AND read (thread is open)
      await supabase
        .from("direct_messages")
        .update({ read_at: now, delivered_at: now })
        .eq("sender_id", peerId)
        .eq("recipient_id", user.id)
        .is("read_at", null);
      await supabase
        .from("direct_messages")
        .update({ delivered_at: now })
        .eq("sender_id", peerId)
        .eq("recipient_id", user.id)
        .is("delivered_at", null);
      qc.invalidateQueries({ queryKey: ["dm_index", user.id] });
    })();
    return () => { cancel = true; };
  }, [user, peerId, qc]);

  // Realtime — DM inserts + updates + peer presence + typing broadcast
  useEffect(() => {
    if (!user) return;

    // Messages: INSERT & UPDATE for this pair
    const dmCh = supabase
      .channel(`dm-thread-${user.id}-${peerId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        (payload) => {
          const m = payload.new as DM;
          const pair =
            (m.sender_id === user.id && m.recipient_id === peerId) ||
            (m.sender_id === peerId && m.recipient_id === user.id);
          if (!pair) return;
          setMessages((prev) => (prev.some((item) => item.id === m.id) ? prev : [...prev, m]));
          if (m.recipient_id === user.id) {
            const now = new Date().toISOString();
            void supabase
              .from("direct_messages")
              .update({ read_at: now, delivered_at: now })
              .eq("id", m.id);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "direct_messages" },
        (payload) => {
          const m = payload.new as DM;
          const pair =
            (m.sender_id === user.id && m.recipient_id === peerId) ||
            (m.sender_id === peerId && m.recipient_id === user.id);
          if (!pair) return;
          setMessages((prev) => prev.map((item) => (item.id === m.id ? { ...item, ...m } : item)));
        },
      )
      .subscribe();

    // Peer presence — refresh last_seen when their profile changes
    const presenceCh = supabase
      .channel(`peer-presence-${peerId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${peerId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["profile-chat", peerId] });
        },
      )
      .subscribe();

    // Typing indicator — broadcast channel (ephemeral, both sides join)
    const pairKey = [user.id, peerId].sort().join("::");
    const typing = supabase.channel(`typing-${pairKey}`, {
      config: { broadcast: { self: false } },
    });
    typing
      .on("broadcast", { event: "typing" }, (payload) => {
        if ((payload.payload as { from?: string })?.from !== peerId) return;
        setPeerTyping(true);
        if (peerTypingTimer.current) clearTimeout(peerTypingTimer.current);
        peerTypingTimer.current = setTimeout(() => setPeerTyping(false), 3000);
      })
      .subscribe();
    typingChannel.current = typing;

    return () => {
      void supabase.removeChannel(dmCh);
      void supabase.removeChannel(presenceCh);
      void supabase.removeChannel(typing);
      typingChannel.current = null;
      if (peerTypingTimer.current) clearTimeout(peerTypingTimer.current);
    };
  }, [user, peerId, qc]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, peerTyping]);

  // Broadcast typing (throttled to 1/2s)
  const broadcastTyping = useCallback(() => {
    if (!user || !typingChannel.current) return;
    const now = Date.now();
    if (now - lastTypingSent.current < 2000) return;
    lastTypingSent.current = now;
    void typingChannel.current.send({
      type: "broadcast",
      event: "typing",
      payload: { from: user.id },
    });
  }, [user]);

  async function insertMsg(row: Partial<DM>) {
    if (!user) return false;
    const { data, error } = await supabase
      .from("direct_messages")
      .insert({
        sender_id: user.id,
        recipient_id: peerId,
        ...row,
      })
      .select(SELECT_COLS)
      .single();
    if (error) {
      if (error.message.includes("row-level")) {
        toast.error("Friends banne ke baad hi DM bhej sakte ho");
      } else {
        toast.error(error.message);
      }
      return false;
    }
    if (data) {
      setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data as DM]));
      qc.invalidateQueries({ queryKey: ["dm_index", user.id] });
    }
    return true;
  }

  async function sendText() {
    const v = text.trim();
    if (!v) return;
    setText("");
    const rid = replyTo?.id ?? null;
    setReplyTo(null);
    const ok = await insertMsg({ kind: "text", message: v, reply_to_id: rid });
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
      const rid = replyTo?.id ?? null;
      setReplyTo(null);
      await insertMsg({
        kind,
        media_url: res.url,
        media_mime: file.type,
        message: file.type.startsWith("image") || file.type.startsWith("video") ? null : file.name,
        reply_to_id: rid,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setAttachBusy(false);
    }
  }

  function pickRecorderMime(): { mime: string; ext: string } {
    const candidates: Array<{ mime: string; ext: string }> = [
      { mime: "audio/webm;codecs=opus", ext: "webm" },
      { mime: "audio/webm", ext: "webm" },
      { mime: "audio/mp4;codecs=mp4a.40.2", ext: "m4a" },
      { mime: "audio/mp4", ext: "m4a" },
      { mime: "audio/aac", ext: "aac" },
      { mime: "audio/ogg;codecs=opus", ext: "ogg" },
    ];
    for (const c of candidates) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c.mime)) return c;
    }
    return { mime: "", ext: "webm" };
  }

  async function startRecord() {
    if (!user) return;
    if (typeof MediaRecorder === "undefined") {
      toast.error("Is browser me voice recording support nahi hai");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const { mime, ext } = pickRecorderMime();
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recordChunks.current = [];
      recordStart.current = Date.now();
      recordCancelled.current = false;
      recordStream.current = stream;
      setRecordStartTs(Date.now());
      setRecordDrag(0);
      try { navigator.vibrate?.(30); } catch { /* noop */ }
      rec.ondataavailable = (ev) => { if (ev.data.size > 0) recordChunks.current.push(ev.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        recordStream.current = null;
        if (recordCancelled.current) return; // discarded
        const outType = rec.mimeType || mime || "audio/webm";
        const blob = new Blob(recordChunks.current, { type: outType });
        const duration = Math.max(1, Math.round((Date.now() - recordStart.current) / 1000));
        if (blob.size < 1200 || duration < 1) {
          toast.error("Recording bahut choti thi — thoda lamba dabaye rakho");
          setAttachBusy(false);
          return;
        }
        const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: outType });
        try {
          setAttachBusy(true);
          const res = await uploadToUserFolder("voice-notes", file, user.id);
          await insertMsg({
            kind: "voice",
            media_url: res.url,
            media_mime: outType,
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Mic access denied");
    }
  }

  function stopRecord(cancel = false) {
    if (cancel) recordCancelled.current = true;
    if (mediaRec.current && mediaRec.current.state !== "inactive") {
      try { mediaRec.current.stop(); } catch { /* noop */ }
    }
    // If cancelled, ensure tracks stopped even if onstop hasn't fired.
    if (cancel && recordStream.current) {
      recordStream.current.getTracks().forEach((t) => t.stop());
      recordStream.current = null;
    }
    mediaRec.current = null;
    recordPointerStart.current = null;
    setRecordDrag(0);
    setRecording(false);
    if (cancel) { try { navigator.vibrate?.(15); } catch { /* noop */ } }
  }




  async function shareAlbumImage(img: Img) {
    setShowAlbum(false);
    await insertMsg({ kind: "album", gallery_image_id: img.id });
  }

  async function sendAnimatedEmoji(e: ChatEmoji) {
    if (!user) return;
    const { error } = await supabase.from("chat_emoji_sends").insert({
      sender_id: user.id,
      recipient_id: peerId,
      emoji_slug: e.slug,
      emoji_char: e.emoji,
      emoji_name: e.name,
      clip_path: e.clip_path,
    });
    if (error) toast.error(error.message);
  }

  async function softDelete(m: DM) {
    setActionMsg(null);
    const { error } = await supabase
      .from("direct_messages")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", m.id)
      .eq("sender_id", user!.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, deleted_at: new Date().toISOString() } : x)));
    qc.invalidateQueries({ queryKey: ["dm_index", user!.id] });
  }

  function copyMsg(m: DM) {
    setActionMsg(null);
    const t = m.message ?? m.media_url ?? "";
    if (!t) return;
    navigator.clipboard.writeText(t);
    toast.success("Copied");
  }

  const msgIndex = useMemo(() => {
    const m = new Map<string, DM>();
    for (const it of messages) m.set(it.id, it);
    return m;
  }, [messages]);

  const statusLine = useMemo(() => {
    if (peerTyping) return "typing…";
    const ls = peer.data?.last_seen;
    if (!ls) return `ID ${peer.data?.user_code ?? "—"}`;
    const diff = Date.now() - new Date(ls).getTime();
    if (diff < 60 * 1000) return "online";
    if (diff < 60 * 60 * 1000) return `last seen ${Math.floor(diff / 60000)}m ago`;
    if (diff < 24 * 60 * 60 * 1000) return `last seen ${Math.floor(diff / 3600000)}h ago`;
    return `last seen ${new Date(ls).toLocaleDateString()}`;
  }, [peerTyping, peer.data?.last_seen, peer.data?.user_code]);

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
            <div className="relative">
              <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-[color:var(--secondary)]/40 text-xs font-bold">
                {peer.data?.avatar ? (
                  <img src={peer.data.avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  (peer.data?.username ?? "?").slice(0, 1).toUpperCase()
                )}
              </div>
              {statusLine === "online" && (
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-500" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">@{peer.data?.username ?? "user"}</p>
              <p
                className={`truncate text-[10px] ${
                  peerTyping
                    ? "font-bold text-[color:var(--primary)]"
                    : statusLine === "online"
                      ? "text-emerald-400"
                      : "text-muted-foreground"
                }`}
              >
                {statusLine}
              </p>
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
            const isDeleted = !!m.deleted_at;
            const bubbleSkin = !isDeleted ? (mine ? (myBubble.data ?? null) : (peer.data?.bubble ?? null)) : null;
            const skinStyle = bubbleSkin
              ? { backgroundImage: `url(${bubbleSkin})`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat" as const }
              : undefined;
            const quoted = m.reply_to_id ? msgIndex.get(m.reply_to_id) : null;

            const onPressStart = () => {
              if (isDeleted) return;
              longPressTimer.current = setTimeout(() => setActionMsg(m), 400);
            };
            const onPressEnd = () => {
              if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
              }
            };

            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  style={skinStyle}
                  onPointerDown={onPressStart}
                  onPointerUp={onPressEnd}
                  onPointerLeave={onPressEnd}
                  onPointerCancel={onPressEnd}
                  onContextMenu={(e) => { e.preventDefault(); if (!isDeleted) setActionMsg(m); }}
                  className={`max-w-[78%] break-words rounded-2xl px-3 py-2 text-sm select-none ${
                    isDeleted
                      ? "border border-dashed border-border bg-card/40 italic text-muted-foreground"
                      : bubbleSkin
                        ? "text-white drop-shadow"
                        : mine
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-card border border-border rounded-bl-sm"
                  }`}
                >
                  {quoted && !isDeleted && (
                    <div
                      className={`mb-1.5 rounded-lg border-l-2 px-2 py-1 text-[11px] ${
                        mine
                          ? "border-white/70 bg-white/15 text-primary-foreground/90"
                          : "border-[color:var(--primary)] bg-[color:var(--primary)]/10 text-foreground/80"
                      }`}
                    >
                      <p className="font-bold text-[10px] opacity-80">
                        {quoted.sender_id === user.id ? "You" : `@${peer.data?.username ?? "user"}`}
                      </p>
                      <p className="truncate">{quotedPreview(quoted)}</p>
                    </div>
                  )}
                  {isDeleted ? (
                    <span className="flex items-center gap-1.5">
                      <Trash2 className="h-3 w-3" /> This message was deleted
                    </span>
                  ) : (
                    <MessageBody
                      m={m}
                      mine={mine}
                      albumSrc={m.gallery_image_id ? albumRefs.data?.[m.gallery_image_id] : undefined}
                    />
                  )}
                  <div
                    className={`mt-0.5 flex items-center justify-end gap-1 text-[9px] ${
                      bubbleSkin ? "text-white/80" : mine ? "text-primary-foreground/70" : "text-muted-foreground"
                    }`}
                  >
                    <span>
                      {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {mine && !isDeleted && <Ticks m={m} />}
                  </div>
                </div>
              </div>
            );
          })}
          {peerTyping && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm border border-border bg-card px-3 py-2">
                <TypingDots />
              </div>
            </div>
          )}
        </div>

        {/* Reply preview above composer */}
        {replyTo && (
          <div className="border-t border-border bg-card/70 px-3 py-2">
            <div className="flex items-start gap-2 rounded-lg border-l-2 border-[color:var(--primary)] bg-background/60 px-2 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-[color:var(--primary)]">
                  Replying to {replyTo.sender_id === user.id ? "yourself" : `@${peer.data?.username ?? "user"}`}
                </p>
                <p className="truncate text-xs text-muted-foreground">{quotedPreview(replyTo)}</p>
              </div>
              <button
                onClick={() => setReplyTo(null)}
                aria-label="Cancel reply"
                className="grid h-6 w-6 place-items-center rounded-full bg-card"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}

        {/* Composer — Jalwa premium */}
        <div
          className="sticky bottom-0 border-t border-[color:var(--gold)]/20 bg-gradient-to-t from-background via-background/95 to-background/80 px-2.5 pt-2 backdrop-blur-xl"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*,application/pdf"
            className="hidden"
            onChange={pickAttachment}
          />
          {recording ? (
            <div className="flex items-center gap-2">
              <div
                className="flex-1"
                style={{ transform: `translateX(${Math.min(0, recordDrag)}px)`, opacity: Math.max(0.4, 1 - Math.abs(Math.min(0, recordDrag)) / 220) }}
              >
                <VoiceRecordingTray
                  stream={recordStream.current}
                  startTs={recordStartTs}
                  onCancel={() => stopRecord(true)}
                />
              </div>
              <button
                type="button"
                onPointerDown={(e) => { e.preventDefault(); (e.currentTarget as HTMLButtonElement).setPointerCapture?.(e.pointerId); recordPointerStart.current = { x: e.clientX, y: e.clientY }; }}
                onPointerMove={(e) => {
                  const s = recordPointerStart.current;
                  if (!s) return;
                  const dx = e.clientX - s.x;
                  setRecordDrag(dx < 0 ? dx : 0);
                  if (dx < -140) stopRecord(true);
                }}
                onPointerUp={(e) => {
                  e.preventDefault();
                  const s = recordPointerStart.current;
                  const dx = s ? e.clientX - s.x : 0;
                  stopRecord(dx < -80);
                }}
                onPointerCancel={() => stopRecord(true)}
                aria-label="Release to send, slide left to cancel"
                className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-red-500 via-[color:var(--primary)] to-red-500 text-white shadow-[0_6px_20px_-4px_rgba(239,68,68,0.6)] transition"
              >
                <span className="absolute inset-0 rounded-full ring-2 ring-inset ring-white/30 animate-pulse" />
                <Send className="h-[18px] w-[18px] translate-x-[1px]" />
              </button>
            </div>
          ) : (
            <div className="flex items-end gap-2">
              {/* Premium pill wrapper with emoji + input + attach icons inside */}
              <div className="relative flex min-w-0 flex-1 items-center gap-1 rounded-full border border-[color:var(--gold)]/30 bg-card/70 pl-1.5 pr-1 shadow-[0_4px_20px_-6px_rgba(0,0,0,0.6)] focus-within:border-[color:var(--primary)]/70 focus-within:shadow-[0_0_0_3px_rgba(236,72,153,0.15)] transition-all">
                <button
                  type="button"
                  onClick={() => setEmojiOpen(true)}
                  disabled={attachBusy}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[color:var(--primary)] hover:bg-[color:var(--primary)]/10 disabled:opacity-40 transition"
                  aria-label="Animated emoji"
                >
                  <Smile className="h-[18px] w-[18px]" />
                </button>
                <input
                  value={text}
                  onChange={(e) => { setText(e.target.value); broadcastTyping(); }}
                  onKeyDown={(e) => e.key === "Enter" && sendText()}
                  placeholder="Message"
                  className="min-w-0 flex-1 bg-transparent px-1 py-2.5 text-[15px] placeholder:text-muted-foreground/70 outline-none disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowAlbum(true)}
                  disabled={attachBusy}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[color:var(--gold)] hover:bg-[color:var(--gold)]/10 disabled:opacity-40 transition"
                  aria-label="Private album"
                  title="Private album se share karo"
                >
                  <Lock className="h-[16px] w-[16px]" />
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={attachBusy}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted/40 disabled:opacity-40 transition"
                  aria-label="Attach"
                >
                  {attachBusy ? <Loader2 className="h-[16px] w-[16px] animate-spin" /> : <Paperclip className="h-[16px] w-[16px]" />}
                </button>
              </div>

              {text.trim() ? (
                <button
                  onClick={sendText}
                  aria-label="Send"
                  className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[color:var(--primary)] via-[color:var(--secondary)] to-[color:var(--primary)] text-primary-foreground shadow-[0_6px_20px_-4px_rgba(236,72,153,0.6)] active:scale-95 transition"
                >
                  <span className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/25" />
                  <Send className="h-[18px] w-[18px] translate-x-[1px]" />
                </button>
              ) : (
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    (e.currentTarget as HTMLButtonElement).setPointerCapture?.(e.pointerId);
                    recordPointerStart.current = { x: e.clientX, y: e.clientY };
                    void startRecord();
                  }}
                  aria-label="Hold to record"
                  className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full text-primary-foreground shadow-[0_6px_20px_-4px_rgba(236,72,153,0.5)] active:scale-95 transition bg-gradient-to-br from-[color:var(--primary)] via-[color:var(--secondary)] to-[color:var(--primary)]"
                >
                  <span className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/25" />
                  <Mic className="h-[18px] w-[18px]" />
                </button>
              )}
            </div>
          )}
          {recording && recordDrag < -20 && (
            <p className="mt-1 text-center text-[10px] font-semibold text-red-400">
              ← Slide to cancel
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

      {/* Long-press action sheet */}
      {actionMsg && (
        <div
          className="fixed inset-0 z-50 grid place-items-end bg-black/60"
          onClick={() => setActionMsg(null)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl border-t border-border bg-background p-4"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
            <div className="mb-3 rounded-xl border border-border bg-card/60 px-3 py-2 text-xs text-muted-foreground">
              <p className="line-clamp-2">{quotedPreview(actionMsg)}</p>
            </div>
            <div className="grid gap-1">
              <ActionRow icon={Reply} label="Reply" onClick={() => { setReplyTo(actionMsg); setActionMsg(null); }} />
              <ActionRow icon={Copy} label="Copy" onClick={() => copyMsg(actionMsg)} />
              <ActionRow
                icon={Forward}
                label="Forward"
                onClick={() => { setActionMsg(null); toast("Forward coming soon"); }}
              />
              {actionMsg.sender_id === user.id && (
                <ActionRow
                  icon={Trash2}
                  label="Delete for everyone"
                  danger
                  onClick={() => softDelete(actionMsg)}
                />
              )}
            </div>
          </div>
        </div>
      )}

      <ChatEmojiSheet open={emojiOpen} onClose={() => setEmojiOpen(false)} onPick={(e) => void sendAnimatedEmoji(e)} />
      <ChatEmojiOverlay scope={{ type: "dm", selfId: user.id, peerId }} />
    </div>

  );

}

function quotedPreview(m: DM): string {
  if (m.deleted_at) return "Deleted message";
  if (m.kind === "text") return m.message ?? "";
  if (m.kind === "image") return "📷 Photo";
  if (m.kind === "video") return "🎬 Video";
  if (m.kind === "voice") return "🎙️ Voice message";
  if (m.kind === "album") return "🖼️ Shared from gallery";
  if (m.kind === "file") return `📎 ${m.message ?? "File"}`;
  return "";
}

function Ticks({ m }: { m: DM }) {
  if (m.read_at) return <CheckCheck className="h-3 w-3 text-sky-300" />;
  if (m.delivered_at) return <CheckCheck className="h-3 w-3" />;
  return <Check className="h-3 w-3" />;
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[color:var(--primary)] [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[color:var(--primary)] [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[color:var(--primary)]" />
    </span>
  );
}

function ActionRow({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof Reply;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition active:scale-[0.98] ${
        danger
          ? "bg-red-500/10 text-red-400"
          : "bg-card/60 text-foreground hover:bg-card"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
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
