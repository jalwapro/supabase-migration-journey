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
 *
 * Nothing here needs to change when a game is added, hidden or reordered.
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
        className="fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 rounded-t-3xl border-t border-border bg-card p-5 shadow-2xl"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)",
          height: activeGame ? "85vh" : undefined,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-white/20" />

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
// Step 1 — picker grid, entirely from the admin-managed catalogue
// ---------------------------------------------------------------------------

function GamesPicker({ onClose, onPick }: { onClose: () => void; onPick: (g: RoomGame) => void }) {
  const games = useRoomGames();

  return (
    <div className="overflow-y-auto">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-extrabold">
          <Sparkles className="h-5 w-5 text-[color:var(--gold)]" /> Games
        </h2>
        <button
          onClick={onClose}
          aria-label="Close"
          className="grid h-8 w-8 place-items-center rounded-full bg-background/60 border border-border"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {games.isLoading && (
          <div className="col-span-2 grid place-items-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-[color:var(--gold)]" />
          </div>
        )}

        {!games.isLoading && games.data?.length === 0 && (
          <p className="col-span-2 py-6 text-center text-xs text-foreground/50">
            No games available right now.
          </p>
        )}

        {games.data?.map((g) => {
          const icon = g.icon_url ?? g.thumb_url;
          return (
            <button
              key={g.id}
              onClick={() => onPick(g)}
              className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-4 text-left transition-transform active:scale-[0.97]"
            >
              <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-[color:var(--primary)]/25 blur-2xl" />
              <div className="relative grid h-14 w-14 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-black/30 text-3xl">
                {icon ? (
                  <img src={icon} alt={g.name} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <span>{NATIVE_GAME_EMOJI[g.slug] ?? "🎮"}</span>
                )}
              </div>
              <p className="relative mt-3 truncate text-sm font-black">{g.name}</p>
              <p className="relative mt-0.5 h-8 text-[10px] leading-4 text-foreground/55">
                {g.subtitle ?? ""}
              </p>
            </button>
          );
        })}
      </div>
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
