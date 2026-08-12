import { useMemo } from "react";
import { Home, LayoutGrid, UserRound, Wallet, MessageCircle, Settings, Video, Mic, Swords, Gift, Trophy } from "lucide-react";

export type PreviewPage = "home" | "rooms" | "voice-room" | "video-room" | "pk" | "profile" | "wallet" | "messages" | "ranking" | "gifts" | "notifications" | "settings";

const pageMeta: Record<PreviewPage, { title: string; subtitle: string; icon: typeof Home }> = {
  home: { title: "Jalwa", subtitle: "Live rooms & community", icon: Home },
  rooms: { title: "Live Rooms", subtitle: "Discover live rooms", icon: LayoutGrid },
  "voice-room": { title: "Voice Room", subtitle: "Live voice experience", icon: Mic },
  "video-room": { title: "Video Room", subtitle: "Live video experience", icon: Video },
  pk: { title: "PK Battle", subtitle: "Battle live", icon: Swords },
  profile: { title: "Profile", subtitle: "Your Jalwa profile", icon: UserRound },
  wallet: { title: "Wallet", subtitle: "Coins & transactions", icon: Wallet },
  messages: { title: "Messages", subtitle: "Your conversations", icon: MessageCircle },
  ranking: { title: "Ranking", subtitle: "Top users & hosts", icon: Trophy },
  gifts: { title: "Gifts", subtitle: "Send & receive gifts", icon: Gift },
  notifications: { title: "Notifications", subtitle: "Stay up to date", icon: MessageCircle },
  settings: { title: "Settings", subtitle: "Manage your account", icon: Settings },
};

export function LiveAppPreview({ page }: { page: PreviewPage }) {
  const meta = pageMeta[page];
  const Icon = meta.icon;
  const cards = useMemo(() => ["Live Now", "Popular", "Recommended"], []);

  return (
    <div className="mx-auto h-full min-h-[620px] w-full max-w-[430px] overflow-hidden rounded-[28px] border bg-background shadow-2xl">
      <div className="sticky top-0 z-10 border-b bg-background/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary"><Icon className="h-5 w-5" /></div>
          <div className="min-w-0"><p className="truncate text-sm font-semibold">{meta.title}</p><p className="truncate text-xs text-muted-foreground">{meta.subtitle}</p></div>
        </div>
      </div>
      <div className="space-y-4 p-4">
        {page === "home" || page === "rooms" ? (
          <>
            <div className="h-36 rounded-2xl bg-gradient-to-br from-primary/25 via-secondary/20 to-background p-4"><p className="text-lg font-bold">Welcome to Jalwa</p><p className="mt-1 text-xs text-muted-foreground">Live rooms, hosts and community</p></div>
            <div className="grid grid-cols-3 gap-2">{cards.map((c) => <div key={c} className="rounded-xl border bg-card p-3 text-center text-xs">{c}</div>)}</div>
            <div className="grid grid-cols-2 gap-3">{[1,2,3,4].map((n) => <div key={n} className="aspect-[4/3] rounded-2xl border bg-muted/40 p-3"><div className="h-2/3 rounded-xl bg-muted" /><p className="mt-2 text-xs font-medium">Live Room {n}</p></div>)}</div>
          </>
        ) : page.includes("room") || page === "pk" ? (
          <div className="space-y-3"><div className="h-44 rounded-2xl bg-muted/50" /><div className="grid grid-cols-4 gap-2">{Array.from({ length: 8 }, (_, i) => <div key={i} className="aspect-square rounded-xl border bg-card" />)}</div><div className="h-24 rounded-2xl border bg-card" /><div className="h-12 rounded-full border bg-card" /></div>
        ) : (
          <>{["Header", "Main content", "Actions", "Secondary content"].map((x, i) => <div key={x} className={`rounded-2xl border bg-card p-4 ${i === 0 ? "h-20" : i === 1 ? "h-44" : "h-24"}`}><p className="text-xs font-medium">{x}</p></div>)}</>
        )}
      </div>
      <div className="sticky bottom-0 grid grid-cols-4 border-t bg-background/95 p-2 backdrop-blur">
        {[Home, MessageCircle, Gift, UserRound].map((NavIcon, i) => <div key={i} className="flex justify-center p-2 text-muted-foreground"><NavIcon className="h-4 w-4" /></div>)}
      </div>
    </div>
  );
}
