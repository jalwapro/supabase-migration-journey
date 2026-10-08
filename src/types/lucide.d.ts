declare module "lucide-react/dist/esm/icons/*.js" {
  import type * as React from "react";

  const Icon: React.ComponentType<{
    color?: string;
    size?: string | number;
    strokeWidth?: string | number;
    absoluteStrokeWidth?: boolean;
    className?: string;
    [key: string]: unknown;
  }>;

  export default Icon;
}
