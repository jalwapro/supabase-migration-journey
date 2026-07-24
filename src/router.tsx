import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { GC, STALE, smartRetry } from "./lib/queryPresets";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Prevent refetch storms on every route change / tab focus.
        // Realtime subscriptions already invalidate what needs invalidating.
        staleTime: STALE.REALTIME,
        gcTime: GC.DEFAULT,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: smartRetry,
      },
      mutations: {
        retry: smartRetry,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};

