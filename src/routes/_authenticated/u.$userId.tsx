import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { ItemAnimation } from "@/components/ItemAnimation";
import { BottomNav } from "@/components/layout/BottomNav";
import { LevelAvatar } from "@/components/LevelAvatar";
import { vipTierForLevel } from "@/lib/vip-levels";
import { VipProgressBar } from "@/components/vip/VipProgressBar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  ArrowLeft,
  MessageCircle,
  UserPlus,
  UserCheck,
  Crown,
  Coins,
  Gem,
  Trophy,
  Sparkles,
  Loader2,
  MapPin,
  Copy,
  Lock,
  Images,
  Share2,
  Gift,
  Flag,
  Ban,
  Eye,
  Users,
  Radio,
  ShieldCheck,
  BadgeCheck,
  Star,
  Heart,
  Flame,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/u/$userId")({
  component: UserProfilePage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-sm text-muted-foreground">{error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="p-8 text-center text-sm text-muted-foreground">User not found</div>
  ),
});

type FullProfile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar: string | null;
  frame: string | null;
  ring: string | null;
  bubble: string | null;
  car: string | null;
  entrance: string | null;
  special_id: string | null;
  data_card: string | null;
  bio: string | null;
  gender: string | null;
  country: string | null;
  coins: number;
  diamonds: number;
  level: number;
  xp: number;
  is_vip: boolean;
  vip_level: number;
  vip_expiry: string | null;
  user_code: string | null;
  last_seen: string | null;
  created_at: string;
  total_gifted_coins: number | null;
};

