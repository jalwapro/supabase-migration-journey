export interface Point { x: number; y: number }
export interface Rect { x: number; y: number; width: number; height: number }
export interface SnapResult { x: number; y: number; guides: Array<{ axis: "x" | "y"; value: number }> }

export function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }
export function moveRect(rect: Rect, dx: number, dy: number): Rect { return { ...rect, x: rect.x + dx, y: rect.y + dy }; }
export function resizeRect(rect: Rect, width: number, height: number): Rect { return { ...rect, width: Math.max(1, width), height: Math.max(1, height) }; }

export function snapRect(rect: Rect, canvas: Rect, siblings: Rect[], threshold = 6): SnapResult {
  let x = rect.x, y = rect.y; const guides: SnapResult["guides"] = [];
  const xTargets = [canvas.x, canvas.x + canvas.width / 2, canvas.x + canvas.width, ...siblings.flatMap(r => [r.x, r.x + r.width / 2, r.x + r.width])];
  const yTargets = [canvas.y, canvas.y + canvas.height / 2, canvas.y + canvas.height, ...siblings.flatMap(r => [r.y, r.y + r.height / 2, r.y + r.height])];
  const candidatesX = [rect.x, rect.x + rect.width / 2, rect.x + rect.width];
  const candidatesY = [rect.y, rect.y + rect.height / 2, rect.y + rect.height];
  let bestX = Infinity, bestY = Infinity;
  for (const c of candidatesX) for (const t of xTargets) if (Math.abs(c - t) < bestX && Math.abs(c - t) <= threshold) { bestX = Math.abs(c - t); x += t - c; }
  for (const c of candidatesY) for (const t of yTargets) if (Math.abs(c - t) < bestY && Math.abs(c - t) <= threshold) { bestY = Math.abs(c - t); y += t - c; }
  if (bestX < Infinity) guides.push({ axis: "x", value: x });
  if (bestY < Infinity) guides.push({ axis: "y", value: y });
  return { x, y, guides };
}

export function unionRects(rects: Rect[]): Rect | null {
  if (!rects.length) return null;
  const left = Math.min(...rects.map(r => r.x)), top = Math.min(...rects.map(r => r.y));
  const right = Math.max(...rects.map(r => r.x + r.width)), bottom = Math.max(...rects.map(r => r.y + r.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function resizeGroup(rect: Rect, nextWidth: number, nextHeight: number, children: Rect[]): Rect[] {
  if (!rect.width || !rect.height) return children;
  const sx = nextWidth / rect.width, sy = nextHeight / rect.height;
  return children.map(child => ({ x: rect.x + (child.x - rect.x) * sx, y: rect.y + (child.y - rect.y) * sy, width: child.width * sx, height: child.height * sy }));
}

export function deviceForWidth(width: number): "mobile" | "tablet" | "desktop" { return width < 768 ? "mobile" : width < 1024 ? "tablet" : "desktop"; }
