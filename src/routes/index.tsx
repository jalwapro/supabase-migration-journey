import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const { user, profile, isAdmin, signOut, loading } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="glass sticky top-0 z-10 flex items-center justify-between px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold text-gradient">Jalwa</h1>
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Create · Share · Shine
          </p>
        </div>
        <nav className="flex items-center gap-2 text-sm">
          {loading ? (
            <span className="text-muted-foreground">…</span>
          ) : user ? (
            <>
              <span className="hidden sm:inline text-muted-foreground">
                @{profile?.username ?? user.email}
              </span>
              {isAdmin && (
                <span className="rounded-full bg-gold/20 px-3 py-1 text-xs font-semibold text-gold">
                  Admin
                </span>
              )}
              <button
                onClick={() => signOut()}
                className="rounded-full border border-border bg-card px-4 py-2 hover:bg-muted"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              to="/auth"
              className="rounded-full bg-primary px-4 py-2 font-medium text-primary-foreground hover:opacity-90"
            >
              Sign in
            </Link>
          )}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <section className="glass rounded-3xl p-8 md:p-12 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Phase 1 · Foundation ready
          </p>
          <h2 className="mt-3 text-4xl md:text-5xl font-bold">
            <span className="text-gradient">Live voice &amp; video parties.</span>
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Auth, roles, profiles and design tokens are wired. Next phases: home
            banners &amp; live rooms, room interior (chat/gifts/seats), wallet,
            admin panel, social, games, and Agora A/V.
          </p>
          {!user && (
            <Link
              to="/auth"
              className="mt-6 inline-flex rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground hover:opacity-90"
            >
              Get started
            </Link>
          )}
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {[
            ["Rooms", "Voice & video party rooms with seats and PK battles."],
            ["Gifting", "60% of every gift goes to the host as diamonds."],
            ["Wallet", "Coins via EasyPaisa / JazzCash / bank; diamonds → PKR."],
            ["Games", "Ludo, PK battles, more coming."],
            ["Themes & Frames", "Buy premium themes and DP frames."],
            ["Admin", "Full moderation, finance and content control."],
          ].map(([title, desc]) => (
            <div key={title} className="glass rounded-2xl p-5">
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
