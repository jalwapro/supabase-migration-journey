import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAgoraRoom, type RemoteUser } from "@/hooks/useAgoraRoom";
import {
  Flag,
  Share2,
  Power,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Gift,
  Send,
  User as UserIcon,
  Heart,
  Trophy,
  Users,
  Smile,
  Gamepad2,
  Settings,
  Music,
  Flame,
  Plus,
  Minus,
  Crown,
  ChevronRight,
  UserPlus,
  Home,
  Maximize2,
  Volume2,
  VolumeX,
  RefreshCcw,
  MoreHorizontal,
  Grid3x3,
  Inbox,
  Armchair,
  Sparkles,
  FlipHorizontal,
  Swords,
  Radio,
  X,
} from "lucide-react";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { GiftSheet, type GiftReceiver } from "@/components/GiftSheet";
import { GiftAnimationPlayer } from "@/components/room/GiftAnimationPlayer";
import { LudoSheet, type LudoPlayer } from "@/components/room/LudoSheet";
import { HostMusicPlayer } from "@/components/room/HostMusicPlayer";
import { InviteSheet } from "@/components/room/InviteSheet";
import { LevelBadge } from "@/components/LevelBadge";
import { tierForLevel } from "@/lib/levels";

export const Route = createFileRoute("/room/$roomId")({
  component: RoomPage,
});

type Room = {
  id: string;
  title: string;
  cover_url: string | null;
  room_type: "voice" | "video";
  status: "live" | "ended";
  viewer_count: number;
  seat_count: number;
  host_id: string;
  agora_channel: string;
  locked_seats: number[] | null;
  host: { username: string | null; avatar: string | null } | null;
};

type Member = {
  room_id: string;
  user_id: string;
  seat_index: number | null;
  is_muted: boolean;
  is_video: boolean;
  is_moderator?: boolean;
  user: { username: string | null; avatar: string | null } | null;
};

type Message = {
  id: string;
  user_id: string | null;
  kind: string;
  text: string | null;
  message?: string | null;
  created_at: string;
  user: { username: string | null; avatar: string | null; level?: number | null } | null;
};


function uidFromUuid(uuid: string): number {
  let h = 0;
  for (let i = 0; i < uuid.length; i++) {
    h = ((h << 5) - h + uuid.charCodeAt(i)) | 0;
  }
  return (Math.abs(h) % 2_000_000_000) + 1;
}

function shortRoomCode(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  const num = Math.abs(h) % 100_000_000;
  return String(num).padStart(8, "0");
}

const QUICK_GIFTS: { name: string; icon: string; price: number }[] = [
  { name: "Hot", icon: "🔥", price: 1 },
  { name: "Rose", icon: "🌹", price: 10 },
  { name: "Heart", icon: "💖", price: 50 },
  { name: "Lion", icon: "🦁", price: 100 },
  { name: "Ferrari", icon: "🏎️", price: 500 },
  { name: "Castle", icon: "🏰", price: 1000 },
  { name: "Diamond", icon: "💎", price: 5000 },
];

