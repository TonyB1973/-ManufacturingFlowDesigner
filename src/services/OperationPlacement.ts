import type { Point } from '../components/workspace/canvas/ViewportTransform';

export function operationPositionFromPointer(pointer: Point, offset: Point): Point {
  return { x: pointer.x - offset.x, y: pointer.y - offset.y };
}
