import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AdminShell } from "@/components/admin/AdminShell";
import { PaymentAccountsTwoFA } from "@/components/admin/PaymentAccountsTwoFA";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({ component: AdminLayout });

const SENSITIVE_ADMIN_PATHS = [
  "/admin/settings",
  "/admin/factory-reset",
  "/admin/connection",
];

function AdminLayout() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !isAdmin) {
      toast.error("Admins only");
      navigate({ to: "/" });
    }
  }, [loading, isAdmin, navigate]);

  if (loading || !isAdmin) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const path = location.pathname.replace(/\/$/, "");
  const sensitive = SENSITIVE_ADMIN_PATHS.some((item) => path === item || path.startsWith(`${item}/`));

  return (
    <AdminShell>
      {sensitive ? (
        <PaymentAccountsTwoFA onVerified={() => undefined}>
          <Outlet />
        </PaymentAccountsTwoFA>
      ) : (
        <Outlet />
      )}
    </AdminShell>
  );
}
