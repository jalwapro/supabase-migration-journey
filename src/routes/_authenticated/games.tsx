import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/games")({
  component: GamesLayout,
});

function GamesLayout() {
  return <Outlet />;
}
