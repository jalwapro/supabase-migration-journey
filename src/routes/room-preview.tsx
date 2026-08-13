import { createFileRoute, Navigate, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const Route = createFileRoute('/room-preview')({ component: RoomPreview });

function RoomPreview() {
  const search = useSearch({ from: '/room-preview' }) as { mode?: string };
  const { data: roomId, isLoading } = useQuery({
    queryKey: ['customization-preview-room'],
    queryFn: async () => {
      const { data, error } = await supabase.from('rooms').select('id').limit(1).maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    },
    staleTime: 60_000,
  });

  if (isLoading) return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">Loading real room preview…</div>;
  if (!roomId) return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">No room is available for preview.</div>;
  return <Navigate to="/room/$roomId" params={{ roomId }} search={{ adminPreview: '1', mode: search.mode ?? 'voice' } as never} replace />;
}
