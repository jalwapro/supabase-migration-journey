import { useState, useMemo, useEffect } from "react";
import {
  X,
  Sparkles,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  ChevronDown,
  Maximize2,
  ExternalLink,
  RotateCw,
} from "lucide-react";
import { useRoomGames, type RoomGame } from "@/lib/roomGames";
import { NativeGamePopup } from "@/components/room/NativeGamePopup";
import { cn } from "@/lib/utils";

const NATIVE_GAME_EMOJI: Record<string, string> = {
  ludo: "🎲",
  slots777: "🎰",
  royal_jalwa_slots: "👑",
  crash_x: "🚀",
  dragon_tiger: "🐉",
  in_out: "🃏",
  plinko: "⚪",
  under_over_7: "🎲",
  crash_point: "📈",
  scratch_card: "🎟️",
  apple_fortune: "🍎",
  spin_win: "🎡",
  vampire_curse: "🧛",
};

function resolveGameUrl(url: string | null | undefined, slug?: string): string {
  if (!url || !url.trim()) {
    if (slug) return `/games/play/${slug}`;
    return "";
  }
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/")) return trimmed;
  return `https://${trimmed}`;
}

export function RoomGamesSheet({
  open,
  onClose,
  onOpenNative,
}: {
  open: boolean;
  onClose: () => void;
  onOpenNative?: (slug: string) => void;
}) {
  const [activeGame, setActiveGame] = useState<RoomGame | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  const games = useRoomGames();

  if (!open) return null;

  const close = () => {
    setActiveGame(null);
    setIsMinimized(false);
    onClose();
  };

  const pickGame = (game: RoomGame) => {
    setIsMinimized(false);
    setActiveGame(game);
    if (game.kind === "native" && onOpenNative) {
      onOpenNative(game.slug);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[2147482900] flex items-end justify-center bg-black/40 p-0 transition-opacity"
      onClick={close}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Games"
        onClick={(event) => event.stopPropagation()}
        className={cn(
          "relative flex w-full max-w-lg flex-col overflow-hidden rounded-t-[24px] border border-white/10 bg-[#120a1f]/95 text-white shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom duration-200",
          isMinimized
            ? "h-[58px] p-2"
            : activeGame
            ? "h-[min(56dvh,460px)] p-3"
            : "h-[320px] p-3"
        )}
      >
        <div className="mx-auto mb-2 h-1 w-10 shrink-0 rounded-full bg-white/20" />

        {activeGame ? (
          <GameFrame
            game={activeGame}
            isMinimized={isMinimized}
            onToggleMinimize={() => setIsMinimized((prev) => !prev)}
            onBack={() => {
              setActiveGame(null);
              setIsMinimized(false);
            }}
            onClose={close}
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-2.5 flex shrink-0 items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400" />
                <h2 className="text-sm font-extrabold tracking-wide text-white">Room Games</h2>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-white/10 text-white/80 hover:text-white transition active:scale-95"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {games.isLoading && (
              <div className="flex min-h-0 flex-1 items-center justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
              </div>
            )}

            {!games.isLoading && (!games.data || games.data.length === 0) && (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-4 text-center">
                <p className="text-xs text-white/60">No games available right now.</p>
              </div>
            )}

            {!games.isLoading && games.data && games.data.length > 0 && (
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                <div className="grid w-full grid-cols-4 auto-rows-[82px] gap-2 pb-1">
                  {games.data.map((game) => {
                    const icon = game.icon_url ?? game.thumb_url;
                    return (
                      <button
                        key={game.id}
                        type="button"
                        onClick={() => pickGame(game)}
                        className="group relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-1.5 text-center transition-all hover:bg-white/10 active:scale-[0.96]"
                      >
                        <div className="absolute -right-4 -top-4 h-12 w-12 rounded-full bg-purple-500/20 blur-xl group-hover:bg-purple-500/30 transition-colors" />
                        <div className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-black/40 text-lg shadow-inner">
                          {icon ? (
                            <img src={icon} alt={game.name} className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <span>{NATIVE_GAME_EMOJI[game.slug] ?? "🎮"}</span>
                          )}
                        </div>
                        <p className="relative mt-1 w-full truncate text-[10px] font-bold text-white/90">
                          {game.name}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function GameFrame({
  game,
  isMinimized,
  onToggleMinimize,
  onBack,
  onClose,
}: {
  game: RoomGame;
  isMinimized: boolean;
  onToggleMinimize: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const resolvedUrl = useMemo(() => resolveGameUrl(game.game_url, game.slug), [game.game_url, game.slug]);
  const isNative = game.kind === "native" && Boolean(NATIVE_GAME_EMOJI[game.slug]);

  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Safeguard: Dismiss loading overlay after 2.5s even if cross-origin iframe
  // suppresses onload event, preventing permanent spinner overlay.
  useEffect(() => {
    setLoading(true);
    setFailed(false);
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, [resolvedUrl, reloadKey]);

  // Minimized floating strip view at bottom of screen
  if (isMinimized) {
    return (
      <div className="flex h-full w-full items-center justify-between px-1">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-purple-600/30 text-base border border-purple-400/30">
            {game.icon_url ? (
              <img src={game.icon_url} alt="" className="h-full w-full object-cover rounded-xl" />
            ) : (
              <span>{NATIVE_GAME_EMOJI[game.slug] ?? "🎮"}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-white">{game.name}</p>
            <span className="flex items-center gap-1 text-[9px] text-emerald-400 font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Playing in Room
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onToggleMinimize}
            className="flex items-center gap-1 rounded-xl bg-purple-600/40 border border-purple-400/40 px-2.5 py-1 text-[11px] font-bold text-purple-200 hover:bg-purple-600/60 transition active:scale-95"
          >
            <Maximize2 className="h-3 w-3" />
            Expand
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-white/10 text-white/80 hover:text-white transition active:scale-95"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // Native game view container
  if (isNative) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-2 flex shrink-0 items-center justify-between border-b border-white/10 pb-2">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to games"
            className="flex items-center gap-1 rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/80 hover:text-white transition active:scale-95"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Games</span>
          </button>
          <div className="flex items-center gap-1.5 px-2 truncate">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <p className="truncate text-xs font-black text-amber-200">{game.name}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onToggleMinimize}
              aria-label="Minimize"
              className="grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-white/10 text-white/80 hover:text-white transition active:scale-95"
              title="Minimize"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex items-center gap-1 rounded-full border border-rose-500/40 bg-gradient-to-r from-rose-600 to-red-600 px-2.5 py-1 text-xs font-bold text-white shadow-md hover:from-rose-500 hover:to-red-500 transition active:scale-95"
              title="Close game"
            >
              <X className="h-3.5 w-3.5 stroke-[2.5]" />
              <span className="text-[11px]">Close</span>
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto rounded-xl">
          <NativeGamePopup slug={game.slug} onClose={onClose} />
        </div>
      </div>
    );
  }

  // Iframe game container inside bottom sheet with fixed frame and prominent close controls
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Upper control header directly above the iframe */}
      <div className="mb-2 flex shrink-0 items-center justify-between border-b border-white/10 pb-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to games"
          className="flex items-center gap-1 rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/80 hover:text-white transition active:scale-95"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Games</span>
        </button>

        <div className="flex items-center gap-1.5 px-2 truncate">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <p className="truncate text-xs font-black text-amber-200">{game.name}</p>
        </div>

        <div className="flex items-center gap-1.5">
          {resolvedUrl && (
            <a
              href={resolvedUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open in new window"
              className="grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-white/10 text-white/80 hover:text-white transition active:scale-95"
              title="Open full screen"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            aria-label="Reload game"
            className="grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-white/10 text-white/80 hover:text-white transition active:scale-95"
            title="Reload game"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onToggleMinimize}
            aria-label="Minimize"
            className="grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-white/10 text-white/80 hover:text-white transition active:scale-95"
            title="Minimize"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          {/* Prominent top close button directly above the iframe */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close game"
            className="flex items-center gap-1 rounded-full border border-rose-500/40 bg-gradient-to-r from-rose-600 to-red-600 px-2.5 py-1 text-xs font-bold text-white shadow-md shadow-rose-950/40 hover:from-rose-500 hover:to-red-500 transition active:scale-95"
            title="Close game"
          >
            <X className="h-3.5 w-3.5 stroke-[2.5]" />
            <span className="text-[11px]">Close</span>
          </button>
        </div>
      </div>

      {/* Fixed frame container: strictly isolated and sized so game fits precisely inside */}
      <div className="relative w-full flex-1 min-h-0 overflow-hidden rounded-2xl border border-white/15 bg-black shadow-2xl isolate select-none">
        {/* Floating top-right close button directly on the upper corner of the iframe */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close game frame"
          className="absolute top-2.5 right-2.5 z-30 grid h-7 w-7 place-items-center rounded-full bg-black/80 border border-white/20 text-white/90 shadow-xl backdrop-blur-md hover:bg-rose-600 hover:border-rose-400 hover:text-white transition active:scale-90"
          title="Close game"
        >
          <X className="h-4 w-4 stroke-[2.5]" />
        </button>

        {loading && !failed && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-black/60 backdrop-blur-[2px]">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
              <span className="text-[10px] text-white/60">Loading game...</span>
            </div>
          </div>
        )}

        {failed && (
          <div className="absolute inset-0 z-10 grid place-items-center p-6 text-center bg-black/80">
            <div>
              <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-amber-400" />
              <p className="text-xs text-white/70">Couldn't load game inside room.</p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFailed(false);
                    setLoading(true);
                    setReloadKey((k) => k + 1);
                  }}
                  className="rounded-xl bg-white/10 px-3 py-1.5 text-[11px] font-bold text-amber-300 hover:bg-white/20 transition active:scale-95"
                >
                  Retry
                </button>
                {resolvedUrl && (
                  <a
                    href={resolvedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded-xl bg-purple-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-purple-500 transition active:scale-95"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Open Game
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {!failed && (
          <iframe
            key={reloadKey}
            src={resolvedUrl}
            title={game.name}
            className="absolute inset-0 h-full w-full border-0 bg-black"
            style={{
              width: "100%",
              height: "100%",
              border: 0,
              display: "block",
              touchAction: "manipulation",
              overscrollBehavior: "contain",
            }}
            allow="autoplay; fullscreen; gamepad; clipboard-write; camera; microphone; screen-wake-lock"
            loading="eager"
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setFailed(true);
            }}
          />
        )}
      </div>
    </div>
  );
}
