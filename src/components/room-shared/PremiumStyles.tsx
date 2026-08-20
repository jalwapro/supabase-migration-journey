import type { ComponentPropsWithoutRef, PropsWithChildren } from "react";
import { cn } from "@/lib/utils";

type GlassPanelProps = PropsWithChildren<ComponentPropsWithoutRef<"div">>;
type NeonBorderProps = PropsWithChildren<ComponentPropsWithoutRef<"div">> & {
  color?: "primary" | "secondary";
};

/** Shared premium glass surface for room UI panels. */
export function GlassPanel({
  children,
  className,
  ...props
}: GlassPanelProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-white/[0.04] shadow-lg shadow-black/20 backdrop-blur-xl",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** Lightweight CSS-only neon frame so room UI has no animation dependency. */
export function NeonBorder({
  children,
  color = "primary",
  className,
  ...props
}: NeonBorderProps) {
  const glow =
    color === "secondary"
      ? "border-purple-400/70 shadow-[0_0_18px_rgba(168,85,247,0.35)]"
      : "border-fuchsia-400/70 shadow-[0_0_18px_rgba(217,70,239,0.35)]";

  return (
    <div
      className={cn("rounded-full border bg-black/20", glow, className)}
      {...props}
    >
      {children}
    </div>
  );
}

export default GlassPanel;