function RoomPage() {
  const { roomId } = Route.useParams();
  const { user, profile, refresh } = useAuth();
  const navigate = useNavigate();

  const [text, setText] = useState("");
  const [giftOpen, setGiftOpen] = useState(false);
  const [ludoOpen, setLudoOpen] = useState(false);
  const [musicOpen, setMusicOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [seatsSheetOpen, setSeatsSheetOpen] = useState(false);
  const [videoSettingsOpen, setVideoSettingsOpen] = useState(false);
  const [manageMember, setManageMember] = useState<Member | null>(null);
  const [videoFx, setVideoFx] = useState({
    beauty: true,
    mirror: true,
    hd: true,
    blur: false,
  });

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatEndVideoRef = useRef<HTMLDivElement | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [seatLikes, setSeatLikes] = useState<Record<number, number>>({});
  const [popularity, setPopularity] = useState<{ coin_score: number; like_count: number; gift_count: number }>({
    coin_score: 0,
    like_count: 0,
    gift_count: 0,
  });
  const [emojiSheetOpen, setEmojiSheetOpen] = useState(false);
  const [viewersSheetOpen, setViewersSheetOpen] = useState(false);
  const [pendingInvite, setPendingInvite] = useState<{
    id: string;
    from_name: string | null;
    from_avatar: string | null;
    seat_index: number | null;
  } | null>(null);
  const [manageEmptySeat, setManageEmptySeat] = useState<number | null>(null);
  const [lockedSeats, setLockedSeats] = useState<number[]>([]);
  const [flyingEmojis, setFlyingEmojis] = useState<
    { id: string; emoji: string; seat: number }[]
  >([]);
  const [glowSeats, setGlowSeats] = useState<Record<number, number>>({});
  const [giftPoints, setGiftPoints] = useState<Record<string, number>>({});
  const [recentGiftUsers, setRecentGiftUsers] = useState<Record<string, number>>({});

  const room = useQuery({
    queryKey: ["room", roomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_rooms")
        .select(
          "id,title,cover_url,room_type,status,viewer_count,seat_count,host_id,agora_channel,locked_seats,host:profiles!live_rooms_host_id_fkey(username,avatar)",
        )
        .eq("id", roomId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Room | null;
    },
  });

  const isHost = user?.id === room.data?.host_id;
  const myUid = user ? uidFromUuid(user.id) : null;
  const myMember = members.find((m) => m.user_id === user?.id) ?? null;
  const iAmOnSeat = myMember?.seat_index != null;
  const shouldPublish = isHost || iAmOnSeat;
  const isVideo = room.data?.room_type === "video";
  const isModerator = !!myMember?.is_moderator;

  useEffect(() => {
    setLockedSeats(room.data?.locked_seats ?? []);
  }, [room.data?.locked_seats]);

  // Auto-scroll chat to newest on every new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    chatEndVideoRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const agora = useAgoraRoom({
    channel: room.data?.agora_channel ?? null,
    uid: myUid,
    publish: shouldPublish,
    video: isVideo,
    kind: isVideo ? "video" : "voice",
    enabled: !!user && !!room.data && room.data.status === "live",
  });

  useEffect(() => {
    let cancel = false;
    (async () => {
      const [
        { data: mData },
        { data: msgData },
        { data: likeData },
        { data: popData },
        { data: giftData },
      ] = await Promise.all([
        supabase
          .from("room_members")
          .select(
            "room_id,user_id,seat_index,is_muted,is_video,is_moderator,user:profiles!room_members_user_id_fkey(username,avatar)",
          )
          .eq("room_id", roomId),
        supabase
          .from("room_messages")
          .select(
            "id,user_id,kind,text,message,created_at,user:profiles!room_messages_user_id_fkey(username,avatar,level)",
          )
          .eq("room_id", roomId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("room_seat_likes")
          .select("seat_index")
          .eq("room_id", roomId),
        supabase
          .from("room_popularity")
          .select("coin_score,like_count,gift_count")
          .eq("room_id", roomId)
          .maybeSingle(),
        supabase
          .from("gift_sends")
          .select("receiver_id,diamonds_earned")
          .eq("room_id", roomId),
      ]);
      if (cancel) return;
      setMembers((mData ?? []) as unknown as Member[]);
      setMessages(((msgData ?? []) as unknown as Message[]).reverse());
      const likeMap: Record<number, number> = {};
      (likeData ?? []).forEach((row: { seat_index: number }) => {
        likeMap[row.seat_index] = (likeMap[row.seat_index] ?? 0) + 1;
      });
      setSeatLikes(likeMap);
      if (popData) {
        setPopularity({
          coin_score: Number((popData as { coin_score: number }).coin_score ?? 0),
          like_count: Number((popData as { like_count: number }).like_count ?? 0),
          gift_count: Number((popData as { gift_count: number }).gift_count ?? 0),
        });
      }
      const pts: Record<string, number> = {};
      (giftData ?? []).forEach((row: { receiver_id: string | null; diamonds_earned: number | null }) => {
        if (!row.receiver_id) return;
        pts[row.receiver_id] = (pts[row.receiver_id] ?? 0) + Number(row.diamonds_earned ?? 0);
      });
      setGiftPoints(pts);
    })();
    return () => {
      cancel = true;
    };
  }, [roomId]);

  useEffect(() => {
    const ch = supabase
      .channel(`room-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "room_messages",
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          const row = payload.new as Message;
          row.text = row.text ?? row.message ?? null;
          if (row.kind === "emoji") {
            // "😀|3" → seat 3
            const parts = (row.text ?? "").split("|");
            const emoji = parts[0] ?? "😀";
            const seat = Number(parts[1] ?? 0);
            const id = `${row.id}-${Math.random().toString(36).slice(2, 7)}`;
            setFlyingEmojis((prev) => [...prev, { id, emoji, seat }]);
            setGlowSeats((prev) => ({ ...prev, [seat]: (prev[seat] ?? 0) + 1 }));
            setTimeout(() => {
              setFlyingEmojis((prev) => prev.filter((e) => e.id !== id));
            }, 2400);
            setTimeout(() => {
              setGlowSeats((prev) => {
                const next = { ...prev };
                next[seat] = Math.max(0, (next[seat] ?? 1) - 1);
                if (!next[seat]) delete next[seat];
                return next;
              });
            }, 2600);
            return;
          }
          if (row.user_id) {
            const { data } = await supabase
              .from("profiles")
              .select("username,avatar,level")
              .eq("id", row.user_id)
              .maybeSingle();
            row.user = (data as Message["user"]) ?? null;
          }
          setMessages((prev) => [...prev.slice(-99), row]);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_members",
          filter: `room_id=eq.${roomId}`,
        },
        async () => {
          const { data } = await supabase
            .from("room_members")
            .select(
              "room_id,user_id,seat_index,is_muted,is_video,is_moderator,user:profiles!room_members_user_id_fkey(username,avatar)",
            )
            .eq("room_id", roomId);
          setMembers((data ?? []) as unknown as Member[]);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "room_seat_likes",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const row = payload.new as { seat_index: number };
          setSeatLikes((prev) => ({
            ...prev,
            [row.seat_index]: (prev[row.seat_index] ?? 0) + 1,
          }));
          setPopularity((p) => ({ ...p, like_count: p.like_count + 1 }));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "gift_sends",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const row = payload.new as {
            coins_spent: number;
            quantity: number;
            receiver_id: string | null;
            diamonds_earned: number | null;
          };
          setPopularity((p) => ({
            ...p,
            coin_score: p.coin_score + Number(row.coins_spent ?? 0),
            gift_count: p.gift_count + Number(row.quantity ?? 0),
          }));
          if (row.receiver_id) {
            const rid = row.receiver_id;
            setGiftPoints((prev) => ({
              ...prev,
              [rid]: (prev[rid] ?? 0) + Number(row.diamonds_earned ?? 0),
            }));
            const stamp = Date.now();
            setRecentGiftUsers((prev) => ({ ...prev, [rid]: stamp }));
            setTimeout(() => {
              setRecentGiftUsers((prev) => {
                if (prev[rid] !== stamp) return prev;
                const next = { ...prev };
                delete next[rid];
                return next;
              });
            }, 4500);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "live_rooms",
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          const row = payload.new as { locked_seats: number[] | null };
          setLockedSeats(row.locked_seats ?? []);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [roomId]);

  // Seat invites → popup for recipient
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`seat-invites-${user.id}-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "seat_invites",
          filter: `to_user=eq.${user.id}`,
        },
        async (payload) => {
          const row = payload.new as {
            id: string;
            room_id: string;
            from_user: string;
            seat_index: number | null;
            status: string;
          };
          if (row.room_id !== roomId || row.status !== "pending") return;
          const { data } = await supabase
            .from("profiles")
            .select("username,avatar")
            .eq("id", row.from_user)
            .maybeSingle();
          const p = data as { username: string | null; avatar: string | null } | null;
          setPendingInvite({
            id: row.id,
            from_name: p?.username ?? null,
            from_avatar: p?.avatar ?? null,
            seat_index: row.seat_index,
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [user, roomId]);

  useEffect(() => {
    if (!user || !room.data?.id) return;
    const seatIndex = isHost ? 0 : null;
    void (async () => {
      const { error: memberErr } = await supabase
        .from("room_members")
        .upsert(
          { room_id: roomId, user_id: user.id, seat_index: seatIndex },
          { onConflict: "room_id,user_id" },
        );
      if (memberErr) console.warn("[room-members upsert]", memberErr.message);
      const joinText = isHost ? "started the room" : "entered the room";
      const { error: msgErr } = await supabase.from("room_messages").insert({
        room_id: roomId,
        user_id: user.id,
        username: profile?.username ?? user.email?.split("@")[0] ?? "Guest",
        kind: "join",
        text: joinText,
        message: joinText,
      });
      if (msgErr) console.warn("[join insert]", msgErr.message);
    })();

    return () => {
      void supabase.from("room_members").delete().eq("room_id", roomId).eq("user_id", user.id);
    };
    // Depend on primitives only — using room.data would re-fire on every
    // React Query refetch and spam a "joined" message each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, roomId, isHost, room.data?.id]);


  const followsHost = useQuery({
    enabled: !!user && !!room.data?.host_id && user?.id !== room.data?.host_id,
    queryKey: ["follows-host", user?.id, room.data?.host_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", user!.id)
        .eq("following_id", room.data!.host_id)
        .maybeSingle();
      return !!data;
    },
  });

  const hostFamily = useQuery({
    enabled: !!room.data?.host_id,
    queryKey: ["host-family", room.data?.host_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("families")
        .select("id,name,badge")
        .eq("owner_id", room.data!.host_id)
        .maybeSingle();
      return data as { id: string; name: string; badge: string | null } | null;
    },
  });

  const familyMember = useQuery({
    enabled: !!user && !!hostFamily.data?.id,
    queryKey: ["family-member", user?.id, hostFamily.data?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("family_members")
        .select("family_id")
        .eq("family_id", hostFamily.data!.id)
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!data;
    },
  });

  async function joinFamily() {
    if (!user || !room.data) {
      toast.error("Sign in first");
      return;
    }
    const { error } = await supabase.rpc("join_host_family", {
      _host_id: room.data.host_id,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Joined family 👑");
    await Promise.all([hostFamily.refetch(), familyMember.refetch()]);
  }


  async function followHost() {
    if (!user || !room.data) return;
    const { error } = await supabase
      .from("follows")
      .insert({ follower_id: user.id, following_id: room.data.host_id });
    if (error && error.code !== "23505") {
      toast.error(error.message);
      return;
    }
    toast.success("Following host");
    followsHost.refetch();
  }

  // Daily "love" heart — 100 coins/day → host
  const lastLove = useQuery({
    enabled: !!user && !!room.data?.host_id && user?.id !== room.data?.host_id,
    queryKey: ["host-love", user?.id, room.data?.host_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("host_love_hearts")
        .select("created_at")
        .eq("from_user", user!.id)
        .eq("to_host", room.data!.host_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.created_at ? new Date(data.created_at as string) : null;
    },
  });
  const [loveBlink, setLoveBlink] = useState(false);
  const loveCooling =
    !!lastLove.data && lastLove.data.getTime() > Date.now() - 24 * 60 * 60 * 1000;

  async function sendLove() {
    if (!user || !room.data) return;
    if (loveCooling) {
      toast.info("Daily heart already sent — come back tomorrow 💤");
      return;
    }
    if ((profile?.coins ?? 0) < 100) {
      toast.error("Need 100 coins");
      return;
    }
    const { error } = await supabase.rpc("send_host_love", {
      _host: room.data.host_id,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setLoveBlink(true);
    setTimeout(() => setLoveBlink(false), 3000);
    toast.success("💖 Love sent — 100 coins");
    await Promise.all([lastLove.refetch(), refresh()]);
  }

  async function takeSeat(seatIndex: number) {
    if (!user) {
      toast.error("Sign in first");
      return;
    }
    if (!isHost && lockedSeats.includes(seatIndex)) {
      toast.error("This seat is locked");
      return;
    }
    if (seatIndex === 0 && !isHost) {
      toast.error("Seat 1 is for the host");
      return;
    }
    if (!isHost && !followsHost.data) {
      toast.error("Follow the host to join a seat", {
        action: { label: "Follow", onClick: () => void followHost() },
      });
      return;
    }
    const { error } = await supabase.rpc("take_seat", {
      _room_id: roomId,
      _seat_index: seatIndex,
    });
    if (error) toast.error(error.message);
  }

  async function leaveSeat() {
    if (!user) return;
    const { error } = await supabase
      .from("room_members")
      .update({ seat_index: null })
      .eq("room_id", roomId)
      .eq("user_id", user.id);
    if (error) toast.error(error.message);
  }

  async function send() {
    if (!user) {
      toast.error("Sign in to chat");
      return;
    }
    const v = text.trim();
    if (!v) return;
    setText("");
    const { error } = await supabase.from("room_messages").insert({
      room_id: roomId,
      user_id: user.id,
      username: profile?.username ?? user.email?.split("@")[0] ?? "Guest",
      kind: "chat",
      text: v,
      message: v,
    });
    if (error) {
      toast.error(error.message);
      setText(v);
    }
  }

  async function sendQuickGift(g: (typeof QUICK_GIFTS)[number]) {
    if (!user) {
      toast.error("Sign in to send gifts");
      return;
    }
    const giftText = `${g.icon} ${g.name}`;
    const { error } = await supabase.from("room_messages").insert({
      room_id: roomId,
      user_id: user.id,
      username: profile?.username ?? user.email?.split("@")[0] ?? "Guest",
      kind: "gift",
      text: giftText,
      message: giftText,
    });
    if (error) toast.error(error.message);
  }

  async function sendEmoji(emoji: string, seatIndex: number) {
    if (!user) {
      toast.error("Sign in to react");
      return;
    }
    // Local optimistic — even sender sees it fly
    const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setFlyingEmojis((prev) => [...prev, { id, emoji, seat: seatIndex }]);
    setGlowSeats((prev) => ({ ...prev, [seatIndex]: (prev[seatIndex] ?? 0) + 1 }));
    setTimeout(() => setFlyingEmojis((prev) => prev.filter((e) => e.id !== id)), 2400);
    setTimeout(() => {
      setGlowSeats((prev) => {
        const next = { ...prev };
        next[seatIndex] = Math.max(0, (next[seatIndex] ?? 1) - 1);
        if (!next[seatIndex]) delete next[seatIndex];
        return next;
      });
    }, 2600);
    const emojiText = `${emoji}|${seatIndex}`;
    const { error } = await supabase.from("room_messages").insert({
      room_id: roomId,
      user_id: user.id,
      username: profile?.username ?? user.email?.split("@")[0] ?? "Guest",
      kind: "emoji",
      text: emojiText,
      message: emojiText,
    });
    if (error) console.warn("[emoji]", error.message);
  }

  async function leaveRoom() {
    if (user && isHost) {
      await supabase
        .from("live_rooms")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("id", roomId);
    }
    navigate({ to: "/" });
  }

  function share() {
    setInviteOpen(true);
  }


  const seatsByIndex = useMemo(() => {
    const m = new Map<number, Member>();
    members.forEach((x) => {
      if (x.seat_index != null) m.set(x.seat_index, x);
    });
    return m;
  }, [members]);

  // Winner of the room = seated user with the highest gift points.
  // Crown only shows once they hit 1,000 points.
  const kingUserId = useMemo(() => {
    let bestId: string | null = null;
    let bestPts = 0;
    for (const m of members) {
      if (m.seat_index == null) continue;
      const p = giftPoints[m.user_id] ?? 0;
      if (p > bestPts) {
        bestPts = p;
        bestId = m.user_id;
      }
    }
    return bestPts >= 1000 ? bestId : null;
  }, [members, giftPoints]);

  const seatedCount = useMemo(
    () => members.filter((m) => m.seat_index != null).length,
    [members],
  );

  const latestEnter = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.kind === "join" || m.kind === "system") return m;
    }
    return null;
  }, [messages]);

  const ludoPlayers: LudoPlayer[] = [0, 1, 2, 3].map((i) => {
    const m = seatsByIndex.get(i);
    return m
      ? { id: m.user_id, username: m.user?.username ?? null, avatar: m.user?.avatar ?? null }
      : { id: `empty-${i}`, username: null, avatar: null };
  });

  function openLudo() {
    if (seatedCount < 4) {
      toast.error(`Ludo needs 4 users on seats (currently ${seatedCount})`);
      return;
    }
    setLudoOpen(true);
  }

  function onSeatTap(i: number) {
    if (!user) {
      toast.error("Sign in first");
      return;
    }
    const seated = members.find((m) => m.seat_index === i);
    if (!seated) return;
    // Host / moderator taps someone else's seat → manage sheet
    if ((isHost || isModerator) && seated.user_id !== user.id) {
      setManageMember(seated);
      return;
    }
    // Self tap → open manage self (leave seat option)
    if (seated.user_id === user.id) {
      setManageMember(seated);
      return;
    }
    // Regular viewers tapping others: no-op (points only from gifts)
  }

  async function toggleMuteWithSync() {
    if (!shouldPublish) {
      toast.info("Take a seat first to talk");
      return;
    }
    await agora.toggleMute();
    const nextMuted = !agora.muted;
    if (user) {
      await supabase
        .from("room_members")
        .update({ is_muted: nextMuted })
        .eq("room_id", roomId)
        .eq("user_id", user.id);
    }
  }

  if (room.isLoading) {
    return (
      <div className="min-h-dvh grid place-items-center bg-background">
        <div className="text-sm text-muted-foreground">Loading room…</div>
      </div>
    );
  }
  if (!room.data) {
    return (
      <div className="min-h-dvh grid place-items-center bg-background p-6 text-center">
        <div>
          <p className="text-sm text-muted-foreground">This room doesn't exist.</p>
          <Link
            to="/"
            className="glow-4d mt-4 inline-flex rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
          >
            Home
          </Link>
        </div>
      </div>
    );
  }

  const r = room.data;
  const roomCode = shortRoomCode(r.id);
  const popScore = popularity.coin_score + popularity.like_count;
  const popularityPct = Math.min(100, Math.round((popScore / 2000) * 100));
  const popScoreLabel =
    popScore >= 1_000_000
      ? `${(popScore / 1_000_000).toFixed(1)}M`
      : popScore >= 1000
        ? `${(popScore / 1000).toFixed(1)}K`
        : String(popScore);
  const giftReceivers: GiftReceiver[] = [
    ...(r.host && r.host_id !== user?.id
      ? [{ id: r.host_id, username: r.host.username, avatar: r.host.avatar }]
      : []),
    ...members
      .filter((m) => m.seat_index != null && m.user_id !== user?.id && m.user_id !== r.host_id)
      .map((m) => ({
        id: m.user_id,
        username: m.user?.username ?? null,
        avatar: m.user?.avatar ?? null,
      })),
  ];

  const hostRemote = agora.remotes.get(uidFromUuid(r.host_id));

  return (
    <div
      className="relative flex h-[100dvh] flex-col overflow-hidden text-white"
      style={{
        background:
          "linear-gradient(180deg, #1a0b2e 0%, #2d0b4d 45%, #050505 100%)",
      }}
    >
      {/* Ambient blurs */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-[400px] w-[400px] rounded-full bg-[color:var(--secondary)]/20 blur-[120px]" />
      <div className="pointer-events-none absolute top-1/3 -right-16 h-[300px] w-[300px] rounded-full bg-[color:var(--primary)]/15 blur-[100px]" />

      {/* ─── Header ─────────────────────────────────────────────── */}
      <div
        className="relative z-10 mx-auto w-full max-w-md px-3 pb-2"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)" }}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          {/* Host chip */}
          <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-violet-300/35 bg-white/10 py-1.5 pl-1.5 pr-3 shadow-[inset_0_0_22px_rgba(255,255,255,0.06)] backdrop-blur-md">
            <div className="glow-4d relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-tr from-[color:var(--primary)] to-[color:var(--secondary)] ring-2 ring-white/20">
              {r.host?.avatar ? (
                <img src={r.host.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <UserIcon className="h-5 w-5 text-white/80" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[13px] font-black leading-tight sm:text-sm">
                  {r.title}
                </span>
                {!isHost && (
                  <FollowLoveChip
                    isFollowing={!!followsHost.data}
                    onFollow={() => void followHost()}
                    onLove={() => void sendLove()}
                    cooling={loveCooling}
                    blink={loveBlink}
                  />
                )}
              </div>
              <div className="truncate text-[10px] font-semibold text-white/60">
                ID:{roomCode}
              </div>
            </div>
          </div>
          {/* Action icons */}
          <div className="flex items-start gap-2">
            <HeaderIcon onClick={() => toast.info("Reported")} label="Report">
              <Flag className="h-4 w-4" />
            </HeaderIcon>
            <HeaderIcon onClick={share} label="Share">
              <Share2 className="h-4 w-4" />
            </HeaderIcon>
            <HeaderIcon onClick={leaveRoom} label="Exit" danger>
              <Power className="h-4 w-4" />
            </HeaderIcon>
          </div>
        </div>

        {/* Rank + members row */}
        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <Link
            to="/rank"
            className="flex min-w-0 items-center gap-2 rounded-full border border-violet-300/30 bg-black/35 px-3 py-1.5 text-left backdrop-blur"
          >
            <span className="text-lg leading-none">🏆</span>
            <span className="truncate text-[12px] font-bold text-[color:var(--gold)]">
              {popScore > 0 ? `${popScoreLabel} pts` : "Unranked"}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-white/80" />
          </Link>
          <div className="flex items-center gap-1.5">
            {!isHost && (
              <button
                onClick={() => void joinFamily()}
                disabled={!!familyMember.data}
                className="rounded-full border border-[color:var(--gold)]/60 bg-gradient-to-r from-[color:var(--gold)]/25 via-amber-400/15 to-[color:var(--gold)]/25 px-2.5 py-1 text-[10px] font-black tracking-wider text-[color:var(--gold)] shadow-lg shadow-[color:var(--gold)]/25 disabled:opacity-60"
                aria-label="Join premium family"
              >
                {familyMember.data ? "👑 PREMIUM" : "👑 PREMIUM"}
              </button>
            )}
            <button
              onClick={() => setViewersSheetOpen(true)}
              className="flex items-center gap-2 rounded-full border border-violet-300/30 bg-white/10 px-2.5 py-1.5 backdrop-blur"
              aria-label="View viewers"
            >
              <Users className="h-4 w-4 text-white/80" />
              <span className="text-[12px] font-black">{Math.max(r.viewer_count, members.length)}</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── Main stage: voice grid OR video seat grid ───────────── */}
      {isVideo ? (
        (() => {
          const rawSeats = Math.max(1, r.seat_count);
          const videoSeats = rawSeats <= 1 ? 1 : rawSeats <= 2 ? 2 : 4;
          const layout: "SOLO" | "1/1" | "2/2" =
            videoSeats === 1 ? "SOLO" : videoSeats === 2 ? "1/1" : "2/2";
          return (
            <VideoSeatGrid
              coverUrl={r.cover_url}
              isLive={r.status === "live"}
              layout={layout}
              seats={Array.from({ length: videoSeats }).map((_, i) => {
                const m = seatsByIndex.get(i);
                const isHostSeat = i === 0;
                const remote = m ? agora.remotes.get(uidFromUuid(m.user_id)) : undefined;
                const fallback =
                  isHostSeat && !m
                    ? { username: r.host?.username ?? null, avatar: r.host?.avatar ?? null }
                    : null;
                return {
                  index: i,
                  isHostSeat,
                  member: m,
                  remote,
                  fallbackUser: fallback,
                  onClaim: () => void takeSeat(i),
                  onLike: () => void onSeatTap(i),
                  likeCount: seatLikes[i] ?? 0,
                };
              })}
            />
          );
        })()
      ) : (
        <div className="relative z-10 mx-auto w-full max-w-md shrink-0 px-3 pt-2">
          <div className="p-0">
            {(() => {
              const sc = Math.max(4, r.seat_count);
              const cols = sc <= 8 ? 4 : 5;
              return (
                <div
                  className="grid gap-x-2 gap-y-3"
                  style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                >
                  {Array.from({ length: sc }).map((_, i) => {
                    const m = seatsByIndex.get(i);
                    const remote = m ? agora.remotes.get(uidFromUuid(m.user_id)) : undefined;
                    const isHostSeat = i === 0;
                    const fallbackHost =
                      isHostSeat && !m
                        ? { username: r.host?.username ?? null, avatar: r.host?.avatar ?? null }
                        : null;
                    return (
                      <Seat
                        key={i}
                        index={i}
                        member={m}
                        remote={remote}
                        isHostSeat={isHostSeat}
                        cover={r.cover_url}
                        fallbackUser={fallbackHost}
                        onClaim={() => takeSeat(i)}
                        likeCount={seatLikes[i] ?? 0}
                        onLike={() => onSeatTap(i)}
                        glowing={!!glowSeats[i]}
                        locked={lockedSeats.includes(i)}
                        giftPoints={m ? giftPoints[m.user_id] ?? 0 : 0}
                        receivedGift={!!(m && recentGiftUsers[m.user_id])}
                        isKing={!!(m && kingUserId === m.user_id)}
                        onEmptyManage={
                          isHost || isModerator
                            ? () => setManageEmptySeat(i)
                            : undefined
                        }
                      />
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ─── Enters-the-room banner (animated, all room types) ── */}
      <div className="pointer-events-none absolute inset-x-0 top-[190px] z-30 mx-auto w-full max-w-md px-3">
        <EnterRoomBanner latestEnter={latestEnter} />
      </div>

      {/* ─── Chat + right widgets ───────────────────────────────── */}
      <div className="relative z-10 mx-auto mt-2 flex w-full max-w-md min-h-0 flex-1 flex-col px-2">
        {!isVideo ? (
          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_39%] gap-2">
            <div className="flex min-h-0 flex-col rounded-2xl border border-violet-300/30 bg-black/35 p-3 shadow-[inset_0_0_22px_rgba(255,255,255,0.04)] backdrop-blur-md">
              <div className="mb-2 flex items-center justify-between border-b border-white/10 px-1 pb-2">
                <span className="text-sm font-bold text-white">Room Chat</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
                  Live
                </span>
              </div>
              <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1 scrollbar-hide">
                {messages.length === 0 && <EmptyChat />}
                {messages
                  .filter((m) => m.kind !== "emoji")
                  .map((m) => (
                    <ChatLine key={m.id} m={m} isMe={!!(user?.id && m.user_id === user.id)} />
                  ))}
                <div ref={chatEndRef} />
              </div>
            </div>

            <div className="flex min-h-0 flex-col gap-2">
              <button className="rounded-2xl border border-violet-300/30 bg-black/35 p-3 text-left backdrop-blur-md">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-bold text-white/90">🔥 Room Popularity</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-white/80" />
                </div>
                <div className="mt-2 text-2xl font-semibold leading-none">{popScoreLabel}</div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[color:var(--secondary)] via-[color:var(--primary)] to-orange-300"
                    style={{ width: `${Math.max(56, popularityPct)}%` }}
                  />
                </div>
              </button>
              <div className="grid flex-1 grid-cols-2 gap-2">
                {isHost ? (
                  <MiniAction
                    icon={<Music className="h-5 w-5" />}
                    label="Music"
                    onClick={() => setMusicOpen(true)}
                  />
                ) : (
                  <MiniAction
                    icon={<Smile className="h-5 w-5" />}
                    label="Reactions"
                    onClick={() => setEmojiSheetOpen(true)}
                  />
                )}
                <MiniAction icon={<UserPlus className="h-5 w-5" />} label="Invite" onClick={share} />
              </div>

            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 gap-2">
            <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/10 bg-black/40 p-2 backdrop-blur-md">
              <div className="mb-1 flex items-center justify-between border-b border-white/10 px-1 pb-1.5">
                <span className="text-[12px] font-black text-white">Chat</span>
                <span className="text-[9px] font-semibold uppercase tracking-wider text-white/50">Live</span>
              </div>
              <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1 scrollbar-hide">
                {messages.length === 0 && <EmptyChat />}
                {messages
                  .filter((m) => m.kind !== "emoji")
                  .map((m) => (
                    <ChatLine key={m.id} m={m} isMe={!!(user?.id && m.user_id === user.id)} />
                  ))}
                <div ref={chatEndVideoRef} />
              </div>
            </div>

            <div className="flex w-[38%] shrink-0 flex-col gap-2">
              <div className="grid grid-cols-2 gap-1.5">
                <MiniAction icon={<Music className="h-4 w-4" />} label="Music" onClick={() => (isHost ? setMusicOpen(true) : toast.info("Host only"))} />
                <MiniAction icon={<UserPlus className="h-4 w-4" />} label="Invite" onClick={share} />
              </div>

            </div>
          </div>
        )}
      </div>


      {/* Quick-gift strip removed — use footer Gift button */}

      {/* ─── Composer + footer dock ─────────────────────────────── */}
      {isVideo ? (
        <div
          className="relative z-10 mx-auto w-full max-w-md shrink-0 px-3 pt-2"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)" }}
        >
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => void toggleMuteWithSync()}
              aria-label={agora.muted ? "Unmute mic" : "Mute mic"}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/15 bg-black/50 text-white backdrop-blur-md"
            >
              {agora.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
            <button
              onClick={agora.toggleSpeaker}
              aria-label={agora.speakerMuted ? "Unmute room audio" : "Mute room audio"}
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border backdrop-blur-md ${
                agora.speakerMuted
                  ? "border-[color:var(--destructive)]/60 bg-[color:var(--destructive)]/25 text-white"
                  : "border-white/15 bg-black/50 text-white"
              }`}
            >
              {agora.speakerMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            {isHost || iAmOnSeat ? (
              <button
                onClick={() => void agora.toggleVideo()}
                aria-label={agora.videoOn ? "Turn camera off" : "Turn camera on"}
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border backdrop-blur-md ${
                  agora.videoOn
                    ? "border-[color:var(--primary)]/60 bg-[color:var(--primary)]/25 text-white"
                    : "border-white/15 bg-black/50 text-white"
                }`}
              >
                {agora.videoOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              </button>
            ) : null}

            <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full border border-white/10 bg-black/50 pl-2.5 pr-1 py-1 backdrop-blur-md">
              <button
                aria-label="Emoji"
                onClick={() => setText((t) => t + "😊")}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 text-white/70"
              >
                <Smile className="h-3.5 w-3.5" />
              </button>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Say hi…"
                className="min-w-0 flex-1 bg-transparent text-[12px] text-white placeholder:text-white/40 outline-none"
                disabled={!user}
              />
              <button
                onClick={send}
                aria-label="Send"
                disabled={!text.trim()}
                className="glow-4d grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--secondary)] disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>

            <button
              onClick={() => setGiftOpen(true)}
              aria-label="Send gift"
              className="glow-4d grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--secondary)] text-white shadow-[0_8px_24px_-8px_color-mix(in_oklab,var(--primary)_60%,transparent)]"
            >
              <Gift className="h-4 w-4" />
            </button>
            <button
              onClick={() => setVideoSettingsOpen(true)}
              aria-label="Room settings"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/15 bg-black/50 text-white backdrop-blur-md"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <div
          className="relative z-10 mx-auto w-full max-w-md shrink-0 px-3 pt-2"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)" }}
        >
          <div className="flex items-center gap-1.5">
            {shouldPublish ? (
              <button
                onClick={() => void toggleMuteWithSync()}
                aria-label={agora.muted ? "Unmute mic" : "Mute mic"}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/15 bg-black/50 text-white backdrop-blur-md"
              >
                {agora.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
            ) : null}
            <button
              onClick={agora.toggleSpeaker}
              aria-label={agora.speakerMuted ? "Unmute room audio" : "Mute room audio"}
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border backdrop-blur-md ${
                agora.speakerMuted
                  ? "border-[color:var(--destructive)]/60 bg-[color:var(--destructive)]/25 text-white"
                  : "border-white/15 bg-black/50 text-white"
              }`}
            >
              {agora.speakerMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>

            <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full border border-white/10 bg-black/50 pl-2.5 pr-1 py-1 backdrop-blur-md">
              <button
                aria-label="Emoji reactions"
                onClick={() => setEmojiSheetOpen(true)}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[color:var(--primary)]/60 to-[color:var(--secondary)]/60 text-white"
              >
                <Smile className="h-3.5 w-3.5" />
              </button>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Say hi…"
                className="min-w-0 flex-1 bg-transparent text-[12px] text-white placeholder:text-white/40 outline-none"
                disabled={!user}
              />
              <button
                onClick={send}
                aria-label="Send"
                disabled={!text.trim()}
                className="glow-4d grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--secondary)] disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>

            <button
              onClick={() => setGiftOpen(true)}
              aria-label="Send gift"
              className="glow-4d grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--secondary)] text-white shadow-[0_8px_24px_-8px_color-mix(in_oklab,var(--primary)_60%,transparent)]"
            >
              <Gift className="h-4 w-4" />
            </button>
            {isHost && (
              <>
                <button
                  onClick={openLudo}
                  aria-label="Games"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/15 bg-black/50 text-white backdrop-blur-md"
                >
                  <Gamepad2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setSeatsSheetOpen(true)}
                  aria-label="Room seats"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/15 bg-black/50 text-white backdrop-blur-md"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <GiftSheet
        open={giftOpen}
        onClose={() => setGiftOpen(false)}
        roomId={roomId}
        receivers={giftReceivers}
      />
      <GiftAnimationPlayer roomId={roomId} />
      <LudoSheet
        open={ludoOpen}
        onClose={() => setLudoOpen(false)}
        players={ludoPlayers}
        isHost={isHost}
      />
      <HostMusicPlayer open={musicOpen && isHost} onClose={() => setMusicOpen(false)} controller={agora} />
      <InviteSheet
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        roomUrl={typeof window !== "undefined" ? window.location.href : ""}
        roomTitle={room.data?.title ?? "Live Room"}
      />
      {isHost && (
        <SeatsSheet
          open={seatsSheetOpen}
          onClose={() => setSeatsSheetOpen(false)}
          value={r.seat_count}
          onChange={async (next) => {
            const delta = next - r.seat_count;
            if (delta !== 0) {
              if (next < r.seat_count) {
                await supabase
                  .from("room_members")
                  .update({ seat_index: null })
                  .eq("room_id", roomId)
                  .gte("seat_index", next);
              }
              const { error } = await supabase
                .from("live_rooms")
                .update({ seat_count: next })
                .eq("id", roomId);
              if (error) {
                toast.error(error.message);
                return;
              }
              room.refetch();
            }
            setSeatsSheetOpen(false);
          }}
        />
      )}
      {isVideo && (
        <VideoSettingsSheet
          open={videoSettingsOpen}
          onClose={() => setVideoSettingsOpen(false)}
          isHost={isHost}
          fx={videoFx}
          onFxChange={(k, v) => setVideoFx((s) => ({ ...s, [k]: v }))}
          videoOn={agora.videoOn}
          onToggleVideo={() => void agora.toggleVideo()}
          muted={agora.muted}
          onToggleMute={() => void toggleMuteWithSync()}
          onOpenSeats={() => {
            setVideoSettingsOpen(false);
            setSeatsSheetOpen(true);
          }}
          onOpenMusic={() => {
            setVideoSettingsOpen(false);
            setMusicOpen(true);
          }}
          onOpenGames={() => {
            setVideoSettingsOpen(false);
            openLudo();
          }}
          onShare={() => {
            setVideoSettingsOpen(false);
            void share();
          }}
          onEndLive={() => {
            setVideoSettingsOpen(false);
            void leaveRoom();
          }}
          onPk={() => toast.info("PK Battle — coming soon")}
        />
      )}
      <SeatActionSheet
        member={manageMember}
        canModerate={isHost}
        canLock={isHost || isModerator}
        isSeatLocked={
          manageMember?.seat_index != null
            ? lockedSeats.includes(manageMember.seat_index)
            : false
        }
        onClose={() => setManageMember(null)}
        onToggleModerator={async () => {
          if (!manageMember) return;
          const next = !manageMember.is_moderator;
          const { error } = await supabase
            .from("room_members")
            .update({ is_moderator: next })
            .eq("room_id", roomId)
            .eq("user_id", manageMember.user_id);
          if (error) toast.error(error.message);
          else {
            toast.success(next ? "Made moderator" : "Removed as moderator");
            setManageMember(null);
          }
        }}
        onToggleLock={async () => {
          if (!manageMember || manageMember.seat_index == null) return;
          const seat = manageMember.seat_index;
          const nextLocked = !lockedSeats.includes(seat);
          const { error } = await supabase.rpc("toggle_seat_lock", {
            _room_id: roomId,
            _seat_index: seat,
            _locked: nextLocked,
          });
          if (error) toast.error(error.message);
          else {
            toast.success(nextLocked ? "Seat locked" : "Seat unlocked");
            setManageMember(null);
          }
        }}
        onKickFromSeat={async () => {
          if (!manageMember) return;
          const { error } = await supabase
            .from("room_members")
            .update({ seat_index: null, is_moderator: false })
            .eq("room_id", roomId)
            .eq("user_id", manageMember.user_id);
          if (error) toast.error(error.message);
          else {
            toast.success("Removed from seat");
            setManageMember(null);
          }
        }}
      />
      <EmptySeatSheet
        seatIndex={manageEmptySeat}
        isLocked={
          manageEmptySeat != null ? lockedSeats.includes(manageEmptySeat) : false
        }
        onClose={() => setManageEmptySeat(null)}
        onSitHere={() => {
          if (manageEmptySeat == null) return;
          void takeSeat(manageEmptySeat);
          setManageEmptySeat(null);
        }}
        onToggleLock={async () => {
          if (manageEmptySeat == null) return;
          const nextLocked = !lockedSeats.includes(manageEmptySeat);
          const { error } = await supabase.rpc("toggle_seat_lock", {
            _room_id: roomId,
            _seat_index: manageEmptySeat,
            _locked: nextLocked,
          });
          if (error) toast.error(error.message);
          else {
            toast.success(nextLocked ? "Seat locked" : "Seat unlocked");
            setManageEmptySeat(null);
          }
        }}
        onInvite={() => {
          setManageEmptySeat(null);
          setViewersSheetOpen(true);
        }}
      />
      <ViewersSheet
        open={viewersSheetOpen}
        onClose={() => setViewersSheetOpen(false)}
        roomId={roomId}
        members={members}
        canInvite={isHost || isModerator}
        userId={user?.id ?? null}
      />
      {pendingInvite && (
        <SeatInvitePopup
          invite={pendingInvite}
          onDecline={async () => {
            await supabase
              .from("seat_invites")
              .update({ status: "declined", responded_at: new Date().toISOString() })
              .eq("id", pendingInvite.id);
            setPendingInvite(null);
          }}
          onAccept={async () => {
            const { error } = await supabase.rpc("accept_seat_invite", {
              _invite_id: pendingInvite.id,
            });
            if (error) toast.error(error.message);
            else toast.success("You're on the seat 🎤");
            setPendingInvite(null);
          }}
        />
      )}
      <EmojiReactionSheet
        open={emojiSheetOpen}
        onClose={() => setEmojiSheetOpen(false)}
        seatCount={Math.max(4, r.seat_count)}
        seatsByIndex={seatsByIndex}
        defaultSeat={
          myMember?.seat_index != null ? myMember.seat_index : 0
        }
        onSend={(emoji, seat) => void sendEmoji(emoji, seat)}
      />
      <FlyingEmojiLayer emojis={flyingEmojis} />
    </div>
  );
}

/* ─── Video seat grid (SOLO / 1-1 / 2-2) ─────────────────────── */
type VideoSeatData = {
  index: number;
  isHostSeat: boolean;
  member?: Member;
  remote?: RemoteUser;
  fallbackUser: { username: string | null; avatar: string | null } | null;
  onClaim: () => void;
  onLike: () => void;
  likeCount: number;
};

function VideoSeatGrid({
  coverUrl,
  isLive,
  layout,
  seats,
}: {
  coverUrl: string | null;
  isLive: boolean;
  layout: "SOLO" | "1/1" | "2/2";
  seats: VideoSeatData[];
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  async function goFullscreen() {
    const el = wrapRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await el.requestFullscreen();
    } catch {
      /* ignore */
    }
  }

  const gridClass =
    layout === "SOLO"
      ? "grid grid-cols-1 gap-0"
      : layout === "1/1"
        ? "grid grid-cols-2 gap-1.5"
        : "grid grid-cols-2 grid-rows-2 gap-1.5";

  return (
    <div className="relative z-10 mx-auto w-full max-w-md shrink-0 px-3 pt-2">
      <div
        ref={wrapRef}
        className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl border border-white/10 bg-black/60 p-1.5"
      >
        <div className={`h-full w-full ${gridClass}`}>
          {seats.map((s) => (
            <VideoTile key={s.index} data={s} coverUrl={coverUrl} />
          ))}
        </div>
        {/* Top badges overlay */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-2.5">
          <span className="rounded-full border border-white/20 bg-black/50 px-2.5 py-0.5 text-[10px] font-black text-white backdrop-blur">
            {layout}
          </span>
          <span className="flex items-center gap-1 rounded-full border border-white/20 bg-black/50 px-2 py-0.5 text-[10px] font-black text-white backdrop-blur">
            <span className={`h-1.5 w-1.5 rounded-full ${isLive ? "bg-red-500 animate-pulse" : "bg-white/40"}`} />
            {isLive ? "LIVE" : "OFF"}
          </span>
        </div>
        <button
          onClick={goFullscreen}
          aria-label="Fullscreen"
          className="absolute bottom-2 right-2 grid h-7 w-7 place-items-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function VideoTile({
  data,
  coverUrl,
}: {
  data: VideoSeatData;
  coverUrl: string | null;
}) {
  const videoRef = useRef<HTMLDivElement | null>(null);
  const { member, remote, isHostSeat, fallbackUser, onClaim, onLike, index, likeCount } = data;

  useEffect(() => {
    if (remote?.videoTrack && videoRef.current) {
      remote.videoTrack.play(videoRef.current, { fit: "cover" });
    }
    return () => {
      remote?.videoTrack?.stop();
    };
  }, [remote?.videoTrack]);

  const displayAvatar = member?.user?.avatar ?? fallbackUser?.avatar ?? null;
  const displayName = member?.user?.username ?? fallbackUser?.username ?? null;
  const speaking = remote?.hasAudio && !member?.is_muted;
  const label = `No.${index + 1}`;

  return (
    <button
      onClick={() => (member ? onLike() : onClaim())}
      className={`relative h-full w-full overflow-hidden rounded-2xl border bg-black/60 ${
        isHostSeat
          ? "border-[color:var(--gold)]/70 shadow-[0_0_18px_-2px_color-mix(in_oklab,var(--gold)_60%,transparent)]"
          : speaking
            ? "border-[color:var(--primary)]/70"
            : "border-white/15"
      }`}
      aria-label={member ? `Like ${label}` : `Take ${label}`}
    >
      {remote?.videoTrack ? (
        <div ref={videoRef} className="absolute inset-0" />
      ) : displayAvatar ? (
        <img src={displayAvatar} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />
      ) : coverUrl ? (
        <img src={coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-[color:var(--secondary)]/40 to-black">
          <Video className="h-10 w-10 text-white/30" />
        </div>
      )}

      {/* label */}
      <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-black text-white backdrop-blur">
        {label}
      </span>
      {isHostSeat && (
        <span className="absolute right-2 top-2 rounded-full bg-[color:var(--gold)]/25 px-1.5 py-0.5 text-[10px] font-black text-[color:var(--gold)] backdrop-blur">
          ♛ HOST
        </span>
      )}

      {/* footer chip */}
      <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10.5px] font-bold text-white backdrop-blur">
          {member?.is_muted ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
          <span className="truncate max-w-[90px]">
            {displayName ? `@${displayName}` : "Empty"}
          </span>
        </span>
        {member && (
          <span className="flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white/90 backdrop-blur">
            <Heart className="h-2.5 w-2.5 text-rose-400" /> {likeCount}
          </span>
        )}
      </div>
    </button>
  );
}


function StageBtn({
  icon,
  label,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void | Promise<void>;
  active?: boolean;
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick ? () => void onClick() : undefined}
      className={`grid h-7 w-7 place-items-center rounded-full border backdrop-blur ${
        active
          ? "border-[color:var(--primary)]/60 bg-[color:var(--primary)]/25 text-white"
          : "border-white/20 bg-black/50 text-white"
      }`}
    >
      {icon}
    </button>
  );
}

function MiniAction({
  icon,
  label,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex min-h-[70px] flex-col items-center justify-center gap-1 rounded-xl border py-2 backdrop-blur transition ${
        active
          ? "border-[color:var(--primary)]/60 bg-[color:var(--primary)]/20 text-emerald-300"
          : "border-violet-300/25 bg-black/30 text-white/88"
      }`}
    >
      {icon}
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );
}

function ChatLine({ m, isMe }: { m: Message; isMe: boolean }) {
  const body = m.text ?? m.message ?? "";
  if (m.kind === "gift") {
    return (
      <div className="inline-flex max-w-[95%] items-center gap-1.5 rounded-full border border-[color:var(--gold)]/40 bg-gradient-to-r from-[color:var(--gold)]/20 to-[color:var(--destructive)]/10 px-2.5 py-1 text-[11px] font-bold text-[color:var(--gold)]">
        🎁 <span className="text-white/80">@{m.user?.username ?? "user"}</span> sent{" "}
        {body}
      </div>
    );
  }
  if (m.kind === "system" || m.kind === "join" || m.kind === "leave") {
    return (
      <div className="text-[10.5px] leading-snug text-white/60">
        <span className="mr-1 rounded bg-white/10 px-1 py-0.5 text-[9px] font-black uppercase text-white/70">
          {m.kind}
        </span>
        {body || (m.kind === "join" ? "joined the room" : "left the room")}
      </div>
    );
  }
  const initial = (m.user?.username ?? "U").charAt(0).toUpperCase();
  return (
    <div className="flex max-w-full items-start gap-1.5">
      {m.user?.avatar ? (
        <img
          src={m.user.avatar}
          alt=""
          className="mt-0.5 h-5 w-5 shrink-0 rounded-full border border-white/20 object-cover"
        />
      ) : (
        <div className="glow-4d mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--secondary)] text-[9px] font-bold text-white">
          {initial}
        </div>
      )}
      <div
        className={`rounded-xl border px-2 py-1 backdrop-blur-sm ${
          isMe
            ? "border-[color:var(--primary)]/50 bg-gradient-to-br from-[color:var(--primary)]/25 to-[color:var(--secondary)]/20"
            : "border-white/10 bg-black/50"
        }`}
      >
        <span className="mr-1 text-[10px] font-bold text-[color:var(--gold)]">
          @{m.user?.username ?? "user"}:
        </span>
        <span className="break-words text-[11.5px] leading-snug text-white/95">
          {body}
        </span>
      </div>
    </div>
  );
}

function EmptyChat() {
  return (
    <div className="grid h-full place-items-center py-4 text-center text-[11px] leading-snug text-white/50">
      <p>Say hi to break the ice 👋</p>
    </div>
  );
}

/* ─── Follow + daily love heart chip (next to host name) ─── */
function FollowLoveChip({
  isFollowing,
  onFollow,
  onLove,
  cooling,
  blink,
}: {
  isFollowing: boolean;
  onFollow: () => void;
  onLove: () => void;
  cooling: boolean;
  blink: boolean;
}) {
  if (!isFollowing) {
    return (
      <button
        onClick={onFollow}
        aria-label="Follow host"
        className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--secondary)] text-white shadow-[0_0_10px_-2px_color-mix(in_oklab,var(--primary)_60%,transparent)] transition active:scale-90"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={3} />
      </button>
    );
  }
  return (
    <button
      onClick={onLove}
      aria-label="Send daily love (100 coins)"
      title={cooling ? "Come back tomorrow" : "Daily love · 100 coins"}
      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border transition active:scale-90 ${
        blink
          ? "animate-pulse border-rose-400 bg-rose-500/30 text-rose-300 shadow-[0_0_14px_-2px_rgba(244,63,94,0.9)]"
          : cooling
            ? "border-white/15 bg-black/60 text-white/40"
            : "border-white/20 bg-black/70 text-white hover:bg-black/90"
      }`}
    >
      <Heart
        className="h-3.5 w-3.5"
        fill={blink ? "currentColor" : cooling ? "rgba(255,255,255,0.35)" : "#111"}
        strokeWidth={2}
      />
    </button>
  );
}




function EnterRoomBanner({ latestEnter }: { latestEnter: Message | null }) {
  const [visible, setVisible] = useState(false);
  const [shown, setShown] = useState<Message | null>(null);

  useEffect(() => {
    if (!latestEnter?.user) return;
    setShown(latestEnter);
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 4500);
    return () => clearTimeout(t);
  }, [latestEnter?.id]);

  if (!shown?.user) return null;
  const name = shown.user.username ?? "guest";
  const level = shown.user.level ?? 1;
  const avatar = shown.user.avatar;
  const tier = tierForLevel(level);

  return (
    <div
      key={shown.id}
      className={`pointer-events-auto transition-all duration-500 ease-out ${
        visible ? "translate-x-0 opacity-100" : "-translate-x-6 opacity-0"
      }`}
    >
      <div
        className="relative flex items-center gap-2 overflow-hidden rounded-full py-1.5 pl-1.5 pr-2 backdrop-blur-md"
        style={{
          background: `linear-gradient(90deg, ${tier.color}55 0%, #0a0114cc 55%, ${tier.color}33 100%)`,
          border: `1.5px solid ${tier.color}cc`,
          boxShadow: `0 0 24px -4px ${tier.color}, inset 0 0 20px ${tier.color}22`,
        }}
      >
        {/* shimmer sweep */}
        <span
          className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 animate-[shimmer_2s_linear_infinite]"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)",
          }}
        />

        {/* Avatar with tier ring */}
        <div
          className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full"
          style={{ boxShadow: `0 0 10px ${tier.color}` }}
        >
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `conic-gradient(from 0deg, ${tier.color}, #fff, ${tier.color})`,
            }}
          />
          <div className="absolute inset-[2px] overflow-hidden rounded-full bg-gradient-to-br from-[color:var(--primary)]/60 to-[color:var(--secondary)]/60">
            {avatar ? (
              <img src={avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center text-white/80">
                <UserIcon className="h-4 w-4" />
              </div>
            )}
          </div>
        </div>

        {/* Name + status */}
        <div className="relative min-w-0 flex-1 leading-tight">
          <div className="truncate text-[12.5px] font-black text-white">
            <span
              className="uppercase tracking-wide"
              style={{ textShadow: `0 0 8px ${tier.color}` }}
            >
              {name}
            </span>
          </div>
          <div className="truncate text-[10px] font-medium text-white/85">
            🎉 Welcome to the room — enjoy your stay!
          </div>
        </div>

        {/* Level chip */}
        <div className="relative flex flex-col items-end gap-0 pr-1 text-right leading-none">
          <span className="text-[9px] font-black uppercase tracking-widest text-white/85">
            Level {level}
          </span>
          <span
            className="text-[10px] font-black uppercase tracking-widest"
            style={{ color: tier.color, textShadow: `0 0 6px ${tier.color}` }}
          >
            {tier.label}
          </span>
        </div>

        {/* Rank badge */}
        <div className="relative shrink-0">
          <LevelBadge level={level} size="sm" showLabel={false} />
        </div>
      </div>
    </div>
  );
}


function BottomRoomTab({
  icon,
  label,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 text-[12px] font-medium ${
        active ? "text-[color:var(--secondary)]" : "text-white/85"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function HeaderIcon({
  children,
  onClick,
  label,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`grid h-9 w-9 place-items-center rounded-full border border-white/10 backdrop-blur-md ${
        danger ? "bg-[color:var(--destructive)]/90 text-white" : "bg-white/5 text-white/85"
      }`}
    >
      {children}
    </button>
  );
}

function DockIcon({
  children,
  onClick,
  label,
  glow,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  glow?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 backdrop-blur-md ${
        glow
          ? "bg-gradient-to-br from-[color:var(--gold)] via-[color:var(--destructive)] to-[color:var(--primary)] text-white shadow-lg shadow-[color:var(--destructive)]/30"
          : "bg-white/10 text-white/85"
      }`}
    >
      {children}
    </button>
  );
}

/* ─── Voice seat with No.X label + heart counter ─────────────── */
function Seat({
  index,
  member,
  remote,
  isHostSeat,
  cover,
  fallbackUser,
  onClaim,
  likeCount,
  onLike,
  videoStyle,
  glowing,
  locked,
  onEmptyManage,
  giftPoints = 0,
  receivedGift = false,
  isKing = false,
}: {
  index: number;
  member?: Member;
  remote?: RemoteUser;
  isHostSeat: boolean;
  cover: string | null;
  fallbackUser?: { username: string | null; avatar: string | null } | null;
  onClaim: () => void;
  likeCount: number;
  onLike: () => void;
  videoStyle?: boolean;
  glowing?: boolean;
  locked?: boolean;
  onEmptyManage?: () => void;
  giftPoints?: number;
  receivedGift?: boolean;
  isKing?: boolean;
}) {
  const videoRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (remote?.videoTrack && videoRef.current) {
      remote.videoTrack.play(videoRef.current, { fit: "cover" });
    }
    return () => {
      remote?.videoTrack?.stop();
    };
  }, [remote?.videoTrack]);

  const label = `No.${index + 1}`;
  const speaking = remote?.hasAudio && !member?.is_muted;

  const displayAvatar = member?.user?.avatar ?? fallbackUser?.avatar ?? null;
  const displayName = member?.user?.username ?? fallbackUser?.username ?? null;

  const ringClass = isHostSeat
    ? "ring-2 ring-[color:var(--gold)] shadow-[0_0_18px_-2px_color-mix(in_oklab,var(--gold)_60%,transparent)]"
    : speaking
      ? "ring-2 ring-[color:var(--primary)]"
      : "ring-1 ring-white/15";

  if (videoStyle) {
    const numberLabel = String(index + 1).padStart(2, "0");
    return (
      <button
        onClick={() => (member ? undefined : onClaim())}
        className="relative aspect-[1.02/1] overflow-hidden rounded-xl border border-violet-300/55 bg-[radial-gradient(circle_at_50%_35%,rgba(139,92,246,0.22),rgba(5,7,24,0.78)_60%),linear-gradient(145deg,rgba(255,255,255,0.07),rgba(255,255,255,0.015))] shadow-[inset_0_0_22px_rgba(255,255,255,0.035)]"
        aria-label={member ? `Seat ${numberLabel}` : `Take seat ${numberLabel}`}
      >
        <span className="absolute left-1.5 top-1 text-[11px] font-medium leading-none text-white/90">
          {numberLabel}
        </span>
        {isHostSeat && (
          <span className="absolute right-1.5 top-1 rounded-full bg-[color:var(--gold)]/20 px-1 text-[9px] text-[color:var(--gold)]">
            ♛
          </span>
        )}
        <div className="absolute inset-x-0 top-[28%] grid place-items-center">
          {displayAvatar && !remote?.videoTrack ? (
            <img
              src={displayAvatar}
              alt=""
              className="h-10 w-10 rounded-full border border-white/30 object-cover shadow-lg"
            />
          ) : remote?.videoTrack ? (
            <div ref={videoRef} className="h-11 w-11 overflow-hidden rounded-full" />
          ) : (
            <span className="text-4xl leading-none drop-shadow-[0_10px_12px_rgba(0,0,0,0.55)]">
              📹
            </span>
          )}
        </div>
        <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 text-[10px] font-medium text-white/72">
          {member?.is_muted ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
          <span>{displayName ? `@${displayName}` : "Solo"}</span>
        </div>
        {member?.is_moderator && !isHostSeat && (
          <span
            title="Moderator"
            className="absolute right-1.5 bottom-1.5 grid h-2.5 w-2.5 place-items-center rounded-full bg-sky-500 ring-2 ring-black shadow-[0_0_8px_rgba(56,189,248,0.9)]"
          />
        )}
      </button>
    );
  }

  return (
    <div
      data-seat-index={index}
      className={`relative flex flex-col items-center gap-0.5 rounded-full transition-shadow duration-300 ${
        glowing
          ? "shadow-[0_0_28px_6px_color-mix(in_oklab,var(--gold)_65%,transparent)] animate-pulse"
          : ""
      }`}
    >
      <button
        onClick={() => {
          if (member) return onLike();
          if (locked && onEmptyManage) return onEmptyManage();
          if (locked) return;
          if (onEmptyManage) return onEmptyManage();
          return onClaim();
        }}
        className="relative aspect-square w-full"
        aria-label={member ? `Manage seat ${label}` : locked ? `Locked ${label}` : `Take ${label}`}
      >
        {isHostSeat && (
          <div className="pointer-events-none absolute inset-[-6%] rounded-full border-2 border-dashed border-[color:var(--gold)]/60 animate-spin-slow" />
        )}
        {locked && !member && (
          <div className="pointer-events-none absolute inset-[8%] z-20 grid place-items-center rounded-full bg-black/60 backdrop-blur-sm">
            <span className="text-lg">🔒</span>
          </div>
        )}
        <div className={`absolute inset-[8%] overflow-hidden rounded-full bg-white/5 ${ringClass}`}>
          {isHostSeat && !displayAvatar && cover && (
            <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
          )}
          {displayAvatar && !remote?.videoTrack && (
            <img src={displayAvatar} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )}
          {remote?.videoTrack && <div ref={videoRef} className="absolute inset-0" />}
          {!displayAvatar && !remote?.videoTrack && (
            <div className="absolute inset-0 grid place-items-center">
              {isHostSeat ? (
                <div className="relative grid h-full w-full place-items-center">
                  <Crown className="absolute top-1 h-3 w-3 text-[color:var(--gold)]" />
                  <Armchair className="h-1/2 w-1/2 text-[color:var(--gold)]/90" strokeWidth={1.5} />
                </div>
              ) : (
                <Armchair className="h-1/2 w-1/2 text-white/60" strokeWidth={1.5} />
              )}
            </div>
          )}
        </div>
        {isHostSeat && displayAvatar && (
          <span className="absolute -top-1 left-1/2 z-10 -translate-x-1/2 rounded bg-gradient-to-r from-[color:var(--gold)] to-amber-500 px-1 py-0.5 text-[8px] font-black uppercase tracking-wider text-black shadow">
            <Crown className="inline h-2 w-2" />
          </span>
        )}
        {(member || (isHostSeat && displayAvatar)) && (
          <span className="absolute bottom-0.5 right-0.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-black/70">
            {member?.is_muted ? (
              <MicOff className="h-2 w-2 text-[color:var(--destructive)]" />
            ) : (
              <Mic className="h-2 w-2 text-[color:var(--primary)]" />
            )}
          </span>
        )}
        {member?.is_moderator && !isHostSeat && (
          <span
            title="Moderator"
            className="absolute -top-0.5 -right-0.5 z-20 grid h-3 w-3 place-items-center rounded-full bg-sky-500 ring-2 ring-black shadow-[0_0_8px_rgba(56,189,248,0.9)]"
          />
        )}
        {likeCount > 0 && (
          <span className="absolute -bottom-0.5 left-0.5 z-10 flex items-center gap-0.5 rounded-full bg-black/70 px-1 py-[1px] text-[8px] font-bold text-white/80 backdrop-blur">
            <Heart className="h-2 w-2 text-[color:var(--destructive)]" />
            {likeCount}
          </span>
        )}
      </button>
      <span className={`text-[10px] font-black leading-tight ${isHostSeat ? "text-[color:var(--gold)]" : "text-white/90"}`}>
        {label}
      </span>
    </div>
  );
}

function SeatsSheet({
  open,
  onClose,
  value,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  value: number;
  onChange: (next: number) => void;
}) {
  const [n, setN] = useState(value);
  useEffect(() => {
    if (open) setN(value);
  }, [open, value]);
  if (!open) return null;
  const presets = [4, 6, 8, 12, 16, 20];
  const clamp = (x: number) => Math.max(4, Math.min(20, x));
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 rounded-t-3xl border-t border-border bg-card p-5 shadow-2xl"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-[color:var(--destructive)]" />
          <h2 className="text-lg font-extrabold">Room Seats</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Choose how many seats your room has (minimum 4, maximum 20).
        </p>
        <div className="mt-5 flex items-center justify-center gap-6">
          <button
            onClick={() => setN((v) => clamp(v - 1))}
            disabled={n <= 4}
            aria-label="Fewer seats"
            className="grid h-12 w-12 place-items-center rounded-full border border-border bg-background/60 disabled:opacity-30"
          >
            <Minus className="h-5 w-5" />
          </button>
          <div className="grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br from-[color:var(--gold)] to-[color:var(--destructive)] text-3xl font-extrabold text-primary-foreground shadow-lg">
            {n}
          </div>
          <button
            onClick={() => setN((v) => clamp(v + 1))}
            disabled={n >= 20}
            aria-label="More seats"
            className="grid h-12 w-12 place-items-center rounded-full border border-border bg-background/60 disabled:opacity-30"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {presets.map((p) => {
            const active = n === p;
            return (
              <button
                key={p}
                onClick={() => setN(p)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                  active
                    ? "bg-gradient-to-r from-[color:var(--destructive)] to-[color:var(--primary)] text-primary-foreground"
                    : "border border-border bg-background/60 text-foreground/80"
                }`}
              >
                {p} seats
              </button>
            );
          })}
        </div>
        <button
          onClick={() => onChange(n)}
          className="mt-5 w-full rounded-full bg-gradient-to-r from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--destructive)] py-3.5 text-base font-extrabold text-primary-foreground"
        >
          Done
        </button>
      </div>
    </>
  );
}

/* ─── Premium video room settings sheet ───────────────────────── */
type VideoFxKey = "beauty" | "mirror" | "hd" | "blur";

function VideoSettingsSheet({
  open,
  onClose,
  isHost,
  fx,
  onFxChange,
  videoOn,
  onToggleVideo,
  muted,
  onToggleMute,
  onOpenSeats,
  onOpenMusic,
  onOpenGames,
  onShare,
  onEndLive,
  onPk,
}: {
  open: boolean;
  onClose: () => void;
  isHost: boolean;
  fx: Record<VideoFxKey, boolean>;
  onFxChange: (k: VideoFxKey, v: boolean) => void;
  videoOn: boolean;
  onToggleVideo: () => void;
  muted: boolean;
  onToggleMute: () => void;
  onOpenSeats: () => void;
  onOpenMusic: () => void;
  onOpenGames: () => void;
  onShare: () => void;
  onEndLive: () => void;
  onPk: () => void;
}) {
  if (!open) return null;
  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 rounded-t-3xl border-t border-white/10 bg-gradient-to-b from-[#1a0b2e] via-[#2d0b4d] to-[#0a0114] p-5 text-white shadow-2xl"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/25" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">
            <span className="bg-gradient-to-r from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--secondary)] bg-clip-text text-transparent">
              Room Settings
            </span>
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Video FX row */}
        {(isHost || videoOn) && (
          <>
            <div className="mb-2 text-[11px] font-black uppercase tracking-widest text-white/50">
              Video Effects
            </div>
            <div className="mb-4 grid grid-cols-4 gap-2">
              <FxToggle
                icon={<Sparkles className="h-4 w-4" />}
                label="Beauty"
                active={fx.beauty}
                onClick={() => onFxChange("beauty", !fx.beauty)}
              />
              <FxToggle
                icon={<FlipHorizontal className="h-4 w-4" />}
                label="Mirror"
                active={fx.mirror}
                onClick={() => onFxChange("mirror", !fx.mirror)}
              />
              <FxToggle
                icon={<Video className="h-4 w-4" />}
                label={fx.hd ? "HD" : "SD"}
                active={fx.hd}
                onClick={() => onFxChange("hd", !fx.hd)}
              />
              <FxToggle
                icon={<Grid3x3 className="h-4 w-4" />}
                label="Blur BG"
                active={fx.blur}
                onClick={() => onFxChange("blur", !fx.blur)}
              />
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2">
              <button
                onClick={onToggleVideo}
                className={`flex items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-bold ${
                  videoOn
                    ? "border-[color:var(--primary)]/50 bg-[color:var(--primary)]/20 text-white"
                    : "border-white/15 bg-white/5 text-white/80"
                }`}
              >
                {videoOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                {videoOn ? "Camera On" : "Camera Off"}
              </button>
              <button
                onClick={onToggleMute}
                className={`flex items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-bold ${
                  muted
                    ? "border-white/15 bg-white/5 text-white/80"
                    : "border-[color:var(--primary)]/50 bg-[color:var(--primary)]/20 text-white"
                }`}
              >
                {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {muted ? "Mic Off" : "Mic On"}
              </button>
            </div>
          </>
        )}

        {/* Actions grid */}
        <div className="mb-2 text-[11px] font-black uppercase tracking-widest text-white/50">
          Room Tools
        </div>
        <div className="grid grid-cols-4 gap-2">
          <ToolBtn icon={<Music className="h-5 w-5" />} label="Music" onClick={onOpenMusic} disabled={!isHost} />
          <ToolBtn icon={<Gamepad2 className="h-5 w-5" />} label="Games" onClick={onOpenGames} />
          <ToolBtn icon={<Swords className="h-5 w-5" />} label="PK" onClick={onPk} />
          <ToolBtn icon={<Share2 className="h-5 w-5" />} label="Invite" onClick={onShare} />
          {isHost && (
            <ToolBtn icon={<Armchair className="h-5 w-5" />} label="Seats" onClick={onOpenSeats} />
          )}
          <ToolBtn icon={<Users className="h-5 w-5" />} label="Guests" onClick={() => {}} />
          <ToolBtn icon={<Trophy className="h-5 w-5" />} label="Rank" onClick={() => {}} />
          <ToolBtn icon={<Flame className="h-5 w-5" />} label="Boost" onClick={() => {}} />
        </div>

        {isHost && (
          <button
            onClick={onEndLive}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-rose-500 via-[color:var(--destructive)] to-rose-600 py-3.5 text-sm font-black text-white shadow-lg shadow-rose-500/30"
          >
            <Power className="h-4 w-4" /> End Live
          </button>
        )}
      </div>
    </>
  );
}

function FxToggle({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 rounded-2xl border py-3 transition ${
        active
          ? "border-[color:var(--gold)]/60 bg-gradient-to-br from-[color:var(--gold)]/25 to-[color:var(--primary)]/15 text-white shadow-[0_0_18px_-4px_color-mix(in_oklab,var(--gold)_50%,transparent)]"
          : "border-white/12 bg-white/5 text-white/70"
      }`}
    >
      {icon}
      <span className="text-[10.5px] font-bold">{label}</span>
    </button>
  );
}

function ToolBtn({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-white/12 bg-white/5 py-3 text-white/85 transition hover:bg-white/10 disabled:opacity-40"
    >
      {icon}
      <span className="text-[10.5px] font-bold">{label}</span>
    </button>
  );
}

/* ─── Seat Action Sheet (host manages a seated user) ─────────── */
function SeatActionSheet({
  member,
  canModerate,
  canLock,
  isSeatLocked,
  onClose,
  onToggleModerator,
  onKickFromSeat,
  onToggleLock,
}: {
  member: Member | null;
  canModerate: boolean;
  canLock: boolean;
  isSeatLocked: boolean;
  onClose: () => void;
  onToggleModerator: () => void;
  onKickFromSeat: () => void;
  onToggleLock: () => void;
}) {
  if (!member) return null;
  const name = member.user?.username ?? "User";
  const avatar = member.user?.avatar ?? null;
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 rounded-t-3xl border-t border-border bg-card p-5 shadow-2xl"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <div className="flex items-center gap-3">
          {avatar ? (
            <img src={avatar} alt="" className="h-12 w-12 rounded-full object-cover" />
          ) : (
            <div className="grid h-12 w-12 place-items-center rounded-full bg-white/10 text-lg font-bold">
              {name[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-extrabold">@{name}</div>
            <div className="text-[11px] text-muted-foreground">
              {member.is_moderator ? "Moderator" : "On seat"}
              {isSeatLocked ? " · 🔒 locked" : ""}
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-2">
          {canModerate && (
            <button
              onClick={onToggleModerator}
              className="w-full rounded-2xl border border-[color:var(--primary)]/40 bg-[color:var(--primary)]/15 py-3 text-sm font-bold text-white"
            >
              {member.is_moderator ? "Remove as Moderator" : "Make Moderator"}
            </button>
          )}
          {canLock && (
            <button
              onClick={onToggleLock}
              className="w-full rounded-2xl border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 py-3 text-sm font-bold text-[color:var(--gold)]"
            >
              {isSeatLocked ? "🔓 Unlock Seat" : "🔒 Lock Seat"}
            </button>
          )}
          {canModerate && (
            <button
              onClick={onKickFromSeat}
              className="w-full rounded-2xl bg-[color:var(--destructive)]/80 py-3 text-sm font-bold text-white"
            >
              Remove from Seat
            </button>
          )}
          <button
            onClick={onClose}
            className="mt-1 w-full rounded-2xl border border-border py-3 text-sm font-bold"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

/* ─── Empty Seat Sheet (host/mod: lock or invite) ────────────── */
function EmptySeatSheet({
  seatIndex,
  isLocked,
  onClose,
  onToggleLock,
  onInvite,
  onSitHere,
}: {
  seatIndex: number | null;
  isLocked: boolean;
  onClose: () => void;
  onToggleLock: () => void;
  onInvite: () => void;
  onSitHere: () => void;
}) {
  if (seatIndex == null) return null;
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 rounded-t-3xl border-t border-border bg-card p-5 shadow-2xl"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <div className="text-center text-sm font-black">
          Seat {seatIndex + 1} {isLocked ? "· 🔒 Locked" : ""}
        </div>
        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={onSitHere}
            className="w-full rounded-2xl bg-gradient-to-r from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--secondary)] py-3 text-sm font-black text-white shadow-lg"
          >
            Sit here
          </button>
          <button
            onClick={onInvite}
            className="w-full rounded-2xl border border-[color:var(--primary)]/40 bg-[color:var(--primary)]/15 py-3 text-sm font-bold text-white"
          >
            Invite a viewer
          </button>
          <button
            onClick={onToggleLock}
            className="w-full rounded-2xl border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 py-3 text-sm font-bold text-[color:var(--gold)]"
          >
            {isLocked ? "🔓 Unlock Seat" : "🔒 Lock Seat"}
          </button>
          <button
            onClick={onClose}
            className="mt-1 w-full rounded-2xl border border-border py-3 text-sm font-bold"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

/* ─── Viewers Sheet (list viewers + invite from host/mod) ────── */
function ViewersSheet({
  open,
  onClose,
  roomId,
  members,
  canInvite,
  userId,
}: {
  open: boolean;
  onClose: () => void;
  roomId: string;
  members: Member[];
  canInvite: boolean;
  userId: string | null;
}) {
  if (!open) return null;
  const viewers = members.filter((m) => m.seat_index == null);
  const seated = members.filter((m) => m.seat_index != null);

  async function invite(toUser: string) {
    const { error } = await supabase.from("seat_invites").insert({
      room_id: roomId,
      from_user: userId!,
      to_user: toUser,
      seat_index: null,
      status: "pending",
    });
    if (error) toast.error(error.message);
    else toast.success("Invite sent");
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="fixed bottom-0 left-1/2 z-50 flex max-h-[75vh] w-full max-w-[480px] -translate-x-1/2 flex-col rounded-t-3xl border-t border-violet-300/30 bg-gradient-to-b from-[#1a0b2e] to-[#050505] p-4 text-white shadow-2xl"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-black">
            Viewers <span className="text-white/50">· {viewers.length}</span>
          </h2>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {seated.length > 0 && (
            <>
              <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-white/40">
                On stage · {seated.length}
              </div>
              {seated.map((m) => (
                <ViewerRow key={m.user_id} member={m} showInvite={false} onInvite={() => {}} />
              ))}
              <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-white/40">
                Watching
              </div>
            </>
          )}
          {viewers.length === 0 && (
            <p className="py-6 text-center text-[12px] text-white/50">No viewers right now.</p>
          )}
          {viewers.map((m) => (
            <ViewerRow
              key={m.user_id}
              member={m}
              showInvite={canInvite && m.user_id !== userId}
              onInvite={() => void invite(m.user_id)}
            />
          ))}
        </div>
      </div>
    </>
  );
}

function ViewerRow({
  member,
  showInvite,
  onInvite,
}: {
  member: Member;
  showInvite: boolean;
  onInvite: () => void;
}) {
  const name = member.user?.username ?? "guest";
  const avatar = member.user?.avatar ?? null;
  const initial = name.slice(0, 1).toUpperCase();
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/5 p-2">
      {avatar ? (
        <img src={avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
      ) : (
        <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--secondary)] text-xs font-black text-white">
          {initial}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-bold text-white">@{name}</div>
        <div className="text-[10px] text-white/50">
          {member.is_moderator ? "Moderator" : member.seat_index != null ? `Seat ${member.seat_index + 1}` : "Viewer"}
        </div>
      </div>
      {showInvite && (
        <button
          onClick={onInvite}
          className="rounded-full bg-[color:var(--primary)] px-3 py-1.5 text-[11px] font-black text-white"
        >
          + Invite
        </button>
      )}
    </div>
  );
}

/* ─── Seat invite popup for the recipient ────────────────────── */
function SeatInvitePopup({
  invite,
  onAccept,
  onDecline,
}: {
  invite: { id: string; from_name: string | null; from_avatar: string | null; seat_index: number | null };
  onAccept: () => void;
  onDecline: () => void;
}) {
  const name = invite.from_name ?? "Host";
  const initial = name.slice(0, 1).toUpperCase();
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-3xl border border-[color:var(--gold)]/40 bg-gradient-to-b from-[#2d0b4d] to-[#0a0114] p-5 text-white shadow-2xl">
        <div className="flex flex-col items-center gap-3 text-center">
          {invite.from_avatar ? (
            <img src={invite.from_avatar} alt="" className="h-16 w-16 rounded-full border-2 border-[color:var(--gold)] object-cover" />
          ) : (
            <div className="grid h-16 w-16 place-items-center rounded-full border-2 border-[color:var(--gold)] bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--secondary)] text-xl font-black">
              {initial}
            </div>
          )}
          <p className="text-sm font-bold">
            <span className="text-[color:var(--gold)]">@{name}</span> ne aap ko seat pe bulaya hai
          </p>
          <p className="text-[11px] text-white/60">
            {invite.seat_index != null ? `Seat ${invite.seat_index + 1}` : "First available seat"}
          </p>
        </div>
        <div className="mt-5 flex gap-2">
          <button
            onClick={onDecline}
            className="flex-1 rounded-full border border-white/20 py-3 text-sm font-bold text-white/80"
          >
            Decline
          </button>
          <button
            onClick={onAccept}
            className="flex-1 rounded-full bg-gradient-to-r from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--secondary)] py-3 text-sm font-black text-white shadow-lg"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}


/* ─── Emoji reaction sheet: pick seat + emoji ─────────────── */
const REACTION_EMOJIS = [
  "❤️", "😂", "🔥", "👏", "😍", "🥰", "😎", "😘",
  "🤩", "🎉", "🌹", "💖", "💯", "😢", "😡", "👑",
  "🙏", "😴", "🤡", "🎁", "🍿", "💃", "🕺", "✨",
];

function EmojiReactionSheet({
  open,
  onClose,
  seatCount,
  seatsByIndex,
  defaultSeat,
  onSend,
}: {
  open: boolean;
  onClose: () => void;
  seatCount: number;
  seatsByIndex: Map<number, Member>;
  defaultSeat: number;
  onSend: (emoji: string, seat: number) => void;
}) {
  const [seat, setSeat] = useState(defaultSeat);
  useEffect(() => {
    if (open) setSeat(defaultSeat);
  }, [open, defaultSeat]);
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 rounded-t-3xl border-t border-violet-300/30 bg-gradient-to-b from-[#1a0b2e] to-[#050505] p-4 text-white shadow-2xl"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-black">Send reaction</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
          Target seat
        </div>
        <div className="mt-1.5 flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {Array.from({ length: seatCount })
            .map((_, i) => ({ i, m: seatsByIndex.get(i) }))
            .filter((x) => !!x.m)
            .map(({ i, m }) => {
              const active = seat === i;
              const avatar = m!.user?.avatar ?? null;
              const initial = (m!.user?.username ?? String(i + 1)).slice(0, 1).toUpperCase();
              return (
                <button
                  key={i}
                  onClick={() => setSeat(i)}
                  aria-label={`Seat ${i + 1}`}
                  className={`shrink-0 rounded-full p-[2px] transition ${
                    active
                      ? "bg-gradient-to-br from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--secondary)] shadow-[0_0_14px_-2px_color-mix(in_oklab,var(--gold)_60%,transparent)]"
                      : "bg-white/10"
                  }`}
                >
                  <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-black/40">
                    {avatar ? (
                      <img src={avatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[13px] font-black text-white/85">{initial}</span>
                    )}
                  </div>
                </button>
              );
            })}
          {Array.from({ length: seatCount }).every((_, i) => !seatsByIndex.get(i)) && (
            <span className="text-[11px] text-white/50">No one on stage yet.</span>
          )}
        </div>
        <div className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-white/60">
          Tap an emoji
        </div>
        <div className="mt-2 grid grid-cols-8 gap-1.5">
          {REACTION_EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => {
                onClose();
                setTimeout(() => onSend(e, seat), 0);
              }}
              className="grid aspect-square place-items-center rounded-xl border border-white/10 bg-white/5 text-2xl transition active:scale-90 hover:bg-white/15"
            >
              {e}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

/* ─── Flying emoji layer: bottom → target seat with glow ─── */
function FlyingEmojiLayer({
  emojis,
}: {
  emojis: { id: string; emoji: string; seat: number }[];
}) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[60]">
      {emojis.map((e) => (
        <FlyingEmoji key={e.id} emoji={e.emoji} seat={e.seat} />
      ))}
    </div>
  );
}

function FlyingEmoji({ emoji, seat }: { emoji: string; seat: number }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [target, setTarget] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    // Locate seat rect
    const el = document.querySelector<HTMLElement>(`[data-seat-index="${seat}"]`);
    const rect = el?.getBoundingClientRect();
    const startX = window.innerWidth / 2 + (Math.random() - 0.5) * 60;
    const startY = window.innerHeight - 60;
    setPos({ x: startX, y: startY });
    if (rect) {
      setTarget({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    } else {
      setTarget({ x: startX, y: startY - 300 });
    }
  }, [seat]);

  if (!pos || !target) return null;
  return (
    <span
      className="absolute text-4xl drop-shadow-[0_0_12px_rgba(255,215,0,0.9)]"
      style={{
        left: 0,
        top: 0,
        willChange: "transform, opacity",
        animation: "flyEmoji 2.2s cubic-bezier(0.22,1,0.36,1) forwards",
        ["--fx" as never]: `${pos.x - 16}px`,
        ["--fy" as never]: `${pos.y - 20}px`,
        ["--tx" as never]: `${target.x - 16}px`,
        ["--ty" as never]: `${target.y - 20}px`,
      }}
    >
      {emoji}
    </span>
  );
}
