import type { OperationAnchor, WorldPoint } from '../models/connections/ProcessConnection';

export interface WorldBounds { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number; }
export interface OperationGeometry { readonly worldX: number; readonly worldY: number; readonly width: number; readonly height: number; }

export function operationBounds(operation: OperationGeometry): WorldBounds {
  return { left: operation.worldX - operation.width / 2, top: operation.worldY - operation.height / 2, right: operation.worldX + operation.width / 2, bottom: operation.worldY + operation.height / 2 };
}

export function anchorWorldPosition(operation: OperationGeometry, anchor: OperationAnchor): WorldPoint {
  const bounds = operationBounds(operation); const offset = clampOffset(anchor.offset);
  if (anchor.side === 'top') return { x: bounds.left + operation.width * offset, y: bounds.top };
  if (anchor.side === 'bottom') return { x: bounds.left + operation.width * offset, y: bounds.bottom };
  if (anchor.side === 'left') return { x: bounds.left, y: bounds.top + operation.height * offset };
  return { x: bounds.right, y: bounds.top + operation.height * offset };
}

export function nearestOperationAnchor(operation: OperationGeometry, point: WorldPoint, minimumInsetWorld = 18): OperationAnchor {
  const bounds = operationBounds(operation);
  const distances = [
    { side: 'top' as const, distance: Math.abs(point.y - bounds.top) },
    { side: 'right' as const, distance: Math.abs(point.x - bounds.right) },
    { side: 'bottom' as const, distance: Math.abs(point.y - bounds.bottom) },
    { side: 'left' as const, distance: Math.abs(point.x - bounds.left) },
  ].sort((left, right) => left.distance - right.distance);
  const side = distances[0].side;
  const horizontal = side === 'top' || side === 'bottom'; const span = horizontal ? operation.width : operation.height;
  const origin = horizontal ? bounds.left : bounds.top; const coordinate = horizontal ? point.x : point.y;
  const inset = Math.min(0.4, Math.max(0, minimumInsetWorld / Math.max(span, 1)));
  return { side, offset: Math.min(1 - inset, Math.max(inset, (coordinate - origin) / span)) };
}

export function isValidAnchor(anchor: OperationAnchor): boolean {
  return ['top', 'right', 'bottom', 'left'].includes(anchor.side) && Number.isFinite(anchor.offset) && anchor.offset >= 0 && anchor.offset <= 1;
}

export function anchorDirection(anchor: OperationAnchor): WorldPoint {
  if (anchor.side === 'top') return { x: 0, y: -1 }; if (anchor.side === 'bottom') return { x: 0, y: 1 };
  if (anchor.side === 'left') return { x: -1, y: 0 }; return { x: 1, y: 0 };
}

function clampOffset(value: number): number { return Math.min(1, Math.max(0, value)); }
