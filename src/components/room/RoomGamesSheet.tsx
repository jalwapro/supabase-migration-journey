import { useState } from "react";
import { X, Dice5, Sparkles, ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import { useRoomGames, type RoomGame } from "@/lib/roomGames";

/**
 * RoomGamesSheet.tsx
 * -------------------
 * Room's Games popup: Ludo (native board game) + every game the admin has
 * added in Admin → Room games. Each admin game is a PNG button; tapping it
 * opens that game's `game_url` inline via <iframe>, without leaving the
 * room (voice/video keeps running behind this sheet).
 *
 * Nothing here needs to change when you add a new game — just add it in
 * the admin panel (Admin → Room games) and it appears automatically.
 *
 * INTEGRATION — in src/routes/_authenticated/room.$roomId.tsx:
 *
 *   1. const [gamesSheetOpen, setGamesSheetOpen] = useState(false);
 *
 *   2. onOpenGames={() => {
 *        setVideoSettingsOpen(false);
 *        setGamesSheetOpen(true);   // was: openLudo()
 *      }}
 *
 *   3. <RoomGamesSheet
 *        open={gamesSheetOpen}
 *        onClose={() => setGamesSheetOpen(false)}
 *        onOpenLudo={() => {
 *          setGamesSheetOpen(false);
 *          openLudo();
 *        }}
 *      />
 */

export function RoomGamesSheet({
  open,
  onClose,
  onOpenLudo,
  onOpenSlots,
  onOpenCrash,
  onOpenDragonTiger,
  onOpenInOut,
  onOpenPlinko,
}: {
  open: boolean;
  onClose: () => void;
  onOpenLudo: () => void;
  onOpenSlots: () => void;
  onOpenCrash?: () => void;
  onOpenDragonTiger?: () => void;
  onOpenInOut?: () => void;
  onOpenPlinko?: () => void;
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
            onOpenLudo={onOpenLudo}
            onOpenSlots={onOpenSlots}
            onOpenCrash={onOpenCrash}
            onOpenDragonTiger={onOpenDragonTiger}
            onOpenInOut={onOpenInOut}
            onOpenPlinko={onOpenPlinko}
            onPickGame={setActiveGame}
          />
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — picker grid: Ludo + every admin-added game (PNG buttons)
// ---------------------------------------------------------------------------

function GamesPicker({
  onClose,
  onOpenLudo,
  onOpenSlots,
  onOpenCrash,
  onOpenDragonTiger,
  onOpenInOut,
  onOpenPlinko,
  onPickGame,
}: {
  onClose: () => void;
  onOpenLudo: () => void;
  onOpenSlots: () => void;
  onOpenCrash?: () => void;
  onOpenDragonTiger?: () => void;
  onOpenInOut?: () => void;
  onOpenPlinko?: () => void;
  onPickGame: (g: RoomGame) => void;
}) {
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
        {/* Ludo — native board game, kept as its own seat/bet flow */}
        <button
          onClick={onOpenLudo}
          className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-4 text-left transition-transform active:scale-[0.97]"
        >
          <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-[color:var(--primary)]/30 blur-2xl" />
          <div className="relative grid h-14 w-14 place-items-center rounded-2xl border border-[color:var(--primary)]/50 bg-[color:var(--primary)]/15">
            <Dice5 className="h-7 w-7 text-[color:var(--primary)]" />
          </div>
          <p className="relative mt-3 text-sm font-black">Ludo Battle</p>
          <p className="relative mt-0.5 h-8 text-[10px] leading-4 text-foreground/55">
            4 seats · live board · room bet
          </p>
        </button>

        {/* 777 Slots — native game, real coins, server-side spin */}
        <button
          onClick={onOpenSlots}
          className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-4 text-left transition-transform active:scale-[0.97]"
        >
          <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-[#F0C674]/30 blur-2xl" />
          <div className="relative grid h-14 w-14 place-items-center rounded-2xl border border-[#F0C674]/50 bg-[#F0C674]/15 text-3xl">
            🎰
          </div>
          <p className="relative mt-3 text-sm font-black">777 Slots</p>
          <p className="relative mt-0.5 h-8 text-[10px] leading-4 text-foreground/55">
            Jackpot · free spins
          </p>
        </button>

        {/* Crash X — native casino game, real coins, server-side crash point */}
        <button
          onClick={onOpenCrash}
          className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-4 text-left transition-transform active:scale-[0.97]"
        >
          <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-orange-500/30 blur-2xl" />
          <div className="relative grid h-14 w-14 place-items-center rounded-2xl border border-orange-500/50 bg-orange-500/15 text-3xl">
            🚀
          </div>
          <p className="relative mt-3 text-sm font-black">Crash X</p>
          <p className="relative mt-0.5 h-8 text-[10px] leading-4 text-foreground/55">
            Ride the multiplier · cash out
          </p>
        </button>

        {/* Dragon vs Tiger — native casino game */}
        <button
          onClick={onOpenDragonTiger}
          className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-4 text-left transition-transform active:scale-[0.97]"
        >
          <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-red-500/30 blur-2xl" />
          <div className="relative grid h-14 w-14 place-items-center rounded-2xl border border-red-500/50 bg-red-500/15 text-3xl">
            🐉
          </div>
          <p className="relative mt-3 text-sm font-black">Dragon vs Tiger</p>
          <p className="relative mt-0.5 h-8 text-[10px] leading-4 text-foreground/55">
            Pick a side · instant result
          </p>
        </button>

        {/* In & Out — native casino game */}
        <button
          onClick={onOpenInOut}
          className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-4 text-left transition-transform active:scale-[0.97]"
        >
          <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-rose-500/30 blur-2xl" />
          <div className="relative grid h-14 w-14 place-items-center rounded-2xl border border-rose-500/50 bg-rose-500/15 text-3xl">
            🔴
          </div>
          <p className="relative mt-3 text-sm font-black">In & Out</p>
          <p className="relative mt-0.5 h-8 text-[10px] leading-4 text-foreground/55">
            Roll the dice · pick in or out
          </p>
        </button>

        {/* Plinko — native casino game */}
        <button
          onClick={onOpenPlinko}
          className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-4 text-left transition-transform active:scale-[0.97]"
        >
          <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-purple-500/30 blur-2xl" />
          <div className="relative grid h-14 w-14 place-items-center rounded-2xl border border-purple-500/50 bg-purple-500/15 text-3xl">
            🟣
          </div>
          <p className="relative mt-3 text-sm font-black">Plinko</p>
          <p className="relative mt-0.5 h-8 text-[10px] leading-4 text-foreground/55">
            Drop the ball · chase multipliers
          </p>
        </button>

        {games.isLoading && (
          <div className="col-span-2 grid place-items-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-[color:var(--gold)]" />
          </div>
        )}

        {!games.isLoading && games.data?.length === 0 && (
          <p className="col-span-2 py-6 text-center text-xs text-foreground/50">
            No games added yet. Add one in Admin → Room games.
          </p>
        )}

        {games.data?.map((g) => (
          <button
            key={g.id}
            onClick={() => onPickGame(g)}
            className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-4 text-left transition-transform active:scale-[0.97]"
          >
            <div className="relative grid h-14 w-14 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-black/30">
              {g.icon_url ? (
                <img src={g.icon_url} alt={g.name} className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <span className="text-3xl">🎮</span>
              )}
            </div>
            <p className="relative mt-3 truncate text-sm font-black">{g.name}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — the tapped game opens right here, inside an iframe
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
            src={game.game_url}
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
