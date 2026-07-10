import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { ItemAnimation } from "@/components/ItemAnimation";
import { BottomNav } from "@/components/layout/BottomNav";
import { LevelAvatar } from "@/components/LevelAvatar";
import { LevelBadge } from "@/components/LevelBadge";
import { VipBadge } from "@/components/vip/VipBadge";
import { VipProgressBar } from "@/components/vip/VipProgressBar";
import { useVipProfile } from "@/hooks/useVipProfile";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
} from "lucide-react";
import { toast } from "sonner";
import { levelProgress, tierForLevel } from "@/lib/levels";

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
};

function UserProfilePage() {
  const { userId } = Route.useParams();
  const { user: me, isAdmin } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const isMe = me?.id === userId;

  const prof = useQuery({
    queryKey: ["public-profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id,username,full_name,avatar,frame,ring,bubble,car,entrance,special_id,data_card,bio,gender,country,coins,diamonds,level,xp,is_vip,vip_level,vip_expiry,user_code,last_seen,created_at",
        )
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("User not found");
      return data as FullProfile;
    },
  });

  const stats = useQuery({
    queryKey: ["public-profile-stats", userId],
    queryFn: async () => {
      const [followers, following, xpRank, hostRooms] = await Promise.all([
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", userId),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", userId),
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .gt("xp", prof.data?.xp ?? 0),
        supabase.from("live_rooms").select("*", { count: "exact", head: true }).eq("host_id", userId).eq("status", "live"),
      ]);
      return {
        followers: followers.count ?? 0,
        following: following.count ?? 0,
        rank: (xpRank.count ?? 0) + 1,
        liveRooms: hostRooms.count ?? 0,
      };
    },
    enabled: !!prof.data,
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

  // Public gallery images (visible to everyone)
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

  // Private album unlock status (viewer perspective)
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

  // Owned shop items — visible on every user's profile
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
  const tier = tierForLevel(p.level);
  const prog = levelProgress(p.level, p.xp);
  const online =
    !!p.last_seen && Date.now() - new Date(p.last_seen).getTime() < 3 * 60 * 1000;
  const joined = new Date(p.created_at).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });

  return (
    <AppShell showHeader={false}>
      {/* Hero */}
      <div className="relative overflow-hidden">
        {p.data_card && (
          <>
            <div
              className="absolute inset-0 -z-10"
              style={{ backgroundImage: `url(${p.data_card})`, backgroundSize: "cover", backgroundPosition: "center" }}
            />
            {/* Data card label — buyer's name + ID overlay */}
            <div className="pointer-events-none absolute right-3 top-14 z-[2] rounded-lg bg-black/55 px-2.5 py-1.5 text-right text-white backdrop-blur">
              <div className="text-[10px] font-black uppercase tracking-widest text-[color:var(--gold)]">
                Data Card
              </div>
              <div className="text-sm font-black leading-tight">
                {p.username ?? p.full_name ?? "Member"}
              </div>
              {p.user_code && (
                <div className="text-[10px] font-bold opacity-80">ID: {p.user_code}</div>
              )}
            </div>
          </>
        )}
        {p.entrance && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-12 overflow-hidden">
            {/\.(mp4|webm|mov)($|\?)/i.test(p.entrance) ? (
              <video src={p.entrance} autoPlay muted loop playsInline className="h-full w-full object-cover" />
            ) : (
              <img src={p.entrance} alt="" className="h-full w-full object-cover" />
            )}
            <div className="entrance-shimmer absolute inset-0" />
          </div>
        )}
        {p.car && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 z-[1] h-12">
            <div className="car-drive absolute inset-y-0 left-0 w-28">
              {/\.(mp4|webm|mov)($|\?)/i.test(p.car) ? (
                <video src={p.car} autoPlay muted loop playsInline className="h-full w-full object-contain" />
              ) : (
                <img src={p.car} alt="" className="h-full w-full object-contain" />
              )}
            </div>
          </div>
        )}
        <div
          className="absolute inset-0 opacity-90"
          style={{
            background: `linear-gradient(180deg, ${tier.glow ?? "#7a1fff"}55 0%, transparent 100%), radial-gradient(70% 50% at 30% 10%, var(--primary)/30, transparent 60%)`,
          }}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />


        {/* Top bar */}
        <div
          className="relative z-10 flex items-center justify-between px-4 pb-2 pt-3"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
        >
          <button
            onClick={() => nav({ to: "/" })}
            className="grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white backdrop-blur"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          {p.user_code && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(p.user_code!);
                toast.success("ID copied");
              }}
              className="relative flex items-center gap-1 overflow-hidden rounded-full bg-black/50 px-3 py-1.5 text-xs font-bold text-white backdrop-blur"
            >
              {p.special_id && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-80"
                  style={{ backgroundImage: `url(${p.special_id})`, backgroundSize: "cover", backgroundPosition: "center" }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1 drop-shadow">
                ID: {p.user_code}
                <Copy className="h-3 w-3 opacity-70" />
              </span>
            </button>
          )}
        </div>

        {/* Avatar + name */}
        <div className="relative z-10 flex flex-col items-center px-4 pb-6 pt-2">
          <LevelAvatar
            src={p.avatar}
            name={p.username ?? p.full_name ?? "User"}
            level={p.level}
            size="xl"
            showBadge
            frame={p.frame}
            ring={p.ring}
          />
          <div className="mt-4 flex items-center gap-2">
            <h1 className="text-xl font-black text-white">
              {p.username ?? p.full_name ?? "User"}
            </h1>
            {p.is_vip && (
              <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-[color:var(--gold)] to-amber-500 px-2 py-0.5 text-[10px] font-black text-black">
                <Crown className="h-3 w-3" /> VIP{p.vip_level > 0 ? ` ${p.vip_level}` : ""}
              </span>
            )}
            <span
              className={`h-2 w-2 rounded-full ${online ? "bg-emerald-400" : "bg-muted-foreground/40"}`}
              title={online ? "Online" : "Offline"}
            />
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-white/70">
            <LevelBadge level={p.level} />
            {p.country && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {p.country}
              </span>
            )}
            <span>Joined {joined}</span>
          </div>
          {p.bio && (
            <p className="mt-3 max-w-sm text-center text-xs leading-relaxed text-white/80">
              {p.bio}
            </p>
          )}
        </div>
      </div>

      {/* XP progress */}
      <div className="mx-4 -mt-2 rounded-2xl border border-white/10 bg-card/80 p-3 backdrop-blur">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <span>Level {p.level}</span>
          <span>{prog.have.toLocaleString()} / {prog.need.toLocaleString()} XP</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--secondary)]"
            style={{ width: `${Math.round(prog.pct * 100)}%` }}
          />
        </div>
      </div>

      {/* Actions */}
      {!isMe && (
        <div className="mt-3 grid grid-cols-2 gap-2 px-4">
          <button
            onClick={() => follow.mutate()}
            disabled={follow.isPending || followState.isLoading}
            className={`flex items-center justify-center gap-1.5 rounded-full py-2.5 text-sm font-bold transition ${
              followState.data
                ? "bg-white/10 text-white"
                : "bg-gradient-to-r from-[color:var(--primary)] to-[color:var(--secondary)] text-white"
            } disabled:opacity-60`}
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
            className="flex items-center justify-center gap-1.5 rounded-full bg-[color:var(--gold)]/20 py-2.5 text-sm font-bold text-[color:var(--gold)]"
          >
            <MessageCircle className="h-4 w-4" /> Message
          </Link>
        </div>
      )}

      {/* Stats grid */}
      <div className="mx-4 mt-4 grid grid-cols-3 gap-2">
        <Stat label="Followers" value={stats.data?.followers ?? 0} />
        <Stat label="Following" value={stats.data?.following ?? 0} />
        <Stat
          label="Rank"
          value={stats.data?.rank ? `#${stats.data.rank}` : "—"}
          icon={<Trophy className="h-3 w-3 text-[color:var(--gold)]" />}
        />
      </div>

      {(isMe || isAdmin) && (
        <div className="mx-4 mt-2 grid grid-cols-2 gap-2">
          <Stat
            label="Coins"
            value={p.coins.toLocaleString()}
            icon={<Coins className="h-3 w-3 text-[color:var(--gold)]" />}
          />
          <Stat
            label="Diamonds"
            value={p.diamonds.toLocaleString()}
            icon={<Gem className="h-3 w-3 text-cyan-400" />}
          />
        </div>
      )}

      {/* Public gallery */}
      {(publicGallery.data?.length ?? 0) > 0 && (
        <div className="mx-4 mt-4">
          <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <Images className="h-3 w-3" /> Gallery
          </p>
          <div className="grid grid-cols-3 gap-2">
            {publicGallery.data!.map((img) => (
              <a
                key={img.id}
                href={img.path}
                target="_blank"
                rel="noreferrer"
                className="aspect-square overflow-hidden rounded-xl bg-card/60"
              >
                <img src={img.path} alt="" className="h-full w-full object-cover" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Private album gate — only for other users */}
      {!isMe && (
        <div className="mx-4 mt-4 rounded-2xl border border-[color:var(--gold)]/30 bg-[color:var(--gold)]/5 p-3">
          <p className="mb-2 flex items-center gap-2 text-xs font-bold text-[color:var(--gold)]">
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
                    className="aspect-square overflow-hidden rounded-xl bg-card/60"
                  >
                    <img src={img.path} alt="" className="h-full w-full object-cover" />
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Access mila hai — abhi koi private photo nahi</p>
            )
          ) : albumAccess.data === "pending" ? (
            <p className="text-xs text-muted-foreground">Request bheji ja chuki — owner ke approve karne ka intezaar</p>
          ) : albumAccess.data === "revoked" ? (
            <p className="text-xs text-red-400">Access revoked kiya gaya hai</p>
          ) : (
            <button
              onClick={() => requestAlbum.mutate()}
              disabled={requestAlbum.isPending}
              className="w-full rounded-full bg-gradient-to-r from-[color:var(--gold)] to-amber-500 py-2 text-xs font-bold text-black disabled:opacity-60"
            >
              {requestAlbum.isPending ? "Bhej rahe hain…" : "Request access"}
            </button>
          )}
        </div>
      )}

      {/* Live rooms */}
      {(stats.data?.liveRooms ?? 0) > 0 && (
        <div className="mx-4 mt-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3">
          <p className="flex items-center gap-2 text-xs font-bold text-emerald-400">
            <Sparkles className="h-3.5 w-3.5" /> Currently hosting {stats.data?.liveRooms} live room
            {(stats.data?.liveRooms ?? 0) > 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* Owned shop items (public inventory) */}
      {(ownedItems.data?.length ?? 0) > 0 && (
        <div className="mx-4 mt-4">
          <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <Sparkles className="h-3 w-3 text-[color:var(--gold)]" /> Owned Items ({ownedItems.data!.length})
          </p>
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
                  className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br p-2"
                  style={{
                    background: `linear-gradient(160deg, ${t.primary_color ?? "#5b21b6"}22, ${t.accent_color ?? "#ec4899"}22)`,
                  }}
                >
                  <div className="aspect-square w-full overflow-hidden rounded-lg bg-black/40">
                    {media && !isVideo ? (
                      <img src={media} alt={t.name} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <ItemAnimation
                        slug={slug}
                        name={p.username ?? p.full_name ?? "Member"}
                        primary={t.primary_color ?? "#7c3aed"}
                        accent={t.accent_color ?? "#ec4899"}
                        fill
                      />
                    )}
                  </div>
                  <div className="mt-1.5 truncate text-[10px] font-bold text-white">
                    {t.name}
                  </div>
                  <div className="text-[9px] uppercase tracking-wider text-white/50">
                    {cat?.name ?? ""}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="h-24" />
      <BottomNav />
    </AppShell>
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
    <div className="rounded-2xl border border-white/10 bg-card/60 p-3 text-center">
      <div className="text-lg font-black text-white">{value}</div>
      <div className="mt-0.5 flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {icon}
        {label}
      </div>
    </div>
  );
}
