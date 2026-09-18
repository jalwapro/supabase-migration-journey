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
            Jalwa may collect information you provide when you create or use an account, including your name, username, email address, profile photo, date of birth where required, and authentication identifiers. We also collect information generated through use of the service, such as follows, blocked users, messages, room participation, reactions, gifts, rankings, notifications, and other in-app activity.
          </Section>
          <Section title="2. Google Sign-In">
            If you choose to sign in with Google, Jalwa receives authentication information provided by Google, such as your Google account identifier, email address, name, and profile image when available. Jalwa uses this information to create or authenticate your Jalwa account. Jalwa does not receive or store your Google password.
          </Section>
          <Section title="Google User Data Policy">
            <div className="space-y-4 text-sm leading-7 text-white/65">
              <h3 className="text-base font-semibold text-white">Google User Data: Access, Use, Storage, and Sharing</h3>
              <p><strong className="text-white">Access:</strong> Jalwa Global Live uses Google OAuth to authenticate users. We access basic Google profile information made available through the Google OAuth sign-in flow, including your name, email address, profile picture, and Google account identifier. We do not access your Google password, contacts, files, Google Drive content, Gmail content, or other Google services unless a separate authorization screen explicitly asks for a scope and you grant it.</p>
              <p><strong className="text-white">Use:</strong> We use Google user data only to create and authenticate your Jalwa account, identify you within Jalwa, maintain your account profile, secure account access, and provide the personalized Jalwa experience and live voice-room functionality you request. We do not use Google user data for targeted advertising, personalized advertising, retargeting, sale to data brokers, credit decisions, or any unrelated purpose.</p>
              <p><strong className="text-white">Storage:</strong> Account information received through Google sign-in, such as your name, email address, profile information, and authentication identifiers, may be securely stored in our Supabase database as part of your Jalwa account. We use access controls, row-level security where applicable, and encryption in transit to help protect this information. We do not store your Google password.</p>
              <p><strong className="text-white">Sharing and Disclosure:</strong> Jalwa Global Live does not sell or rent Google user data. We do not share Google user data with advertisers or data brokers. Limited data may be processed by service providers that are necessary to operate Jalwa, such as Supabase for database services and hosting/infrastructure providers for operating the application, only for purposes of providing or improving Jalwa functionality and subject to appropriate safeguards. We do not transfer Google user data for advertising or other unrelated purposes.</p>
              <p><strong className="text-white">Security:</strong> We maintain reasonable technical and organizational safeguards designed to protect Google user data from unauthorized access, alteration, disclosure, or destruction. Access to account data is restricted to authorized systems and personnel who need it to operate or support Jalwa.</p>
              <p><strong className="text-white">Retention:</strong> We retain Google-derived account information for as long as your Jalwa account remains active or as reasonably necessary to provide the service, maintain security, resolve disputes, prevent abuse, and meet legal obligations. When information is no longer required, we delete or anonymize it where reasonably practicable, subject to legal, financial, or security retention requirements.</p>
              <p><strong className="text-white">Data Deletion:</strong> You may request complete deletion of your Jalwa account and associated Google user data at any time by contacting <a href="mailto:admin@jalwa.pro" className="text-fuchsia-300 hover:text-fuchsia-200">admin@jalwa.pro</a> or using the in-app account deletion feature when available. We will process deletion requests in accordance with applicable law and our retention obligations.</p>
              <p><strong className="text-white">Policy Compliance:</strong> Jalwa Global Live limits its use and transfer of Google user data to providing or improving user-facing features and does not use Google user data for targeted advertising, sale to data brokers, information resale, creditworthiness decisions, lending, or training generalized AI/ML models.</p>
            </div>
          </Section>
          <Section title="3. Voice Rooms and Microphone">
            Jalwa provides real-time audio voice rooms. When you join a voice room and enable your microphone, microphone audio is transmitted through LiveKit so authorized participants in the room can hear you. Jalwa does not use the microphone when you have not granted the relevant permission or enabled the microphone feature. Jalwa voice rooms are audio-only.
          </Section>
          <Section title="4. Messages, Rooms, Gifts, and Social Features">
            Information you submit or generate through chats, voice rooms, reactions, gifts, follows, profiles, rankings, and related social features may be stored and processed to provide those features, maintain service integrity, prevent abuse, and enforce our rules. Content may be visible to the users or room participants with whom you choose to share it.
          </Section>
          <Section title="5. Payments, Coins, and Financial Activity">
            Jalwa may process information needed to manage virtual coins, diamonds, recharges, withdrawals, transaction references, and payment verification. Payment information is handled according to the payment method and provider involved. Jalwa's hosted card-payment flow is designed so Jalwa does not receive or store your full card number, CVV, or card expiry date. Transaction and verification records may be retained for fraud prevention, accounting, dispute handling, and legal requirements.
          </Section>
          <Section title="6. Device, Technical, and Usage Information">
            We may process technical information such as IP address, browser or device type, operating system, app version, language, network information, and diagnostic or security logs. This information helps us operate, secure, troubleshoot, and improve Jalwa.
          </Section>
          <Section title="7. Notifications and Push Services">
            If you enable notifications, Jalwa may use a push-notification service to deliver messages such as gifts, follows, room activity, security alerts, and other app notifications. You can control notification permissions through your device and available Jalwa settings.
          </Section>
          <Section title="8. How We Use Information">
            We use information to authenticate accounts, provide voice rooms and social features, operate profiles and messaging, process recharges and withdrawals, deliver notifications, prevent fraud and abuse, protect users, maintain security, troubleshoot technical problems, improve the service, and comply with applicable legal obligations.
          </Section>
          <Section title="9. Data Sharing & Service Providers">
            Jalwa does not sell, rent, or trade personal information. We may share information with essential service providers as reasonably necessary to operate the service, including Google for authentication, Supabase for database and storage services, Vercel for hosting, Oracle Cloud Infrastructure for server infrastructure, LiveKit for real-time audio, push-notification providers, and payment processors. Providers receive only information reasonably necessary for their service.
          </Section>
          <Section title="10. Data Security">
            Jalwa uses reasonable technical and organizational safeguards to protect information against unauthorized access, alteration, disclosure, or destruction. Data transmitted between your device and supported services is protected using encryption in transit where supported. Database access is protected with access controls and row-level security where applicable. No internet service can guarantee absolute security.
          </Section>
          <Section title="11. Data Retention and Account Deletion">
            We retain information for as long as reasonably necessary to provide the service, maintain security, resolve disputes, keep financial and transaction records, and meet legal obligations. You may request deletion of your Jalwa account and associated personal information through the available account support or deletion process. Some information may need to be retained where required by law or for legitimate security and financial records.
          </Section>
          <Section title="12. Your Rights & Choices">
            Depending on your location and applicable law, you may have rights to access, correct, delete, or otherwise control certain personal information. You can manage profile information, microphone permissions, notification permissions, and other available privacy controls through Jalwa or your device settings.
          </Section>
          <Section title="13. Children's Privacy">
            Jalwa is not intended for users under 18. We do not knowingly collect personal information from children or minors in violation of applicable law.
          </Section>
          <Section title="14. Changes to This Policy">
            We may update this Privacy Policy when our services, technology, legal requirements, or data practices change. The updated version will be published on this page with a revised update date.
          </Section>
          <Section title="15. Contact Us">
            For privacy questions, account-data requests, or account deletion requests, please contact Jalwa at admin@jalwa.pro, admin@jalwa.app, or smartsoloutionservicess@gmail.com.
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
