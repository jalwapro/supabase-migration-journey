import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Compact number format: 999, 1k, 10k, 1.1m, 2.5b
 * - < 1,000        → as-is
 * - 1k .. 999k     → 1 decimal when < 10, else integer
 * - 1m .. 999m     → same
 * - 1b+            → same
 */
export function formatCompact(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  if (!isFinite(v)) return "0";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  const fmt = (x: number, div: number, suf: string) => {
    const q = x / div;
    const s = q < 10 ? q.toFixed(1).replace(/\.0$/, "") : Math.floor(q).toString();
    return sign + s + suf;
  };
  if (abs < 1_000) return sign + Math.floor(abs).toString();
  if (abs < 1_000_000) return fmt(abs, 1_000, "k");
  if (abs < 1_000_000_000) return fmt(abs, 1_000_000, "m");
  return fmt(abs, 1_000_000_000, "b");
}
