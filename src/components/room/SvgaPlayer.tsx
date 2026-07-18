import { useEffect, useRef } from 'react';

type Props = {
  src: string;
  loops?: number; // 0 = infinite
  clearsAfterStop?: boolean;
  className?: string;
  style?: React.CSSProperties;
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    let player: any = null;

    (async () => {
      const mod: any = await import('svgaplayerweb');
      const SVGA = mod.default ?? mod;
      if (cancelled || !canvasRef.current) return;

      const parser = new SVGA.Parser();
      player = new SVGA.Player(canvasRef.current);
      player.loops = loops;
      player.clearsAfterStop = clearsAfterStop;
      if (onFinished) player.onFinished(onFinished);
      playerRef.current = player;

      parser.load(src, (videoItem: any) => {
        if (cancelled) return;
        player.setVideoItem(videoItem);
        player.startAnimation();
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

  return <canvas ref={canvasRef} className={className} style={style} />;
}
