import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";

export const Route = createFileRoute("/_authenticated/privacy")({ component: Page });

function Page() {
  return (
    <>
      <AppShell title="Privacy Policy" showBack>
        <div className="space-y-4 px-4 pt-4 pb-6 text-sm leading-relaxed text-muted-foreground">
          <Section title="1. Information We Collect">
            We collect your email, username, profile info, chat/room activity, and payment data required to
            operate the app. Voice/video streams pass through Agora and are not recorded by us.
          </Section>
          <Section title="2. How We Use Data">
            To provide the service, personalize your experience, prevent abuse, process recharges and
            withdrawals, and comply with legal obligations.
          </Section>
          <Section title="3. Data Sharing">
            We do not sell your personal data. We share only with essential providers (auth, hosting, payments,
            realtime voice) under strict agreements.
          </Section>
          <Section title="4. Your Rights">
            You may edit your profile, delete photos, block users, request account deletion, or export your
            data at any time from Settings.
          </Section>
          <Section title="5. Security">
            All traffic is encrypted in transit. Passwords are hashed. Row-level security restricts data access
            to the owning user unless explicitly shared.
          </Section>
          <Section title="6. Contact">
            For any questions email support@jalwa.app.
          </Section>
          <p className="text-[11px] opacity-60">Last updated: {new Date().toLocaleDateString()}</p>
        </div>
      </AppShell>
      <BottomNav />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1 text-sm font-bold text-foreground">{title}</h3>
      <p>{children}</p>
    </div>
  );
}
