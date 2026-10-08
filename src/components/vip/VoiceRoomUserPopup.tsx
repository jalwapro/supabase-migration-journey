import { Gift, UserPlus, User, MicOff, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { UserProfileCard, type ProfileCardUser } from "./UserProfileCard";
import { FramedMedia } from "./FramedMedia";
import { useVipFrameAssets } from "@/hooks/useVipFrameAssets";

/** Seat-click popup wrapped in the user's tier-specific popup frame. */
export function VoiceRoomUserPopup({
  user, open, onClose, isAdmin, onViewProfile, onGift, onFollow, onMute,
}: {
  user: ProfileCardUser | null;
  open: boolean;
  onClose: () => void;
  isAdmin?: boolean;
  onViewProfile?: () => void;
  onGift?: () => void;
  onFollow?: () => void;
  onMute?: () => void;
}) {
  const { assets } = useVipFrameAssets(user?.id, user?.vipLevel);
  if (!user) return null;
  const actions = [
    { label: "Profile", icon: User, fn: onViewProfile },
    { label: "Gift", icon: Gift, fn: onGift },
    { label: "Follow", icon: UserPlus, fn: onFollow },
    ...(isAdmin ? [{ label: "Mute", icon: MicOff, fn: onMute }] : []),
  ];
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm border-0 bg-transparent p-6 shadow-none [&>button]:hidden">
        <DialogTitle className="sr-only">{user.name ?? "User"}</DialogTitle>
        <div className="relative">
          {assets.popupFrameUrl && (
            <div className="pointer-events-none absolute -inset-5 z-10"><FramedMedia url={assets.popupFrameUrl} fit="fill" removeBlackBackground /></div>
          )}
          <UserProfileCard user={user} assetsOverride={assets}>
            <div className="mt-4 grid w-full grid-cols-4 gap-2">
              {actions.map(({ label, icon: Icon, fn }) => (
                <button key={label} onClick={fn} className="flex flex-col items-center gap-1 rounded-xl bg-muted/60 py-2 text-[10px] font-bold transition-all duration-300 hover:bg-muted">
                  <Icon className="h-4 w-4" style={{ color: assets.color }} />{label}
                </button>
              ))}
            </div>
          </UserProfileCard>
          <button onClick={onClose} aria-label="Close" className="absolute -right-2 -top-2 z-20 rounded-full bg-background p-1.5"><X className="h-4 w-4" /></button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
