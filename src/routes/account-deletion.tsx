import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, Trash2 } from "lucide-react";

export const Route = createFileRoute("/account-deletion")({
  component: AccountDeletionPage,
  head: () => ({
    meta: [
      { title: "Account Deletion | Jalwa Live" },
      { name: "description", content: "Permanently delete your Jalwa account and personal data." },
      { property: "og:title", content: "Account Deletion | Jalwa Live" },
      { property: "og:description", content: "Permanently delete your Jalwa account and personal data." },
    ],
  }),
});

function AccountDeletionPage() {
  return (
    <main className="min-h-screen bg-[#07070b] px-4 py-10 text-white">
      <div className="mx-auto w-full max-w-2xl">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl sm:p-8">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/15 text-red-300">
            <Trash2 className="h-6 w-6" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300">Jalwa Global Live</p>
          <h1 className="mt-2 text-3xl font-bold">Account Deletion</h1>
          <p className="mt-3 text-sm leading-7 text-white/65">
            If you have a Jalwa account, you can permanently delete it from the
            in-app <strong className="text-white">Delete Account</strong> action
            in your profile. The in-app flow verifies your signed-in session and
            performs the deletion server-side.
          </p>

          <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center gap-2 text-sm font-bold">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              What is deleted
            </div>
            <p className="mt-2 text-xs leading-6 text-white/60">
              Your Jalwa authentication account, profile, user-linked app data,
              and user-owned storage objects are removed. Certain financial or
              security records may be retained where required for fraud
              prevention, accounting, disputes, or legal compliance.
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <a href="/auth" className="rounded-2xl bg-fuchsia-500 px-4 py-3 text-center text-sm font-black text-white">
              Sign in to delete
            </a>
            <a href="mailto:admin@jalwa.pro?subject=Jalwa%20Account%20Deletion%20Request" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-bold text-white/80">
              Request by email
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
