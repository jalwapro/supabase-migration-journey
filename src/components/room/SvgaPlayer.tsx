import { useEffect, useRef, useState, type CSSProperties } from 'react';

type Props = {
  src: string;
  loops?: number; // 0 = infinite
  clearsAfterStop?: boolean;
  className?: string;
  style?: CSSProperties;
  onFinished?: () => void;
};

/**
 * SVGA Player — renders a .svga animation on a canvas.
 * SVGA is a lightweight animation format used by TikTok/Bigo/Poppo live apps.
 * Supports transparency natively (no chroma-key hack needed).
 */
export default function SvgaPlayer({
  src,
  loops = 0,
  clearsAfterStop = false,
  className,
  style,
  onFinished,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let player: any = null;
    setFailed(false);

    (async () => {
      const [{ default: JSZip }, JSZipUtilsModule, mod]: any[] = await Promise.all([
        import('jszip'),
        import('jszip-utils'),
        import('svgaplayerweb'),
      ]);
      window.JSZip = JSZip;
      window.JSZipUtils = JSZipUtilsModule.default ?? JSZipUtilsModule;

      const SVGA = mod.default ?? mod;
      if (cancelled || !containerRef.current) return;

      const parser = new SVGA.Parser();
      player = new SVGA.Player(containerRef.current);
      player.loops = loops;
      player.clearsAfterStop = clearsAfterStop;
      player.setContentMode?.('AspectFit');
      if (onFinished) player.onFinished(onFinished);
      playerRef.current = player;

      parser.load(src, (videoItem: any) => {
        if (cancelled) return;
        player.setVideoItem(videoItem);
        player.startAnimation();
      }, (error: Error) => {
        if (cancelled) return;
        console.error('SVGA load failed:', src, error);
        setFailed(true);
      });
    })();

    return () => {
      cancelled = true;
      try {
        playerRef.current?.stopAnimation?.(true);
        playerRef.current?.clear?.();
      } catch {}
      playerRef.current = null;
    };
  }, [src, loops, clearsAfterStop, onFinished]);

  return (
    <div ref={containerRef} className={className} style={{ position: 'relative', ...style }}>
      {failed && (
        <div className="absolute inset-0 grid place-items-center text-[10px] font-semibold text-white/55">
          SVGA
        </div>
      )}
    </div>
  );
}

declare global {
  interface Window {
    JSZip?: unknown;
    JSZipUtils?: unknown;
  }
}
