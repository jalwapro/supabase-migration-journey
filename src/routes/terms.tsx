import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FileText } from "lucide-react";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

function TermsPage() {
  return (
    <main className="min-h-screen bg-[#07070b] text-white">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:py-12">
        <header className="mb-8">
          <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-white/60 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back to Jalwa
          </Link>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-fuchsia-500/15 text-fuchsia-300">
              <FileText className="h-6 w-6" />
            </div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300">Jalwa Global Live</p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Terms of Service</h1>
            <p className="mt-3 text-sm leading-6 text-white/60">
              These Terms govern your use of the Jalwa app, website, live rooms, messaging, virtual goods, and related services.
            </p>
            <p className="mt-4 text-xs text-white/40">Last updated: September 19, 2026</p>
          </div>
        </header>

        <div className="space-y-5">
          <Section title="1. Acceptance">By creating an account or using Jalwa, you agree to these Terms and our Privacy Policy. If you do not agree, do not use the service.</Section>
          <Section title="2. Eligibility">Jalwa is intended for adults 18 years of age or older. You are responsible for providing accurate account information and for keeping your account credentials secure.</Section>
          <Section title="3. Accounts">You must not impersonate another person, create accounts for abusive or fraudulent purposes, or share access in a way that compromises account security. We may suspend or restrict accounts that violate these Terms or applicable law.</Section>
          <Section title="4. Live Rooms and User Content">Jalwa provides live audio rooms, chat, reactions, gifts, profiles, and other social features. You are responsible for content and conduct associated with your account. Do not use Jalwa for harassment, threats, fraud, illegal activity, spam, sexual exploitation, or infringement of another person's rights.</Section>
          <Section title="5. Microphone and Audio">Voice rooms use microphone access only when the relevant permission and room controls allow it. Audio may be transmitted to authorized participants through Jalwa's real-time audio infrastructure. You should not record, redistribute, or misuse another user's audio or content without appropriate permission or legal basis.</Section>
          <Section title="6. Virtual Coins, Diamonds, Gifts, and Purchases">Jalwa may offer virtual coins, diamonds, gifts, and other digital items. Virtual items are digital service features, not cash, bank deposits, securities, or ownership interests. Purchases are subject to the selected payment provider's terms. Jalwa may require payment verification before crediting coins. Virtual balances and transaction records may be adjusted or reversed where required to correct fraud, chargebacks, duplicate transactions, or technical errors.</Section>
          <Section title="7. Payments and Refunds">Payment details for hosted card checkout are handled by the applicable payment processor. Jalwa is designed not to receive or store full card numbers, CVV codes, or card expiry dates in its application database. Refunds, cancellations, and disputes are handled according to the applicable payment method, provider rules, and applicable law.</Section>
          <Section title="8. Prohibited Conduct">You may not exploit bugs, bypass security controls, manipulate rankings or balances, automate abusive activity, distribute malware, scrape private information, conduct payment fraud, sell accounts without authorization, or interfere with the operation of Jalwa.</Section>
          <Section title="9. Safety and Moderation">We may use automated and human review, reports, moderation tools, account restrictions, and other safeguards to protect the community. Content or accounts may be removed or restricted when necessary to enforce these Terms, protect users, investigate abuse, or comply with law.</Section>
          <Section title="10. Intellectual Property">Jalwa and its software, branding, interfaces, graphics, and service content are owned by or licensed to Jalwa and protected by applicable intellectual-property laws. You retain rights you already have in content you submit, subject to the permissions necessary for Jalwa to operate the service.</Section>
          <Section title="11. Third-Party Services">Jalwa may rely on third-party services including Google authentication, Supabase, Vercel, Oracle Cloud Infrastructure, LiveKit, Firebase/FCM, and payment processors. Their services may be governed by separate terms and policies.</Section>
          <Section title="12. Availability">We work to keep Jalwa available and reliable but do not guarantee uninterrupted service. Features may change, be temporarily unavailable, or require maintenance, updates, or security fixes.</Section>
          <Section title="13. Suspension and Termination">You may stop using Jalwa at any time. We may suspend or terminate access where reasonably necessary for security, abuse prevention, legal compliance, or material violations of these Terms. Account deletion does not necessarily erase records that must be retained for legal, security, or financial reasons.</Section>
          <Section title="14. Disclaimers and Liability">To the extent permitted by law, Jalwa is provided on an as-available basis. We are not responsible for losses caused by unauthorized access resulting from your failure to protect account credentials, third-party services outside our control, or user-generated content and conduct. Nothing in these Terms excludes rights or liabilities that cannot legally be excluded.</Section>
          <Section title="15. Changes">We may update these Terms when the service, legal requirements, or operating practices change. Continued use after an updated version becomes effective means you accept the updated Terms to the extent permitted by law.</Section>
          <Section title="16. Contact">For account, payment, privacy, or Terms questions, contact admin@jalwa.pro, admin@jalwa.app, or smartsoloutionservicess@gmail.com.</Section>
        </div>

        <footer className="mt-8 flex flex-wrap items-center justify-center gap-4 border-t border-white/10 pt-6 text-xs text-white/35">
          <Link to="/privacy" className="hover:text-white underline underline-offset-4">Privacy Policy</Link>
          <span>© 2026 Jalwa Global Live</span>
        </footer>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <h2 className="mb-2 text-base font-bold text-white sm:text-lg">{title}</h2>
      <p className="text-sm leading-7 text-white/65">{children}</p>
    </section>
  );
}
