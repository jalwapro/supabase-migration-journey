import type { PropsWithChildren } from "react";
import { cn } from "@/lib/utils";

type RoomAdaptiveContainerProps = PropsWithChildren<{
  className?: string;
}>;

/**
 * Shared mobile-first shell used by room screens.
 * It keeps the room constrained to a phone viewport on desktop while
 * allowing the same screen to fill the native mobile viewport.
 */
export function RoomAdaptiveContainer({
  children,
  className,
}: RoomAdaptiveContainerProps) {
  return (
    <main
      className={cn(
        "relative mx-auto flex h-[100dvh] w-full max-w-[480px] flex-col overflow-hidden bg-[#08080f] text-white shadow-2xl",
        "md:max-h-[100dvh]",
        className,
      )}
    >
      {children}
    </main>
  );
}

export default RoomAdaptiveContainer;
