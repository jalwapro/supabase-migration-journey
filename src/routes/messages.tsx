import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/messages")({
  component: MessagesPage,
});

function MessagesPage() {
  const { user } = useAuth();
  return (
    <>
      <AppShell title="Chats" subtitle="Direct messages">
        <div className="px-4 pt-6">
          <div className="glass rounded-2xl p-8 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[color:var(--primary)]/20">
              <MessageCircle className="h-6 w-6 text-[color:var(--primary)]" />
            </div>
            <h3 className="mt-3 font-bold">DMs coming soon</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              1-on-1 chats and friend requests ship in Phase 6.
            </p>
            {!user && (
              <Link
                to="/auth"
                className="mt-4 inline-flex rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </AppShell>
      <BottomNav />
    </>
  );
}
