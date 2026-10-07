import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/pk")({
  component: () => <Navigate to="/admin" replace />,
});
