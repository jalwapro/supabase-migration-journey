import { useEffect, useRef } from "react";
import type { RemoteVideoTrack } from "@/hooks/useZegoRoom";

export interface LiveVideoTileProps {
  componentId: string;
  instance: number;
  videoTrack?: RemoteVideoTrack | null;
  local?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Real ZEGO video surface used by live rooms.
 * The Studio marker is attached to the actual playback container, so visual
 * customization never replaces the underlying audio/video functionality.
 */
export function LiveVideoTile({
  componentId,
  instance,
  videoTrack,
  local = false,
  className,
  children,
}: LiveVideoTileProps) {
  const videoRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!videoTrack || !videoRef.current) return;
    videoTrack.play(videoRef.current, { fit: "cover" });
    return () => {
      videoTrack.stop();
    };
  }, [videoTrack]);

  return (
    <div
      ref={videoRef}
      className={className}
      data-live-component={componentId}
      data-live-component-instance={String(instance)}
      data-live-video="true"
      data-live-video-local={local ? "true" : "false"}
    >
      {children}
    </div>
  );
}
