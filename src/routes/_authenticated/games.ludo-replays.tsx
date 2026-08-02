import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Dices } from "lucide-react";
import { BottomNav } from "@/components/layout/BottomNav";
import { LudoReplayViewer } from "@/components/games/LudoReplayViewer";

export const Route = createFileRoute("/_authenticated/games/ludo-replays")({
  head: () => ({
    meta: [
      { title: "Ludo Match Replays — Review Your Games | Jalwa" },
      {
        name: "description",
        content: "Step through every dice roll, move and server validation from your Jalwa Ludo matches.",
      },
      { property: "og:title", content: "Jalwa Ludo Replays" },
      { property: "og:description", content: "Turn-by-turn replay of your Ludo matches with dice and move history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LudoReplaysPage,
});

function LudoReplaysPage() {
  return (
    <>
      <div className="min-h-[100dvh] bg-background pb-28">
        <header
          className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
            <Link
              to="/games"
              aria-label="Back"
              className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="flex items-center gap-2 text-base font-black">
                <Dices className="h-4 w-4 text-[color:var(--primary)]" /> Ludo Replays
              </h1>
              <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                Dice, moves & server checks
              </p>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-md px-4 py-4">
          <LudoReplayViewer />
        </main>
      </div>
      <BottomNav />
    </>
  );
}
