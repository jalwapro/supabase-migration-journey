import { BuiltinProfileCardBg, hasBuiltinProfileCard } from "@/lib/profileCards/builtin";
import type { ProfileCard } from "@/lib/profileCards/registry";
import { resolveAssetUrl } from "@/lib/assetUrl";

type Props = {
  card: Pick<ProfileCard, "bg_media_url" | "bg_media_type" | "bg_chromakey" | "frame_media_url" | "frame_media_type" | "frame_chromakey" | "frame_effect" | "accent_color" | "glow_color">;
  rounded?: string;
  className?: string;
  children?: React.ReactNode;
};

export function PremiumProfileCard({ card, rounded = "rounded-[28px]", className = "", children }: Props) {
  const url = resolveAssetUrl(card.bg_media_url) ?? "";
  const isBuiltin = hasBuiltinProfileCard(card.bg_media_url);
  const isVideo = card.bg_media_type === "mp4" || card.bg_media_type === "webm";
  const isImage = card.bg_media_type === "image";
  const chromaFilter = card.bg_chromakey === "green" ? "url(#pc-chroma-green)" : card.bg_chromakey === "luma" ? "url(#pc-chroma-luma)" : card.bg_chromakey === "black" ? "url(#pc-chroma-black)" : undefined;

  return (
    <div className={`relative isolate overflow-hidden ${rounded} ${className}`}>
      {chromaFilter && <svg className="absolute h-0 w-0" aria-hidden><defs>
        <filter id="pc-chroma-green" colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values={"1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 -1 1.2 -1 0 0"} /><feComposite in="SourceGraphic" in2="chroma" operator="out" /></filter>
        <filter id="pc-chroma-black" colorInterpolationFilters="sRGB"><feColorMatrix type="luminanceToAlpha" /></filter>
        <filter id="pc-chroma-luma" colorInterpolationFilters="sRGB"><feColorMatrix type="luminanceToAlpha" /></filter>
      </defs></svg>}
      <div className="absolute inset-0 -z-10">
        {isBuiltin ? <BuiltinProfileCardBg mediaUrl={card.bg_media_url} /> : isVideo ? <video src={url} autoPlay muted loop playsInline className="h-full w-full object-cover" style={chromaFilter ? { filter: chromaFilter } : undefined} /> : isImage ? <img src={url} alt="" className="h-full w-full object-cover" style={chromaFilter ? { filter: chromaFilter } : undefined} /> : <div className="absolute inset-0 bg-gradient-to-br from-[#1a0b2e] via-[#0f0620] to-black" />}
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{ background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%)" }} />
      <ProfileCardFrame card={card} />
      {children && <div className="relative">{children}</div>}
    </div>
  );
}

export function ProfileCardFrame({ card }: { card: Pick<ProfileCard, "frame_media_url" | "frame_media_type" | "frame_chromakey" | "frame_effect" | "accent_color" | "glow_color"> }) {
  const frameUrl = resolveAssetUrl(card.frame_media_url) ?? "";
  if (frameUrl && card.frame_media_type !== "none") {
    const isVideo = card.frame_media_type === "mp4" || card.frame_media_type === "webm";
    const filter = card.frame_chromakey === "green" ? "saturate(1.1)" : undefined;
    return (
      <div aria-hidden className="pointer-events-none absolute -inset-[10px] z-30 overflow-visible rounded-[inherit]">
        {isVideo ? <video src={frameUrl} autoPlay muted loop playsInline className="h-full w-full object-fill" style={{ filter }} /> : <img src={frameUrl} alt="" className="h-full w-full object-fill" style={{ filter }} />}
      </div>
    );
  }
  return <FrameOrnament effect={card.frame_effect} accent={card.accent_color} glow={card.glow_color} />;
}

function FrameOrnament({ effect, accent, glow }: { effect: ProfileCard["frame_effect"]; accent: string; glow: string }) {
  if (effect === "none") return null;
  if (effect === "gold") return <><div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit]" style={{ boxShadow: `inset 0 0 0 1px ${accent}66, inset 0 0 30px -6px ${accent}80, 0 22px 60px -20px ${glow}80` }} /><CornerJewels color={accent} /><div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-60 [background:linear-gradient(120deg,transparent_35%,rgba(255,255,255,0.28)_50%,transparent_65%)] animate-[shimmer_6s_linear_infinite] [background-size:200%_100%]" /></>;
  if (effect === "neon") return <><div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit]" style={{ boxShadow: `inset 0 0 0 1px ${accent}, inset 0 0 24px ${accent}66, 0 0 40px -8px ${glow}` }} /><div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] animate-pulse" style={{ boxShadow: `inset 0 0 0 2px ${accent}40` }} /></>;
  if (effect === "diamond") return <><div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit]" style={{ boxShadow: `inset 0 0 0 1px ${accent}, inset 0 0 40px -6px ${accent}55` }} /><svg className="pointer-events-none absolute inset-x-4 top-2 h-3 opacity-90" viewBox="0 0 400 12">{[...Array(10)].map((_, i) => <polygon key={i} points={`${i * 40 + 20},2 ${i * 40 + 26},6 ${i * 40 + 20},10 ${i * 40 + 14},6`} fill={accent} />)}</svg></>;
  if (effect === "aurora") return <><div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-70" style={{ background: `conic-gradient(from 0deg, ${accent}66, ${glow}66, ${accent}66)`, filter: "blur(20px)" }} /><div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit]" style={{ boxShadow: `inset 0 0 0 1px ${accent}66` }} /></>;
  return null;
}
function CornerJewels({ color }: { color: string }) {
  const jewel = "absolute h-3 w-3 rotate-45 shadow-[0_0_8px_rgba(0,0,0,0.6)]";
  return <><span className={`${jewel} left-3 top-3`} style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }} /><span className={`${jewel} right-3 top-3`} style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }} /><span className={`${jewel} left-3 bottom-3`} style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }} /><span className={`${jewel} right-3 bottom-3`} style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }} /></>;
}
