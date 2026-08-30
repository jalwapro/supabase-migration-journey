import { useState } from "react";
import { X, Sparkles, ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import { useRoomGames, NATIVE_GAME_EMOJI, type RoomGame } from "@/lib/roomGames";

/**
 * RoomGamesSheet.tsx
 * -------------------
 * Room's Games popup. The whole list is backend-driven from `room_games`
 * (Admin → Room Games): ordering, visibility and icons are controlled there.
 *
 *  - kind = "native"  → a game built into the app; opened by slug via onOpenNative.
 *  - kind = "iframe"  → externally hosted game; opened inline in an <iframe>.
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
  const [activeGame, setActiveGame] = useState<RoomGame | null>(null);

  if (!open) return null;

  const close = () => {
    setActiveGame(null);
    onClose();
  };

  return (
    <>
      <div
        data-jalwa-overlay="true"
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={close}
      />
      <div
        data-jalwa-overlay-content="true"
        className="fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 rounded-t-3xl border-t border-border bg-card p-4 shadow-2xl transition-all duration-300 ease-out"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
          height: activeGame ? "85vh" : "280px", // Keyboard size height (~280px)
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div className="mx-auto mb-2 h-1 w-10 shrink-0 rounded-full bg-white/20" />

        {activeGame ? (
          <GameFrame game={activeGame} onBack={() => setActiveGame(null)} onClose={close} />
        ) : (
          <GamesPicker
            onClose={close}
            onPick={(g) => {
              if (g.kind === "native") {
                close();
                onOpenNative(g.slug);
              } else if (g.game_url) {
                setActiveGame(g);
              }
            }}
          />
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — picker grid: 2 lines (rows), 4 items per view row, slide left-to-right
// ---------------------------------------------------------------------------

function GamesPicker({ onClose, onPick }: { onClose: () => void; onPick: (g: RoomGame) => void }) {
  const games = useRoomGames();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex items-center justify-between shrink-0">
        <h2 className="flex items-center gap-2 text-base font-extrabold">
          <Sparkles className="h-4 w-4 text-[color:var(--gold)]" /> Games
        </h2>
        <button
          onClick={onClose}
          aria-label="Close"
          className="grid h-7 w-7 place-items-center rounded-full bg-background/60 border border-border"
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

      {/* 
        Horizontal sliding container (left-to-right).
        grid-rows-2 makes exactly 2 horizontal lines, and 4 items show per page column block.
      */}
      {!games.isLoading && games.data && games.data.length > 0 && (
        <div className="flex-1 overflow-x-auto overflow-y-hidden pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="grid grid-flow-col grid-rows-2 gap-2.5 h-full auto-cols-[calc(25% - 8px)] min-w-full">
            {games.data.map((g) => {
              const icon = g.icon_url ?? g.thumb_url;
              return (
                <button
                  key={g.id}
                  onClick={() => onPick(g)}
                  className="group relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-2 text-center transition-transform active:scale-[0.97]"
                >
                  <div className="absolute -right-4 -top-4 h-12 w-12 rounded-full bg-[color:var(--primary)]/25 blur-xl" />
                  <div className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-black/30 text-xl">
                    {icon ? (
                      <img src={icon} alt={g.name} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <span>{NATIVE_GAME_EMOJI[g.slug] ?? "🎮"}</span>
                    )}
                  </div>
                  <p className="relative mt-1.5 w-full truncate text-[11px] font-bold">{g.name}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — hosted games open right here, inside an iframe
// ---------------------------------------------------------------------------

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
          onClick={onBack}
          aria-label="Back to games"
          className="grid h-8 w-8 place-items-center rounded-full bg-background/60 border border-border"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <p className="truncate text-sm font-black">{game.name}</p>
        <button
          onClick={onClose}
          aria-label="Close"
          className="grid h-8 w-8 place-items-center rounded-full bg-background/60 border border-border"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-black">
        {loading && !failed && (
          <div className="absolute inset-0 grid place-items-center bg-black/40">
            <Loader2 className="h-7 w-7 animate-spin text-[color:var(--gold)]" />
          </div>
        )}
        {failed && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
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
