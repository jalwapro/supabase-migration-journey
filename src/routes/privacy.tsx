import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#07070b] text-white">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:py-12">
        <header className="mb-8">
          <a href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-white/60 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back to Jalwa
          </a>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-fuchsia-950/20">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-fuchsia-500/15 text-fuchsia-300">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300">Jalwa Global Live</p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Privacy Policy</h1>
            <p className="mt-3 text-sm leading-6 text-white/60">
              This Privacy Policy explains how Jalwa collects, uses, protects, and shares information when you use the Jalwa app and website.
            </p>
            <p className="mt-4 text-xs text-white/40">Last updated: September 19, 2026</p>
          </div>
        </header>

        <div className="space-y-5">
          <Section title="1. Information We Collect">
            Jalwa may collect information you provide when you create or use an account, including your name, username, email address, profile photo, date of birth where required, and other profile information. We also collect information generated through use of the service, such as follows, blocked users, messages, room participation, reactions, gifts, rankings, notifications, and other in-app activity.
          </Section>
          <Section title="2. Google Sign-In">
            If you choose to sign in with Google, Jalwa receives authentication information provided by Google, such as your Google account identifier, email address, name, and profile image when available. Jalwa uses this information to create or authenticate your Jalwa account. Jalwa does not receive or store your Google password.
          </Section>
          <Section title="3. Voice Rooms and Microphone">
            Jalwa provides real-time audio voice rooms. When you join a voice room and enable your microphone, microphone audio is transmitted through the real-time communication service used by Jalwa so that other authorized participants can hear you. Jalwa uses LiveKit for real-time audio communication. Jalwa does not use the microphone when you have not granted the relevant permission or enabled the microphone feature.
          </Section>
          <Section title="4. Messages, Rooms, Gifts, and Social Features">
            Information you submit or generate through chats, voice rooms, reactions, gifts, follows, profiles, rankings, and related social features may be stored and processed to provide those features, maintain service integrity, prevent abuse, and enforce our rules. Content may be visible to the users or room participants with whom you choose to share it.
          </Section>
          <Section title="5. Payments, Coins, and Financial Activity">
            Jalwa may process information needed to manage virtual coins, diamonds, recharges, withdrawals, transaction references, and payment verification. Payment information is handled according to the payment method and provider involved. Jalwa does not need your full card number, CVV, or card expiry date to operate its hosted card-payment flow. Transaction and verification records may be retained for fraud prevention, accounting, dispute handling, and legal requirements.
          </Section>
          <Section title="6. Device, Technical, and Usage Information">
            We may process technical information such as IP address, browser or device type, operating system, app version, language, network information, approximate location derived from technical data, and diagnostic or security logs. This information helps us operate, secure, troubleshoot, and improve Jalwa.
          </Section>
          <Section title="7. Notifications and Push Services">
            If you enable notifications, Jalwa may use a push-notification service to deliver messages such as gifts, follows, room activity, security alerts, and other app notifications. You can control notification permissions through your device and available Jalwa settings.
          </Section>
          <Section title="8. How We Use Information">
            We use information to authenticate accounts, provide voice rooms and social features, operate profiles and messaging, process recharges and withdrawals, deliver notifications, prevent fraud and abuse, protect users, maintain security, troubleshoot technical problems, improve the service, and comply with applicable legal obligations.
          </Section>
          <Section title="9. Service Providers and Data Sharing">
            Jalwa may use trusted service providers for authentication, database and storage services, hosting, real-time communication, notifications, analytics or diagnostics, and payment processing. We share information with providers only as reasonably necessary to provide, secure, or operate the relevant service. Jalwa does not sell personal information.
          </Section>
          <Section title="10. Data Security">
            Jalwa uses reasonable technical and organizational safeguards to protect information against unauthorized access, alteration, disclosure, or destruction. Data transmitted between your device and supported services is protected using encryption in transit where supported. No internet service can guarantee absolute security.
          </Section>
          <Section title="11. Data Retention and Account Deletion">
            We retain information for as long as reasonably necessary to provide the service, maintain security, resolve disputes, keep financial and transaction records, and meet legal obligations. You may request deletion of your Jalwa account and associated personal information through the available account support or deletion process. Some information may need to be retained where required by law or for legitimate security and financial records.
          </Section>
          <Section title="12. Your Choices and Rights">
            Depending on your location and applicable law, you may have rights to access, correct, delete, or otherwise control certain personal information. You can also manage profile information, microphone permissions, notification permissions, and other available privacy controls through Jalwa or your device settings.
          </Section>
          <Section title="13. Children's Privacy">
            Jalwa is not intended for children who are below the minimum age required to use the service under applicable law. We do not knowingly collect personal information from children in violation of applicable age requirements.
          </Section>
          <Section title="14. Changes to This Policy">
            We may update this Privacy Policy when our services, technology, legal requirements, or data practices change. The updated version will be published on this page with a revised update date.
          </Section>
          <Section title="15. Contact Jalwa">
            For privacy questions, account-data requests, or other privacy concerns, please use the support/contact channel provided inside the Jalwa app or website.
          </Section>
        </div>

        <footer className="mt-8 border-t border-white/10 pt-6 text-center text-xs text-white/35">
          © 2026 Jalwa Global Live. All rights reserved.
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
