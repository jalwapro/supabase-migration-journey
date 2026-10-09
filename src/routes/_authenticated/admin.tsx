import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AdminShell } from "@/components/admin/AdminShell";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { canAccessAdminPath } from "@/lib/admin-permissions";

export const Route = createFileRoute("/_authenticated/admin")({ component: AdminLayout });

function AdminLayout() {
  const { canAccessAdmin, adminPermissions, loading } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const routeAllowed = canAccessAdminPath(pathname, adminPermissions);

  useEffect(() => {
    if (loading) return;
    if (!canAccessAdmin) {
      toast.error("You do not have admin-console access");
      navigate({ to: "/" });
      return;
    }
    if (!routeAllowed) {
      toast.error("Your role does not have permission for this section");
      navigate({ to: "/admin" });
    }
  }, [loading, canAccessAdmin, routeAllowed, navigate]);

  if (loading || !canAccessAdmin || !routeAllowed) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return <AdminShell><Outlet /></AdminShell>;
}
