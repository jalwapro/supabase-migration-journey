import { createFileRoute, Navigate } from '@tanstack/react-router';

export const Route = createFileRoute('/profile')({
  component: ProfileRouteAlias,
});

function ProfileRouteAlias() {
  return <Navigate to="/me" replace />;
}