function UserProfilePage() {
  const { userId } = Route.useParams();
  const { user: me, isAdmin } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const isMe = me?.id === userId;

  const prof = useQuery({
    queryKey: ["public-profile", userId, me?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc("get_profile_public", { _id: userId })
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("User not found");
      return data as FullProfile;
    },
  });

  // Track profile view (visitors)
  useEffect(() => {
    if (!me || isMe) return;
    supabase.rpc("record_profile_view", { _owner: userId }).then(() => {
      qc.invalidateQueries({ queryKey: ["profile-visitors", userId] });
    });
  }, [me, isMe, userId, qc]);

  const stats = useQuery({
    queryKey: ["public-profile-stats", userId],
    queryFn: async () => {
      const [followers, following, xpRank, hostRooms, visitors] = await Promise.all([
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", userId),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", userId),
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .gt("xp", prof.data?.xp ?? 0),
        supabase.from("live_rooms").select("*", { count: "exact", head: true }).eq("host_id", userId).eq("status", "live"),
        supabase.from("profile_views").select("*", { count: "exact", head: true }).eq("owner_id", userId),
      ]);
      return {
        followers: followers.count ?? 0,
        following: following.count ?? 0,
        rank: (xpRank.count ?? 0) + 1,
        liveRooms: hostRooms.count ?? 0,
        visitors: visitors.count ?? 0,
      };
    },
    enabled: !!prof.data,
  });

  // Realtime: refresh stats on follows changes
  useEffect(() => {
    const ch = supabase
      .channel(`profile:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "follows", filter: `following_id=eq.${userId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["public-profile-stats", userId] });
          qc.invalidateQueries({ queryKey: ["is-following", me?.id, userId] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_rooms", filter: `host_id=eq.${userId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["public-profile-stats", userId] });
          qc.invalidateQueries({ queryKey: ["current-live-room", userId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, me?.id, qc]);

  const currentLive = useQuery({
    queryKey: ["current-live-room", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("live_rooms")
        .select("id, title, cover, room_type, viewer_count")
        .eq("host_id", userId)
        .eq("status", "live")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const followState = useQuery({
    queryKey: ["is-following", me?.id, userId],
    enabled: !!me && !isMe,
    queryFn: async () => {
      const { data } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", me!.id)
        .eq("following_id", userId)
        .maybeSingle();
      return !!data;
    },
  });

  const publicGallery = useQuery({
    queryKey: ["user-public-gallery", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gallery_images")
        .select("id, path")
        .eq("user_id", userId)
        .eq("is_public", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const albumAccess = useQuery({
    queryKey: ["album-access", me?.id, userId],
    enabled: !!me && !isMe,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gallery_unlocks")
        .select("status")
        .eq("owner_id", userId)
        .eq("viewer_id", me!.id)
        .maybeSingle();
      if (error) throw error;
      return (data?.status as "pending" | "accepted" | "revoked" | undefined) ?? null;
    },
  });

  const privateGallery = useQuery({
    queryKey: ["user-private-gallery", userId, albumAccess.data],
    enabled: albumAccess.data === "accepted" || isMe,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gallery_images")
        .select("id, path")
        .eq("user_id", userId)
        .eq("is_public", false)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const ownedItems = useQuery({
    queryKey: ["user-owned-items", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_themes")
        .select(
          "theme_id, expires_at, purchased_price_diamonds, themes:theme_id(id,name,preview_url,bg_image,animation_url,primary_color,accent_color,category_id,theme_categories:category_id(name,slug,icon_url))",
        )
        .eq("user_id", userId)
        .order("expires_at", { ascending: false, nullsFirst: true });
      if (error) throw error;
      return (data ?? []).filter((r: any) => r.themes);
    },
  });

  const requestAlbum = useMutation({
    mutationFn: async () => {
      if (!me) throw new Error("Sign in");
      const { error } = await supabase.from("gallery_unlocks").upsert(
        { owner_id: userId, viewer_id: me.id, status: "pending" },
        { onConflict: "owner_id,viewer_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Access request bhej diya");
      qc.invalidateQueries({ queryKey: ["album-access", me?.id, userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const follow = useMutation({
    mutationFn: async () => {
      if (!me) throw new Error("Sign in");
      if (followState.data) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", me.id)
          .eq("following_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("follows").insert({
          follower_id: me.id,
          following_id: userId,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["is-following", me?.id, userId] });
      qc.invalidateQueries({ queryKey: ["public-profile-stats", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const block = useMutation({
    mutationFn: async () => {
      if (!me) throw new Error("Sign in");
      const { error } = await supabase
        .from("blocked_users")
        .upsert(
          { blocker_id: me.id, blocked_id: userId },
          { onConflict: "blocker_id,blocked_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => toast.success("User blocked"),
    onError: (e: Error) => toast.error(e.message),
  });

  const report = useMutation({
    mutationFn: async () => {
      if (!me) throw new Error("Sign in");
      const reason = window.prompt("Report reason? (e.g. harassment, spam, nudity)");
      if (!reason || reason.trim().length < 3) return;
      const { error } = await supabase.rpc("submit_user_report", {
        _reported_user: userId,
        _room_id: null,
        _reason: reason.trim(),
        _details: null,
      });
      if (error) throw error;
    },
    onSuccess: (d) => { if (d !== undefined) toast.success("Report submitted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const shareProfile = async () => {
    const url = `${window.location.origin}/u/${userId}`;
    const title = prof.data?.username ?? prof.data?.full_name ?? "Jalwa profile";
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Profile link copied");
      }
    } catch {
      /* user cancelled */
    }
  };

  if (prof.isLoading) {
    return (
      <AppShell showHeader={false}>
        <div className="grid min-h-[100dvh] place-items-center">
          <Loader2 className="h-6 w-6 animate-spin text-[color:var(--gold)]" />
        </div>
        <BottomNav />
      </AppShell>
    );
  }

  if (prof.error || !prof.data) {
    return (
      <AppShell title="Profile">
        <p className="p-6 text-center text-sm text-muted-foreground">
          {(prof.error as Error)?.message ?? "User not found"}
        </p>
        <BottomNav />
      </AppShell>
    );
  }

  const p = prof.data;
  const tier = vipTierForLevel(p.vip_level ?? 0);
  const online =
    !!p.last_seen && Date.now() - new Date(p.last_seen).getTime() < 3 * 60 * 1000;
  const joined = new Date(p.created_at).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
  const displayName = p.username ?? p.full_name ?? "Member";

  return (
    <AppShell showHeader={false}>
      <div data-adaptive="neon" className="me-profile-screen me-profile-card relative min-h-[100dvh] bg-background pb-28 text-foreground">
        {/* Ambient neon backdrop */}
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] overflow-hidden">
          <div
            className="absolute inset-0 opacity-90"
            style={{
              background: `radial-gradient(80% 55% at 20% 10%, ${tier.glow ?? "#a855f7"}55 0%, transparent 60%),
                radial-gradient(70% 50% at 85% 5%, #ec489955 0%, transparent 55%),
                radial-gradient(60% 60% at 50% 90%, #f59e0b33 0%, transparent 65%),
                linear-gradient(180deg, #0d0620 0%, #07070D 75%)`,
            }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:22px_22px] opacity-40" />
        </div>

        {/* Top bar */}
        <div
          className="relative z-10 flex items-center justify-between px-4 pb-2 pt-3"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
        >
          <button
            onClick={() => nav({ to: "/" })}
            className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-white backdrop-blur-xl transition hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={shareProfile}
              className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-white backdrop-blur-xl transition hover:bg-white/10"
              aria-label="Share profile"
            >
              <Share2 className="h-4 w-4" />
            </button>
            {!isMe && (
              <>
                <button
                  onClick={() => report.mutate()}
                  className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-amber-300 backdrop-blur-xl transition hover:bg-white/10"
                  aria-label="Report"
                >
                  <Flag className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    if (confirm("Block this user?")) block.mutate();
                  }}
                  className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-red-400 backdrop-blur-xl transition hover:bg-white/10"
                  aria-label="Block"
                >
                  <Ban className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Data card entrance layer (preserved) */}
        {p.entrance && (
          <div className="pointer-events-none absolute inset-x-0 top-16 z-[1] h-12 overflow-hidden">
            {/\.(mp4|webm|mov)($|\?)/i.test(p.entrance) ? (
              <video src={p.entrance} autoPlay muted loop playsInline className="h-full w-full object-cover" />
            ) : (
              <img src={p.entrance} alt="" className="h-full w-full object-cover" />
            )}
          </div>
        )}

        {/* Hero card */}
        <div className="relative z-10 mx-4 mt-3">
          <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-2xl shadow-[0_20px_60px_-20px_rgba(168,85,247,0.55)]">
            {/* Gold corner brackets */}
            <CornerBrackets />
            {/* Shimmer border */}
            <div className="pointer-events-none absolute inset-0 rounded-[28px] [background:linear-gradient(120deg,transparent_30%,rgba(255,215,120,0.18)_50%,transparent_70%)] opacity-60 animate-[shimmer_6s_linear_infinite] [background-size:200%_100%]" />

            <div className="relative flex flex-col items-center">
              {/* Avatar with rotating aura */}
              <div className="relative">
                <div
                  className="absolute -inset-3 rounded-full opacity-80 blur-xl"
                  style={{
                    background: `conic-gradient(from 0deg, #a855f7, #ec4899, #f59e0b, #a855f7)`,
                  }}
                />
                <div className="relative rounded-full p-[3px]" style={{
                  background: "conic-gradient(from 0deg, #ffd76a, #ec4899, #a855f7, #22d3ee, #ffd76a)",
                }}>
                  <div data-keep-dark className="rounded-full bg-[#07070D] p-1">
                    <LevelAvatar
                      src={p.avatar}
                      name={displayName}
                      level={p.vip_level ?? 0}
                      size="xl"
                      showBadge
                      frame={p.frame}
                      ring={p.ring}
                    />
                  </div>
                </div>
                {/* Online pulse */}
                <span
                  className={`absolute bottom-2 right-2 grid h-5 w-5 place-items-center rounded-full border-2 border-[#07070D] ${
                    online ? "bg-emerald-400" : "bg-zinc-500"
                  }`}
                >
                  {online && <span className="h-2 w-2 animate-ping rounded-full bg-emerald-200" />}
                </span>
              </div>

              {/* Name row */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <h1 className="text-2xl font-black text-white" data-keep-dark>
                  {displayName}
                </h1>
                <BadgeCheck className="h-5 w-5 text-cyan-400 drop-shadow-[0_0_6px_rgba(34,211,238,0.7)]" />
                {p.is_vip && (
                  <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-[#ffd76a] via-amber-400 to-[#c9861f] px-2.5 py-0.5 text-[10px] font-black text-black shadow-[0_0_18px_rgba(255,200,80,0.55)]">
                    <Crown className="h-3 w-3" /> VIP{p.vip_level > 0 ? ` ${p.vip_level}` : ""}
                  </span>
                )}
              </div>

              {/* Chips row */}
              <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-white/70">
                {p.user_code && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(p.user_code!);
                      toast.success("ID copied");
                    }}
                    className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-bold text-white/80 hover:bg-white/10"
                  >
                    ID {p.user_code} <Copy className="h-3 w-3 opacity-60" />
                  </button>
                )}
                {p.country && (
                  <span className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                    <MapPin className="h-3 w-3" /> {p.country}
                  </span>
                )}
                {p.gender && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 capitalize">
                    {p.gender}
                  </span>
                )}
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                  Joined {joined}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 font-bold ${
                    online
                      ? "border border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                      : "border border-white/10 bg-white/5 text-white/60"
                  }`}
                >
                  {online ? "Online" : "Offline"}
                </span>
              </div>

              {p.bio && (
                <p className="mt-3 max-w-sm text-center text-[13px] leading-relaxed text-white/80">
                  {p.bio}
                </p>
              )}

              {/* Achievement badges */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
                {(p.vip_level ?? 0) >= 5 && <Achievement icon={<Crown className="h-3 w-3" />} label="Super VIP" color="from-amber-400 to-yellow-600" />}
                {(stats.data?.followers ?? 0) >= 100 && <Achievement icon={<Star className="h-3 w-3" />} label="Popular Star" color="from-pink-400 to-fuchsia-600" />}
                {(stats.data?.liveRooms ?? 0) > 0 && <Achievement icon={<Radio className="h-3 w-3" />} label="Live Host" color="from-emerald-400 to-teal-600" />}
                {(p.level ?? 0) >= 20 && <Achievement icon={<Flame className="h-3 w-3" />} label="Elite" color="from-orange-400 to-red-600" />}
                {(Number(p.total_gifted_coins ?? 0)) >= 10000 && <Achievement icon={<Gift className="h-3 w-3" />} label="Gift King" color="from-violet-400 to-purple-700" />}
                <Achievement icon={<ShieldCheck className="h-3 w-3" />} label="Verified" color="from-cyan-400 to-blue-600" />
              </div>

              {/* Primary actions */}
              {!isMe && (
                <div className="mt-5 grid w-full grid-cols-2 gap-2">
                  <button
                    onClick={() => follow.mutate()}
                    disabled={follow.isPending || followState.isLoading}
                    className={`group relative flex items-center justify-center gap-1.5 overflow-hidden rounded-full py-3 text-sm font-black transition disabled:opacity-60 ${
                      followState.data
                        ? "border border-white/15 bg-white/10 text-white"
                        : "text-white shadow-[0_10px_30px_-10px_rgba(236,72,153,0.7)]"
                    }`}
                    style={
                      followState.data
                        ? undefined
                        : { background: "linear-gradient(120deg,#a855f7,#ec4899,#f59e0b)" }
                    }
                  >
                    {follow.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : followState.data ? (
                      <>
                        <UserCheck className="h-4 w-4" /> Following
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4" /> Follow
                      </>
                    )}
                  </button>
                  <Link
                    to="/messages/$peerId"
                    params={{ peerId: userId }}
                    className="flex items-center justify-center gap-1.5 rounded-full border border-[color:var(--gold)]/30 bg-[color:var(--gold)]/10 py-3 text-sm font-black text-[color:var(--gold)] transition hover:bg-[color:var(--gold)]/20"
                  >
                    <MessageCircle className="h-4 w-4" /> Message
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        {!isMe && (
          <div className="mx-4 mt-3 grid grid-cols-4 gap-2">
            <QuickAction icon={<Gift className="h-4 w-4" />} label="Gift" onClick={() => toast.info("Open gifting from a live room")} tone="gold" />
            <QuickAction icon={<Users className="h-4 w-4" />} label="Invite" onClick={() => toast.info("Invite from your live room")} tone="violet" />
            <QuickAction icon={<Share2 className="h-4 w-4" />} label="Share" onClick={shareProfile} tone="cyan" />
            <QuickAction icon={<Heart className="h-4 w-4" />} label={followState.data ? "Liked" : "Like"} onClick={() => follow.mutate()} tone="pink" />
          </div>
        )}

        {/* LIVE now card */}
        {currentLive.data && (
          <Link
            to="/room/$roomId"
            params={{ roomId: currentLive.data.id }}
            className="mx-4 mt-4 flex items-center gap-3 overflow-hidden rounded-2xl border border-emerald-400/40 bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-transparent p-3 backdrop-blur-xl transition hover:from-emerald-500/30"
          >
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-black/40">
              {currentLive.data.cover ? (
                <img src={currentLive.data.cover} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-emerald-300">
                  <Radio className="h-6 w-6" />
                </div>
              )}
              <span className="absolute left-1 top-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-white shadow">
                Live
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black">{currentLive.data.title ?? "Live now"}</p>
              <p className="mt-0.5 flex items-center gap-2 text-[11px] text-white/70">
                <span className="capitalize">{currentLive.data.room_type} room</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3" /> {currentLive.data.viewer_count ?? 0}
                </span>
              </p>
            </div>
            <span className="rounded-full bg-emerald-400 px-3 py-1.5 text-[11px] font-black text-emerald-950">
              Join
            </span>
          </Link>
        )}

        {/* Stats dashboard */}
        <div className="mx-4 mt-4 grid grid-cols-3 gap-2">
          <Stat label="Followers" value={compact(stats.data?.followers ?? 0)} icon={<Users className="h-3 w-3 text-fuchsia-300" />} />
          <Stat label="Following" value={compact(stats.data?.following ?? 0)} icon={<UserPlus className="h-3 w-3 text-violet-300" />} />
          <Stat label="Visitors" value={compact(stats.data?.visitors ?? 0)} icon={<Eye className="h-3 w-3 text-cyan-300" />} />
          <Stat label="Rank" value={stats.data?.rank ? `#${compact(stats.data.rank)}` : "—"} icon={<Trophy className="h-3 w-3 text-[color:var(--gold)]" />} />
          <Stat label="Level" value={p.level ?? 0} icon={<Sparkles className="h-3 w-3 text-amber-300" />} />
          <Stat label="Popularity" value={compact(Number(p.total_gifted_coins ?? 0))} icon={<Flame className="h-3 w-3 text-orange-400" />} />
        </div>

        {(isMe || isAdmin) && (
          <div className="mx-4 mt-2 grid grid-cols-2 gap-2">
            <Stat label="Coins" value={compact(p.coins)} icon={<Coins className="h-3 w-3 text-[color:var(--gold)]" />} />
            <Stat label="Diamonds" value={compact(p.diamonds)} icon={<Gem className="h-3 w-3 text-cyan-400" />} />
          </div>
        )}

        {/* VIP progress */}
        <div className="mx-4 mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur-xl">
          <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[color:var(--gold)]">
            <Crown className="h-3 w-3" /> VIP Progression
          </p>
          <VipProgressBar
            totalGifted={Number(p.total_gifted_coins ?? 0)}
            storedLevel={p.vip_level ?? 0}
          />
        </div>

        {/* Public gallery */}
        {(publicGallery.data?.length ?? 0) > 0 && (
          <SectionCard icon={<Images className="h-3 w-3" />} title="Gallery">
            <div className="grid grid-cols-3 gap-2">
              {publicGallery.data!.map((img) => (
                <a
                  key={img.id}
                  href={img.path}
                  target="_blank"
                  rel="noreferrer"
                  className="group relative aspect-square overflow-hidden rounded-xl bg-black/40"
                >
                  <img src={img.path} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-110" />
                </a>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Private album */}
        {!isMe && (
          <div className="mx-4 mt-4 rounded-2xl border border-[color:var(--gold)]/30 bg-gradient-to-br from-[color:var(--gold)]/10 to-transparent p-3 backdrop-blur-xl">
            <p className="mb-2 flex items-center gap-2 text-xs font-black text-[color:var(--gold)]">
              <Lock className="h-3.5 w-3.5" /> Private Album
            </p>
            {albumAccess.data === "accepted" ? (
              (privateGallery.data?.length ?? 0) > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {privateGallery.data!.map((img) => (
                    <a
                      key={img.id}
                      href={img.path}
                      target="_blank"
                      rel="noreferrer"
                      className="aspect-square overflow-hidden rounded-xl bg-black/40"
                    >
                      <img src={img.path} alt="" className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-white/60">Access granted — koi private photo nahi hai</p>
              )
            ) : albumAccess.data === "pending" ? (
              <p className="text-xs text-white/60">Request bheji ja chuki — approval ka intezaar</p>
            ) : albumAccess.data === "revoked" ? (
              <p className="text-xs text-red-400">Access revoked</p>
            ) : (
              <button
                onClick={() => requestAlbum.mutate()}
                disabled={requestAlbum.isPending}
                className="w-full rounded-full bg-gradient-to-r from-[color:var(--gold)] to-amber-500 py-2 text-xs font-black text-black shadow-[0_8px_24px_-8px_rgba(255,200,80,0.6)] disabled:opacity-60"
              >
                {requestAlbum.isPending ? "Bhej rahe hain…" : "Request Access"}
              </button>
            )}
          </div>
        )}

        {/* Owned decorations */}
        {(ownedItems.data?.length ?? 0) > 0 && (
          <SectionCard
            icon={<Sparkles className="h-3 w-3 text-[color:var(--gold)]" />}
            title={`Owned Decorations · ${ownedItems.data!.length}`}
          >
            <div className="grid grid-cols-3 gap-2">
              {ownedItems.data!.map((row: any) => {
                const t = row.themes;
                const cat = t?.theme_categories;
                const slug = (cat?.slug ?? "").toLowerCase();
                const media = t.preview_url || t.bg_image || t.animation_url;
                const isVideo = !!media && /\.(mp4|webm|mov)($|\?)/i.test(media);
                return (
                  <div
                    key={t.id}
                    className="relative overflow-hidden rounded-xl border border-white/10 p-2"
                    style={{
                      background: `linear-gradient(160deg, ${t.primary_color ?? "#5b21b6"}33, ${t.accent_color ?? "#ec4899"}33)`,
                    }}
                  >
                    <div className="aspect-square w-full overflow-hidden rounded-lg bg-black/40">
                      {media && !isVideo ? (
                        <img src={media} alt={t.name} loading="lazy" className="h-full w-full object-cover" />
                      ) : isVideo ? (
                        <video src={media} muted loop autoPlay playsInline className="h-full w-full object-cover" />
                      ) : (
                        <ItemAnimation
                          slug={slug}
                          name={displayName}
                          primary={t.primary_color ?? "#7c3aed"}
                          accent={t.accent_color ?? "#ec4899"}
                          fill
                        />
                      )}
                    </div>
                    <div className="mt-1.5 truncate text-[10px] font-bold text-white">{t.name}</div>
                    <div className="text-[9px] uppercase tracking-wider text-white/50">{cat?.name ?? ""}</div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        )}

        {/* Footer info */}
        <div className="mx-4 mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-[11px] text-white/60 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span>Profile Created</span>
            <span className="font-bold text-white/80">{joined}</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span>Last Seen</span>
            <span className="font-bold text-white/80">
              {p.last_seen
                ? new Date(p.last_seen).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                : "—"}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span>Safety</span>
            <span className="flex items-center gap-1 font-bold text-emerald-400">
              <ShieldCheck className="h-3 w-3" /> Verified
            </span>
          </div>
        </div>

        <div className="h-24" />
      </div>
      <BottomNav />
    </AppShell>
  );
}

function CornerBrackets() {
  const cls = "pointer-events-none absolute h-6 w-6 border-[color:var(--gold)]";
  return (
    <>
      <span className={`${cls} left-2 top-2 border-l-2 border-t-2 rounded-tl-2xl`} />
      <span className={`${cls} right-2 top-2 border-r-2 border-t-2 rounded-tr-2xl`} />
      <span className={`${cls} left-2 bottom-2 border-l-2 border-b-2 rounded-bl-2xl`} />
      <span className={`${cls} right-2 bottom-2 border-r-2 border-b-2 rounded-br-2xl`} />
    </>
  );
}

function Achievement({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r ${color} px-2 py-0.5 text-[10px] font-black text-white shadow-[0_4px_12px_-4px_rgba(0,0,0,0.6)]`}>
      {icon}
      {label}
    </span>
  );
}

function QuickAction({
  icon,
  label,
  onClick,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone: "gold" | "violet" | "cyan" | "pink";
}) {
  const tones: Record<string, string> = {
    gold: "from-amber-400/20 to-amber-600/10 text-amber-300 border-amber-400/30",
    violet: "from-violet-400/20 to-violet-700/10 text-violet-200 border-violet-400/30",
    cyan: "from-cyan-400/20 to-cyan-700/10 text-cyan-200 border-cyan-400/30",
    pink: "from-pink-400/20 to-fuchsia-700/10 text-pink-200 border-pink-400/30",
  };
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-2xl border bg-gradient-to-br ${tones[tone]} py-2.5 text-[10px] font-black backdrop-blur-xl transition active:scale-95`}
    >
      <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10">{icon}</span>
      {label}
    </button>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 -top-8 h-16 bg-[radial-gradient(closest-side,rgba(168,85,247,0.35),transparent)] opacity-70" />
      <div className="relative text-lg font-black text-white">{value}</div>
      <div className="relative mt-0.5 flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-widest text-white/60">
        {icon}
        {label}
      </div>
    </div>
  );
}

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-4 mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur-xl">
      <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/60">
        {icon}
        {title}
      </p>
      {children}
    </div>
  );
}

function compact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`;
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return `${(n / 1_000_000_000).toFixed(1)}B`;
}
