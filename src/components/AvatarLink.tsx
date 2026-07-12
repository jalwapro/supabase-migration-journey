import { Link } from "@tanstack/react-router";
import type { ReactNode, CSSProperties } from "react";

/**
 * Wraps any avatar UI so tapping it opens `/u/$userId`.
 * Use around an existing avatar container (img, div, initials) — keeps layout intact.
 */
export function AvatarLink({
  userId,
  children,
  className = "",
  style,
  stop = true,
}: {
  userId?: string | null;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** stopPropagation on click (useful inside cards that also navigate) */
  stop?: boolean;
}) {
  if (!userId) return <>{children}</>;
  return (
    <Link
      to="/u/$userId"
      params={{ userId }}
      className={`block cursor-pointer ${className}`}
      style={style}
      onClick={(e) => {
        if (stop) e.stopPropagation();
      }}
      aria-label="Open profile"
    >
      {children}
    </Link>
  );
}
