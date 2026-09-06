import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Sparkles, ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import { useRoomGames, NATIVE_GAME_EMOJI, type RoomGame } from "@/lib/roomGames";

/**
 * Voice Room Games popup.
 * Rendered through a body portal so the sheet cannot be hidden/clipped by the
 * VoiceRoomScreen's fixed/overflow stacking context.
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

  if (!open || typeof document === "undefined") return null;

  const close = () => {
    setActiveGame(null);
    onClose();
  };

  const pickGame = (game: RoomGame) => {
    if (game.kind === "native") {
      close();
      onOpenNative(game.slug);
      return;
    }
    if (game.game_url) setActiveGame(game);
  };

  return createPortal(
    <div className="fixed inset-0 z-[2147483001] pointer-events-auto" data-jalwa-games-root="true">
      <button
        type="button"
        aria-label="Close games"
        className="absolute inset-0 h-full w-full cursor-default bg-black/60 backdrop-blur-sm"
        onClick={close}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-label="Games"
        className="absolute bottom-0 left-1/2 flex w-full max-w-[480px] -translate-x-1/2 flex-col rounded-t-3xl border border-white/10 bg-card p-4 shadow-2xl"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
          height: activeGame ? "85dvh" : "280px",
          maxHeight: "85dvh",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-2 h-1 w-10 shrink-0 rounded-full bg-white/20" />

        {activeGame ? (
          <GameFrame
            game={activeGame}
            onBack={() => setActiveGame(null)}
            onClose={close}
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-3 flex shrink-0 items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-extrabold">
                <Sparkles className="h-4 w-4 text-[color:var(--gold)]" />
                Games
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="grid h-7 w-7 place-items-center rounded-full border border-border bg-background/60"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {games.isLoading && (
              <div className="grid flex-1 place-items-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-[color:var(--gold)]" />
              </div>
            )}

            {!games.isLoading && games.data?.length === 0 && (
              <p className="py-4 text-center text-xs text-foreground/50">
                No games available right now.
              </p>
            )}

            {!games.isLoading && !!games.data?.length && (
              <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                <div className="grid h-full min-w-full auto-cols-[calc(25%-8px)] grid-flow-col grid-rows-2 gap-2.5">
                  {games.data.map((game) => {
                    const icon = game.icon_url ?? game.thumb_url;
                    return (
                      <button
                        key={game.id}
                        type="button"
                        onClick={() => pickGame(game)}
                        className="group relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-2 text-center transition-transform active:scale-[0.97]"
                      >
                        <div className="absolute -right-4 -top-4 h-12 w-12 rounded-full bg-[color:var(--primary)]/25 blur-xl" />
                        <div className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-black/30 text-xl">
                          {icon ? (
                            <img src={icon} alt={game.name} className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <span>{NATIVE_GAME_EMOJI[game.slug] ?? "🎮"}</span>
                          )}
                        </div>
                        <p className="relative mt-1.5 w-full truncate text-[11px] font-bold">{game.name}</p>
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
  onBack,
  onClose,
}: {
  game: RoomGame;
  onBack: () => void;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex shrink-0 items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to games"
          className="grid h-8 w-8 place-items-center rounded-full border border-border bg-background/60"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <p className="truncate px-3 text-sm font-black">{game.name}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid h-8 w-8 place-items-center rounded-full border border-border bg-background/60"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-black">
        {loading && !failed && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-black/40">
            <Loader2 className="h-7 w-7 animate-spin text-[color:var(--gold)]" />
          </div>
        )}
        {failed && (
          <div className="absolute inset-0 z-10 grid place-items-center p-6 text-center">
            <div>
              <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-amber-400" />
              <p className="text-xs text-foreground/60">Couldn't load this game.</p>
            </div>
          </div>
        )}
        {!failed && (
          <iframe
            src={game.game_url ?? ""}
            title={game.name}
            className="h-full w-full border-0"
            allow="autoplay; fullscreen; gamepad"
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
