import { LudoSheet } from "@/components/room/LudoSheet";
import { CrashXGame } from "@/components/room/casino/CrashXGame";
import { DragonTigerGame } from "@/components/room/casino/DragonTigerGame";
import { InOutGame } from "@/components/room/casino/InOutGame";
import { PlinkoGame } from "@/components/room/casino/PlinkoGame";
import { Slots777Game } from "@/components/room/casino/Slots777Game";
import { UnderOver7 } from "@/components/room/casino/games/UnderOver7";
import { CrashPoint } from "@/components/room/casino/games/CrashPoint";
import { ScratchCard } from "@/components/room/casino/games/ScratchCard";
import { AppleOfFortune } from "@/components/room/casino/games/AppleOfFortune";
import { SpinWin } from "@/components/room/casino/games/SpinWin";
import { VampireCurse } from "@/components/room/casino/games/VampireCurse";

/**
 * Mounts the app's real native games from the Games sheet.
 * The sheet used to close on native games and call an optional callback that
 * the room route no longer supplied, leaving the user with no popup at all.
 * Keep the games mounted here so the Games sheet is self-contained.
 */
export function NativeGamePopup({ slug, onClose }: { slug: string; onClose: () => void }) {
  // Voice-room URLs are /room/<roomId>. Native game components accept an
  // optional roomId, so this keeps the integration working without another
  // prop chain through VoiceRoomScreen.
  const parts = window.location.pathname.split("/").filter(Boolean);
  const roomIndex = parts.indexOf("room");
  const roomId = roomIndex >= 0 ? parts[roomIndex + 1] : undefined;

  switch (slug) {
    case "ludo":
      return <LudoSheet open onClose={onClose} players={[]} roomId={roomId} />;
    case "slots777":
      return roomId ? <Slots777Game open onClose={onClose} roomId={roomId} /> : null;
    case "crash_x":
      return <CrashXGame open onClose={onClose} roomId={roomId} />;
    case "dragon_tiger":
      return <DragonTigerGame open onClose={onClose} roomId={roomId} />;
    case "in_out":
      return <InOutGame open onClose={onClose} roomId={roomId} />;
    case "plinko":
      return <PlinkoGame open onClose={onClose} roomId={roomId} />;
    case "under_over_7":
      return <UnderOver7 open onClose={onClose} roomId={roomId} />;
    case "crash_point":
      return <CrashPoint open onClose={onClose} roomId={roomId} />;
    case "scratch_card":
      return <ScratchCard open onClose={onClose} roomId={roomId} />;
    case "apple_fortune":
      return <AppleOfFortune open onClose={onClose} roomId={roomId} />;
    case "spin_win":
      return <SpinWin open onClose={onClose} roomId={roomId} />;
    case "vampire_curse":
      return <VampireCurse open onClose={onClose} roomId={roomId} />;
    default:
      return null;
  }
}
