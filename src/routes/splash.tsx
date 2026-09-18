import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Gift, Mic, ShieldCheck, Users, WalletCards, Gamepad2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { JALWA_LOGO as logo } from "@/lib/r2-static";

export const Route = createFileRoute("/splash")({
  component: Splash,
  head: () => ({
    meta: [
      { title: "Jalwa Global Live — Live Voice Rooms & Social" },
      {
        name: "description",
        content:
          "Jalwa Global Live is a social live-audio platform for voice rooms, real-time conversations, gifts, games, profiles, messaging, and virtual coins.",
      },
      { property: "og:title", content: "Jalwa Global Live" },
      {
        property: "og:description",
        content:
          "Join live voice rooms, talk with communities, send gifts, play games, and connect with people on Jalwa.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
});

function Splash() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/", replace: true });
  }, [loading, user, navigate]);

  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col px-5 py-8 sm:px-8">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="Jalwa Global Live"
              className="h-12 w-12 rounded-2xl object-cover shadow-lg"
            />
            <div>
              <p className="text-lg font-black tracking-tight">Jalwa Global Live</p>
              <p className="text-xs text-muted-foreground">Live voice & social community</p>
            </div>
          </div>
          <Link
            to="/auth"
            className="rounded-full bg-gradient-to-r from-[color:var(--primary)] to-[color:var(--secondary)] px-4 py-2 text-xs font-black text-primary-foreground"
          >
            Sign in
          </Link>
        </header>

        <section className="relative mt-10 overflow-hidden rounded-[2rem] border border-white/10 bg-card/60 p-7 shadow-2xl sm:p-10">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full blur-3xl"
            style={{ background: "color-mix(in oklab, var(--primary) 25%, transparent)" }}
          />
          <div className="relative max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-[color:var(--primary)]">
              Welcome to Jalwa
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">
              Connect. Talk. Share the moment.
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
              Jalwa is a social live-audio platform where people can join real-time voice
              rooms, talk with communities, follow users, exchange messages and reactions,
              send virtual gifts, play games, and manage virtual coins and diamonds.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/auth"
                className="rounded-full bg-gradient-to-r from-[color:var(--primary)] to-[color:var(--secondary)] px-6 py-3 text-sm font-black text-primary-foreground"
              >
                Get started
              </Link>
              <Link
                to="/privacy"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-bold"
              >
                <ShieldCheck className="h-4 w-4" />
                Privacy Policy
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-2">
          <Feature Icon={Mic} title="Live voice rooms" text="Real-time audio conversations through LiveKit. Microphone access is used only for voice-room audio." />
          <Feature Icon={Users} title="Social community" text="Profiles, follows, messaging, reactions, room participation, rankings, and notifications." />
          <Feature Icon={Gift} title="Gifts & interactions" text="Send virtual gifts and reactions to other users during social interactions and live rooms." />
          <Feature Icon={Gamepad2} title="Games & activities" text="Participate in in-app games and interactive community activities." />
          <Feature Icon={WalletCards} title="Coins & wallet" text="Manage virtual coins, diamonds, recharges, withdrawals, and transaction records." />
          <Feature Icon={ShieldCheck} title="Google Sign-In" text="Google Sign-In is used to authenticate your Jalwa account. Jalwa does not receive your Google password." />
        </section>

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <h2 className="text-base font-black sm:text-lg">Why Jalwa requests your data</h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            Account and Google authentication data is used to create and secure your account.
            Microphone permission enables real-time voice participation. Profile, messaging,
            room, gift, wallet, and device information is used to provide the features you
            choose to use, maintain security, prevent abuse, process transactions, deliver
            notifications, and improve the service.
          </p>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Jalwa does not sell, rent, or trade personal information. Details about collection,
            use, sharing, security, retention, and deletion are available in our Privacy Policy.
          </p>
        </section>

        <footer className="mt-auto pt-8 text-center text-xs text-muted-foreground">
          <div className="flex items-center justify-center gap-4">
            <Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link>
            <Link to="/auth" className="hover:text-foreground">Sign in</Link>
          </div>
          <p className="mt-3">© 2026 Jalwa Global Live. All rights reserved.</p>
        </footer>
      </div>
    </main>
  );
}

function Feature({
  Icon,
  title,
  text,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[color:var(--primary)]/10 text-[color:var(--primary)]">
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="mt-4 text-sm font-black">{title}</h2>
      <p className="mt-1.5 text-xs leading-6 text-muted-foreground">{text}</p>
    </article>
  );
}
