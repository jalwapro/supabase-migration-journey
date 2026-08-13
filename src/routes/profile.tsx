import { createFileRoute, Navigate, useSearch } from '@tanstack/react-router';

export const Route = createFileRoute('/profile')({
  component: ProfileRouteAlias,
});

function ProfileRouteAlias() {
  // Preserve Studio preview flags across this alias redirect. Without this,
  // /profile?adminPreview=1&previewIdentity=neutral became /me and the
  // preview iframe lost its isolated identity, allowing the authenticated
  // admin profile to appear in the Studio.
  const search = useSearch({ from: '/profile' });
  return <Navigate to="/me" search={search} replace />;
}
