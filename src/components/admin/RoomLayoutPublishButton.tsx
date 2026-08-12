import { useState } from 'react';
import { CheckCircle2, Loader2, Rocket } from 'lucide-react';
import { publishRoomLayout } from '@/lib/room-layout-publishing';
import type { LayoutJSON, RoomType } from '@/lib/room-layouts';

type Props = {
  layoutId: string;
  roomType: RoomType;
  layout: LayoutJSON;
  onPublished?: () => void;
};

export function RoomLayoutPublishButton({ layoutId, roomType, layout, onPublished }: Props) {
  const [pending, setPending] = useState(false);
  const [published, setPublished] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publish = async () => {
    if (pending) return;
    setPending(true);
    setPublished(false);
    setError(null);
    try {
      await publishRoomLayout(layoutId, layout, roomType);
      setPublished(true);
      onPublished?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to publish layout');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={publish} disabled={pending} className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50">
        {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : published ? <CheckCircle2 className="h-5 w-5" /> : <Rocket className="h-5 w-5" />}
        {pending ? 'Publishing...' : published ? 'Published' : 'Publish Live'}
      </button>
      {error && <span className="max-w-xs text-right text-xs text-red-400">{error}</span>}
    </div>
  );
}
