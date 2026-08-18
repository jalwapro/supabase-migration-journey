import { snapPosition, snapSize, type SnapOptions, type SnapRect } from "./studio-snap";

export interface DragSession { startPointerX: number; startPointerY: number; startX: number; startY: number; rect: SnapRect }
export interface ResizeSession { startPointerX: number; startPointerY: number; startWidth: number; startHeight: number }

export function updateDrag(session: DragSession, pointerX: number, pointerY: number, options?: SnapOptions) {
  return snapPosition(session.rect, session.startX + pointerX - session.startPointerX, session.startY + pointerY - session.startPointerY, options);
}

export function updateResize(session: ResizeSession, pointerX: number, pointerY: number, constraints?: { grid?: number; minWidth?: number; minHeight?: number; maxWidth?: number; maxHeight?: number }) {
  return snapSize(session.startWidth + pointerX - session.startPointerX, session.startHeight + pointerY - session.startPointerY, constraints);
}
