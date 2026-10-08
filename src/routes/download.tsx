import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Download, Mic, MessageCircle, Gift, Zap, ShieldCheck, Smartphone, Users, WifiOff, Sparkles } from "lucide-react";

export const Route = createFileRoute("/download")({
  component: DownloadPage,
  head: () => ({
    meta: [
      { title: "Download JALWA — Live Voice & Chat" },
      {
        name: "description",
        content: "Download the JALWA Android app for live voice rooms, chat, gifts and a faster mobile experience.",
      },
    ],
  }),
});

const benefits = [
  { icon: Mic, title: "Live Voice Rooms", text: "Audio-only rooms mein hosts aur friends ke saath real-time baat karein." },
  { icon: MessageCircle, title: "Fast Chat", text: "Room aur private chat ke through apne friends se connected rahain." },
  { icon: Gift, title: "Gifts & Rewards", text: "Friends ko gifts bhejein, gifting levels grow karein aur rewards unlock karein." },
  { icon: Zap, title: "Fast Mobile Experience", text: "Native Android app ke liye optimized experience, browser se zyada smooth." },
  { icon: WifiOff, title: "Local-First Resources", text: "Essential app resources device par cache hotay hain taake repeat loading kam ho." },
  { icon: ShieldCheck, title: "Your JALWA Account", text: "Apne existing JALWA account ke saath app mein sign in karein." },
];

function DownloadPage() {
  const apk = useQuery({
    queryKey: ["public_apk_download"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_downloads").select("file_url,file_name,file_size").eq("id", "android").maybeSingle();
      if (error) throw error;
      return data as { file_url: string | null; file_name: string; file_size: number | null } | null;
    },
    staleTime: 60_000,
  });
  const apkUrl = apk.data?.file_url ?? null;

  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-[#07040c] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="absolute -right-32 top-1/3 h-96 w-96 rounded-full bg-violet-500/20 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--secondary)] text-lg font-black">
              J
            </div>
            <div>
              <div className="text-base font-black">JALWA</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Global Live</div>
            </div>
          </div>
          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-bold text-emerald-300">
            Android App
          </span>
        </header>

        <section className="mx-auto max-w-3xl py-14 text-center sm:py-20">
          <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-fuchsia-200">
            <Smartphone className="h-3.5 w-3.5" />
            Official JALWA APK
          </div>

          <h1 className="text-4xl font-black tracking-tight sm:text-6xl">
            JALWA ko app mein
            <span className="block bg-gradient-to-r from-fuchsia-300 via-violet-300 to-amber-200 bg-clip-text text-transparent">
              experience karein.
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-sm leading-6 text-white/60 sm:text-base">
            JALWA ek audio voice & chat community hai jahan aap live voice rooms join kar sakte hain,
            friends se chat kar sakte hain aur gifts ke through apni community grow kar sakte hain.
          </p>

          <a
            {apkUrl ? (
              <a
                href={apkUrl}
                download={apk.data?.file_name || "JALWA.apk"}
                className="mx-auto mt-8 inline-flex min-h-14 w-full max-w-sm items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-fuchsia-500 via-violet-500 to-purple-600 px-6 py-4 text-base font-black shadow-[0_15px_50px_-15px_rgba(168,85,247,0.8)] transition-transform active:scale-[0.98]"
              >
                <Download className="h-5 w-5" />
                Download JALWA APK
              </a>
            ) : (
              <div className="mx-auto mt-8 w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-4 text-sm font-bold text-white/60">
                APK is temporarily unavailable. Please try again later.
              </div>
            )}

          <p className="mt-3 text-[10px] text-white/35">
            Android • Direct APK download • Official JALWA app
          </p>
        </section>

        <section>
          <div className="mb-6 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-fuchsia-300/80">Why JALWA?</p>
            <h2 className="mt-2 text-2xl font-black sm:text-3xl">App install karne ke benefits</h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 backdrop-blur-xl">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/[0.07]">
                  <Icon className="h-5 w-5 text-fuchsia-300" />
                </div>
                <h3 className="mt-4 text-sm font-black">{title}</h3>
                <p className="mt-1.5 text-xs leading-5 text-white/50">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-10 max-w-2xl rounded-3xl border border-white/10 bg-white/[0.035] p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-400/10">
              <Sparkles className="h-5 w-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base font-black">Install karna simple hai</h2>
              <ol className="mt-4 space-y-3 text-xs leading-5 text-white/55">
                <li><span className="mr-2 font-black text-white">1.</span> Download JALWA APK par tap karein.</li>
                <li><span className="mr-2 font-black text-white">2.</span> APK download complete honay dein.</li>
                <li><span className="mr-2 font-black text-white">3.</span> APK open karke Android installation allow karein.</li>
                <li><span className="mr-2 font-black text-white">4.</span> JALWA open karein aur apne account se sign in karein.</li>
              </ol>
            </div>
          </div>
        </section>

        <footer className="py-10 text-center text-[10px] text-white/30">
          <div className="flex items-center justify-center gap-1.5">
            <Users className="h-3 w-3" />
            JALWA Global Live
          </div>
          <p className="mt-1">Live Voice • Chat • Gifts</p>
        </footer>
      </div>
    </main>
  );
}
