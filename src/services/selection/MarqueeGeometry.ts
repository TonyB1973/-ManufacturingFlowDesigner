import type { WorldPoint } from '../../models/connections/ProcessConnection';

export interface WorldRectangle { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number; }
export const normalizeRectangle = (a: WorldPoint, b: WorldPoint): WorldRectangle => ({ minX: Math.min(a.x, b.x), minY: Math.min(a.y, b.y), maxX: Math.max(a.x, b.x), maxY: Math.max(a.y, b.y) });
export const rectanglesIntersect = (left: WorldRectangle, right: WorldRectangle): boolean => left.minX <= right.maxX && left.maxX >= right.minX && left.minY <= right.maxY && left.maxY >= right.minY;
const pointInside = (point: WorldPoint, rectangle: WorldRectangle): boolean => point.x >= rectangle.minX && point.x <= rectangle.maxX && point.y >= rectangle.minY && point.y <= rectangle.maxY;
const orientation = (a: WorldPoint, b: WorldPoint, c: WorldPoint): number => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
const segmentsIntersect = (a: WorldPoint, b: WorldPoint, c: WorldPoint, d: WorldPoint): boolean => orientation(a, b, c) * orientation(a, b, d) <= 0 && orientation(c, d, a) * orientation(c, d, b) <= 0;
export const polylineIntersectsRectangle = (points: readonly WorldPoint[], rectangle: WorldRectangle): boolean => {
  if (points.some((point) => pointInside(point, rectangle))) return true;
  const corners = [{ x: rectangle.minX, y: rectangle.minY }, { x: rectangle.maxX, y: rectangle.minY }, { x: rectangle.maxX, y: rectangle.maxY }, { x: rectangle.minX, y: rectangle.maxY }];
  for (let index = 1; index < points.length; index += 1) for (let edge = 0; edge < 4; edge += 1) if (segmentsIntersect(points[index - 1], points[index], corners[edge], corners[(edge + 1) % 4])) return true;
  return false;
};
