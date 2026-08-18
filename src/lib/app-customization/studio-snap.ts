export interface SnapRect { left: number; top: number; width: number; height: number }
export interface SnapOptions {
  grid?: number;
  threshold?: number;
  viewport?: { width: number; height: number };
  snapToViewport?: boolean;
  snapToCenter?: boolean;
}
export interface SnapResult { x: number; y: number; snappedX: boolean; snappedY: boolean; guides: Array<"left" | "center-x" | "right" | "top" | "center-y" | "bottom"> }

const roundToGrid = (value: number, grid: number) => grid > 0 ? Math.round(value / grid) * grid : value;

export function snapPosition(rect: SnapRect, x: number, y: number, options: SnapOptions = {}): SnapResult {
  const grid = options.grid ?? 8;
  const threshold = options.threshold ?? 6;
  const guides: SnapResult["guides"] = [];
  let nextX = roundToGrid(x, grid);
  let nextY = roundToGrid(y, grid);
  let snappedX = Math.abs(nextX - x) <= threshold;
  let snappedY = Math.abs(nextY - y) <= threshold;

  if (!snappedX) nextX = x;
  if (!snappedY) nextY = y;

  const viewport = options.viewport;
  if (viewport && options.snapToViewport !== false) {
    const candidatesX = [0, (viewport.width - rect.width) / 2, viewport.width - rect.width];
    const candidatesY = [0, (viewport.height - rect.height) / 2, viewport.height - rect.height];
    const closestX = candidatesX.reduce((best, candidate) => Math.abs(candidate - x) < Math.abs(best - x) ? candidate : best, candidatesX[0]);
    const closestY = candidatesY.reduce((best, candidate) => Math.abs(candidate - y) < Math.abs(best - y) ? candidate : best, candidatesY[0]);
    if (Math.abs(closestX - x) <= threshold) { nextX = closestX; snappedX = true; guides.push(closestX === 0 ? "left" : closestX === candidatesX[1] ? "center-x" : "right"); }
    if (Math.abs(closestY - y) <= threshold) { nextY = closestY; snappedY = true; guides.push(closestY === 0 ? "top" : closestY === candidatesY[1] ? "center-y" : "bottom"); }
  }

  return { x: Math.round(nextX), y: Math.round(nextY), snappedX, snappedY, guides };
}

export function snapSize(width: number, height: number, options: { grid?: number; minWidth?: number; minHeight?: number; maxWidth?: number; maxHeight?: number } = {}) {
  const grid = options.grid ?? 8;
  const minWidth = options.minWidth ?? 24;
  const minHeight = options.minHeight ?? 24;
  const maxWidth = options.maxWidth ?? Number.POSITIVE_INFINITY;
  const maxHeight = options.maxHeight ?? Number.POSITIVE_INFINITY;
  return {
    width: Math.min(maxWidth, Math.max(minWidth, roundToGrid(width, grid))),
    height: Math.min(maxHeight, Math.max(minHeight, roundToGrid(height, grid))),
  };
}
