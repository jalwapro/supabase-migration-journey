import { useVoiceRoomSession } from '@/context/VoiceRoomSessionContext';
import { useNavigate } from '@tanstack/react-router';

export function GlobalMinimizedVoiceRoom() {
  const { activeRoom, restoreRoom } = useVoiceRoomSession();
  const navigate = useNavigate();

  if (!activeRoom?.isMinimized) return null;

  const returnToRoom = () => {
    restoreRoom();
    navigate({ to: activeRoom.roomRoute });
  };

  return (
    <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+76px)] z-[80] mx-auto max-w-md">
      <button
        type="button"
        onClick={returnToRoom}
        aria-label="Return to active Voice Room"
        className="flex w-full items-center gap-3 rounded-2xl border border-white/15 bg-black/80 p-3 text-left shadow-2xl backdrop-blur-xl"
      >
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white/10">
          {activeRoom.roomAvatar ? <img src={activeRoom.roomAvatar} alt="" className="h-full w-full object-cover" /> : null}
          <span className="absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-black/70" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-white">{activeRoom.roomName || 'Voice Room'}</div>
          <div className="text-xs text-white/65">● Voice Room active</div>
        </div>
        <span className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-black">Return</span>
      </button>
    </div>
  );
}
