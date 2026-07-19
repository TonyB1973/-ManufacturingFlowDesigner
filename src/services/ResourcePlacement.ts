import type { Point } from '../components/workspace/canvas/ViewportTransform';

export function positionFromPointer(pointerWorld: Point, pointerOffset: Point): Point {
  return {
    x: pointerWorld.x - pointerOffset.x,
    y: pointerWorld.y - pointerOffset.y,
  };
}
