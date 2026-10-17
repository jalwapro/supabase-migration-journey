import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Sparkles, ArrowLeft, Loader2, AlertTriangle, ChevronDown, Maximize2 } from "lucide-react";
import { useRoomGames, NATIVE_GAME_EMOJI, type RoomGame } from "@/lib/roomGames";
import { NativeGamePopup } from "@/components/room/NativeGamePopup";
import { cn } from "@/lib/utils";

/**
 * Voice Room Games popup.
 * Docked cleanly ABOVE the room bottom navigation bar/footer.
 * Constrained height so the Room Header and Upper 4 Seats remain 100% visible,
 * with no heavy backdrop blur obstructing the room stage.
 */
export function RoomGamesSheet({
  open,
  onClose,
  onOpenNative,
}: {
  open: boolean;
  onClose: () => void;
  onOpenNative: (slug: string) => void;
}) {
  const games = useRoomGames();
  const [activeGame, setActiveGame] = useState<RoomGame | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  if (!open || typeof document === "undefined") return null;

  const close = () => {
    setActiveGame(null);
    setIsMinimized(false);
    onClose();
  };

  const pickGame = (game: RoomGame) => {
    setIsMinimized(false);
    if (game.kind === "native") {
      setActiveGame(game);
      return;
    }
    if (game.game_url) setActiveGame(game);
  };

  // Footer toolbar height in VoiceRoomScreen:
  // calc(54px + max(var(--safe-area-inset-bottom, 0px), var(--jalwa-safe-bottom, 0px), env(safe-area-inset-bottom, 0px), 16px))
  const footerClearanceStyle = "calc(54px + max(var(--safe-area-inset-bottom, 0px), var(--jalwa-safe-bottom, 0px), env(safe-area-inset-bottom, 0px), 16px))";
  const sheetBottomStyle = `calc(${footerClearanceStyle} + 6px)`;

  return createPortal(
    <div className="fixed inset-0 z-[2147483001] pointer-events-auto" data-jalwa-games-root="true">
      {/* Light backdrop with NO blur, positioned above the footer so footer buttons stay clickable */}
      <button
        type="button"
        aria-label="Close games"
        className={cn(
          "absolute inset-x-0 top-0 cursor-default transition-opacity",
          isMinimized ? "bg-transparent pointer-events-none" : "bg-black/25"
        )}
        style={{
          bottom: footerClearanceStyle,
        }}
        onClick={close}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-label="Games"
        className={cn(
          "absolute left-1/2 flex w-[calc(100%-12px)] max-w-[480px] -translate-x-1/2 flex-col rounded-3xl border border-white/15 bg-[#120a1f]/95 text-white shadow-2xl backdrop-blur-xl transition-all duration-300 ease-out",
          isMinimized ? "p-2.5 shadow-purple-900/30" : "p-3.5"
        )}
        style={{
          bottom: sheetBottomStyle,
          height: isMinimized
            ? "52px"
            : activeGame
            ? "min(50dvh, calc(100dvh - 230px))"
            : "min(290px, 38dvh)",
          maxHeight: isMinimized ? "52px" : "calc(100dvh - 210px)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Subtle drag handle on non-minimized sheet */}
        {!isMinimized && (
          <div className="mx-auto mb-1.5 h-1 w-10 shrink-0 rounded-full bg-white/20" />
        )}

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
            <div className="mb-2 flex shrink-0 items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-extrabold text-amber-200">
                <Sparkles className="h-4 w-4 text-[color:var(--gold,#f59e0b)]" />
                Jalwa Games
              </h2>
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
                <Loader2 className="h-6 w-6 animate-spin text-[color:var(--gold,#f59e0b)]" />
              </div>
            )}

            {!games.isLoading && games.data?.length === 0 && (
              <p className="py-6 text-center text-xs text-white/50">
                No games available right now.
              </p>
            )}

            {!games.isLoading && !!games.data?.length && (
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                <div className="grid w-full grid-cols-4 auto-rows-[90px] gap-2 pb-1">
                  {games.data.map((game) => {
                    const icon = game.icon_url ?? game.thumb_url;
                    return (
                      <button
                        key={game.id}
                        type="button"
                        onClick={() => pickGame(game)}
                        className="group relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-2 text-center transition-all hover:bg-white/10 active:scale-[0.96]"
                      >
                        <div className="absolute -right-4 -top-4 h-12 w-12 rounded-full bg-purple-500/20 blur-xl group-hover:bg-purple-500/30 transition-colors" />
                        <div className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-black/40 text-xl shadow-inner">
                          {icon ? (
                            <img src={icon} alt={game.name} className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <span>{NATIVE_GAME_EMOJI[game.slug] ?? "🎮"}</span>
                          )}
                        </div>
                        <p className="relative mt-1.5 w-full truncate text-[10.5px] font-bold text-white/90">
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
    </div>,
    document.body,
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

  // Minimized floating strip view
  if (isMinimized) {
    return (
      <div className="flex h-full w-full items-center justify-between px-1">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-purple-600/30 text-sm border border-purple-400/30">
            {game.icon_url ? (
              <img src={game.icon_url} alt="" className="h-full w-full object-cover rounded-lg" />
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

  // Native game popup container
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

  // Iframe game container (Docked cleanly in lower portion of room)
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
              <Loader2 className="h-6 w-6 animate-spin text-[color:var(--gold,#f59e0b)]" />
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
