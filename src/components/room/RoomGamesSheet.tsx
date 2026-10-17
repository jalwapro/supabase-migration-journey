import { useState } from "react";
import { X, Sparkles, ArrowLeft, Loader2, AlertTriangle, ChevronDown, Maximize2 } from "lucide-react";
import { useRoomGames, NATIVE_GAME_EMOJI, type RoomGame } from "@/lib/roomGames";
import { NativeGamePopup } from "@/components/room/NativeGamePopup";
import { cn } from "@/lib/utils";

/**
 * Voice Room Games Sheet.
 * Designed to match GiftSheet's layout:
 * - Docked cleanly at the bottom over the room footer
 * - Compact height (h-[340px]) keeping the Room Header and Upper 4 Seats fully visible
 * - Clean slide-up animation and dark backdrop
 */
export function RoomGamesSheet({
  open,
  onClose,
  onOpenNative,
}: {
  open: boolean;
  onClose: () => void;
  onOpenNative?: (slug: string) => void;
}) {
  const games = useRoomGames();
  const [activeGame, setActiveGame] = useState<RoomGame | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  if (!open) return null;

  const close = () => {
    setActiveGame(null);
    setIsMinimized(false);
    onClose();
  };

  const pickGame = (game: RoomGame) => {
    setIsMinimized(false);
    if (game.kind === "native") {
      setActiveGame(game);
      onOpenNative?.(game.slug);
      return;
    }
    if (game.game_url) {
      setActiveGame(game);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[2147483000] flex items-end justify-center bg-black/50 p-0 transition-opacity"
      onClick={close}
      data-jalwa-games-root="true"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Games"
        onClick={(event) => event.stopPropagation()}
        className={cn(
          "relative flex w-full max-w-lg flex-col overflow-hidden rounded-t-[24px] border border-white/10 bg-[#120a1f]/95 text-white shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom duration-200",
          isMinimized ? "h-[58px] p-2" : "h-[340px] p-3"
        )}
      >
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
            {/* Header */}
            <div className="mb-2 flex shrink-0 items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black bg-gradient-to-r from-pink-400 to-violet-500 bg-clip-text text-transparent">
                  Jalwa
                </span>
                <h2 className="flex items-center gap-1.5 text-xs font-black text-amber-200">
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  Room Games
                </h2>
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
              <div className="grid flex-1 place-items-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
              </div>
            )}

            {!games.isLoading && games.data?.length === 0 && (
              <p className="py-8 text-center text-xs text-white/50">
                No games available right now.
              </p>
            )}

            {!games.isLoading && !!games.data?.length && (
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
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

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
  if (game.kind === "native") {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-2 flex shrink-0 items-center justify-between border-b border-white/10 pb-2">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to games"
            className="grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-white/10 text-white/80 hover:text-white transition active:scale-95"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-center gap-1.5 px-2 truncate">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <p className="truncate text-xs font-black text-amber-200">{game.name}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onToggleMinimize}
              aria-label="Minimize"
              className="grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-white/10 text-white/80 hover:text-white transition active:scale-95"
            >
              <ChevronDown className="h-4 w-4" />
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
        <div className="min-h-0 flex-1 overflow-auto rounded-xl">
          <NativeGamePopup slug={game.slug} onClose={onClose} />
        </div>
      </div>
    );
  }

  // Iframe game container inside bottom sheet
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 flex shrink-0 items-center justify-between border-b border-white/10 pb-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to games"
          className="grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-white/10 text-white/80 hover:text-white transition active:scale-95"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
        <div className="flex items-center gap-1.5 px-2 truncate">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <p className="truncate text-xs font-black text-amber-200">{game.name}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleMinimize}
            aria-label="Minimize"
            className="grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-white/10 text-white/80 hover:text-white transition active:scale-95"
          >
            <ChevronDown className="h-4 w-4" />
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

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-black shadow-inner">
        {loading && !failed && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-black/60 backdrop-blur-[2px]">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
              <span className="text-[10px] text-white/60">Loading game...</span>
            </div>
          </div>
        )}
        {failed && (
          <div className="absolute inset-0 z-10 grid place-items-center p-6 text-center">
            <div>
              <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-amber-400" />
              <p className="text-xs text-white/70">Couldn't load this game.</p>
              <button
                type="button"
                onClick={() => {
                  setFailed(false);
                  setLoading(true);
                }}
                className="mt-2 text-[11px] font-bold text-amber-300 underline"
              >
                Retry
              </button>
            </div>
          </div>
        )}
        {!failed && (
          <iframe
            src={game.game_url ?? ""}
            title={game.name}
            className="h-full w-full border-0 bg-transparent"
            allow="autoplay; fullscreen; gamepad; clipboard-write"
            sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-forms allow-popups"
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
