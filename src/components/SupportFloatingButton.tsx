import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { useUnreadCount } from "@/hooks/useNotifications";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { DailySpinPopup } from "@/components/DailySpinPopup";
import { MiniGamesFloatingButton } from "@/components/MiniGamesFloatingButton";
import { formatCompact } from "@/lib/utils";
import { useAppConfig } from "@/hooks/use-app-config";
import { StudioRenderer } from "@/components/studio/StudioRenderer";
import { SupportFloatingButton } from "@/components/SupportFloatingButton";

import { JALWA_LOGO as jalwaLogo } from "@/lib/r2-static";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Video,
  Mic,
  Swords,
  UserRound,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Home,
});

type TabKey = "video" | "voice" | "pk";

function Home() {
  const { user, loading } = useAuth();
  const home = useAppConfig();
  const [tab, setTab] = useState<TabKey>("video");

  return (
    <div className="min-h-[100dvh] pb-28">
      {home.studioConfig && (
        <StudioRenderer component={home.studioConfig.root} />
      )}
      
      {/* Render legacy UI only if no studio config is present */}
      {(!home.studioConfig || (home.studioConfig.root?.children?.length === 0)) && (
        <>
          <SupportFloatingButton />
          <MiniGamesFloatingButton />
          
          <header className="sticky top-0 z-30 border-b border-white/5 bg-background/60 backdrop-blur-2xl">
            {/* Header Content... */}
          </header>

          <main>
            {/* Main content, Tabs, Room Lists... */}
          </main>
        </>
      )}
      
      <BottomNav />
      <DailySpinPopup />
    </div>
  );
}
