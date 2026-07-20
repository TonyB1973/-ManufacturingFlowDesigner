import type { WorldPoint } from '../models/connections/ProcessConnection';
import type { WorldBounds } from './ConnectionAnchors';

export interface OrthogonalRouteRequest {
  readonly source: WorldPoint; readonly sourceDirection: WorldPoint; readonly target: WorldPoint; readonly targetDirection: WorldPoint;
  readonly obstacles: readonly WorldBounds[]; readonly clearance?: number;
}
export interface OrthogonalRouteResult { readonly points: WorldPoint[]; readonly fallback: boolean; readonly length: number; readonly bends: number; }

export function routeOrthogonal(request: OrthogonalRouteRequest): OrthogonalRouteResult {
  const clearance = request.clearance ?? 16;
  const sourceExit = move(request.source, request.sourceDirection, clearance); const targetExit = move(request.target, request.targetDirection, clearance);
  const candidates: WorldPoint[][] = [];
  const deltaX = request.target.x - request.source.x; const deltaY = request.target.y - request.source.y;
  if (same(request.source.y, request.target.y) && ((deltaX > 0 && request.sourceDirection.x > 0 && request.targetDirection.x < 0) || (deltaX < 0 && request.sourceDirection.x < 0 && request.targetDirection.x > 0))) candidates.push([request.source, request.target]);
  if (same(request.source.x, request.target.x) && ((deltaY > 0 && request.sourceDirection.y > 0 && request.targetDirection.y < 0) || (deltaY < 0 && request.sourceDirection.y < 0 && request.targetDirection.y > 0))) candidates.push([request.source, request.target]);
  candidates.push(
    [request.source, sourceExit, { x: targetExit.x, y: sourceExit.y }, targetExit, request.target],
    [request.source, sourceExit, { x: sourceExit.x, y: targetExit.y }, targetExit, request.target],
  );
  const midpointX = (sourceExit.x + targetExit.x) / 2; const midpointY = (sourceExit.y + targetExit.y) / 2;
  candidates.push(
    [request.source, sourceExit, { x: midpointX, y: sourceExit.y }, { x: midpointX, y: targetExit.y }, targetExit, request.target],
    [request.source, sourceExit, { x: sourceExit.x, y: midpointY }, { x: targetExit.x, y: midpointY }, targetExit, request.target],
  );
  const inflated = request.obstacles.map((bounds) => inflate(bounds, clearance));
  const corridorYs = inflated.flatMap((bounds) => [bounds.top - clearance, bounds.bottom + clearance]);
  const corridorXs = inflated.flatMap((bounds) => [bounds.left - clearance, bounds.right + clearance]);
  corridorYs.forEach((y) => candidates.push([request.source, sourceExit, { x: sourceExit.x, y }, { x: targetExit.x, y }, targetExit, request.target]));
  corridorXs.forEach((x) => candidates.push([request.source, sourceExit, { x, y: sourceExit.y }, { x, y: targetExit.y }, targetExit, request.target]));
  const valid = candidates.map(simplifyRoute).filter((points) => isOrthogonal(points) && !routeIntersects(points, inflated));
  const chosen = valid.sort((left, right) => routeCost(left) - routeCost(right))[0];
  if (chosen) return metrics(chosen, false);
  const fallback = simplifyRoute([request.source, sourceExit, { x: sourceExit.x, y: targetExit.y }, targetExit, request.target]);
  return metrics(fallback, true);
}

export function simplifyRoute(points: readonly WorldPoint[]): WorldPoint[] {
  const unique = points.filter((point, index) => index === 0 || !samePoint(point, points[index - 1]));
  return unique.filter((point, index) => {
    if (index === 0 || index === unique.length - 1) return true;
    const before = unique[index - 1]; const after = unique[index + 1];
    return !((same(before.x, point.x) && same(point.x, after.x)) || (same(before.y, point.y) && same(point.y, after.y)));
  });
}
export function routeLength(points: readonly WorldPoint[]): number { return points.slice(1).reduce((total, point, index) => total + Math.abs(point.x - points[index].x) + Math.abs(point.y - points[index].y), 0); }
export function routeBendCount(points: readonly WorldPoint[]): number { return Math.max(0, points.length - 2); }
export function isOrthogonal(points: readonly WorldPoint[]): boolean { return points.length >= 2 && points.slice(1).every((point, index) => same(point.x, points[index].x) || same(point.y, points[index].y)); }

function metrics(points: WorldPoint[], fallback: boolean): OrthogonalRouteResult { return { points, fallback, length: routeLength(points), bends: routeBendCount(points) }; }
function move(point: WorldPoint, direction: WorldPoint, distance: number): WorldPoint { return { x: point.x + direction.x * distance, y: point.y + direction.y * distance }; }
function inflate(bounds: WorldBounds, amount: number): WorldBounds { return { left: bounds.left - amount, top: bounds.top - amount, right: bounds.right + amount, bottom: bounds.bottom + amount }; }
function same(left: number, right: number): boolean { return Math.abs(left - right) < 1e-7; }
function samePoint(left: WorldPoint, right: WorldPoint): boolean { return same(left.x, right.x) && same(left.y, right.y); }
function routeCost(points: readonly WorldPoint[]): number { return routeLength(points) + routeBendCount(points) * 24; }
function routeIntersects(points: readonly WorldPoint[], obstacles: readonly WorldBounds[]): boolean {
  return points.slice(1).some((point, index) => obstacles.some((bounds) => segmentIntersectsInterior(points[index], point, bounds)));
}
function segmentIntersectsInterior(start: WorldPoint, end: WorldPoint, bounds: WorldBounds): boolean {
  if (same(start.x, end.x)) return start.x > bounds.left && start.x < bounds.right && Math.max(start.y, end.y) > bounds.top && Math.min(start.y, end.y) < bounds.bottom;
  if (same(start.y, end.y)) return start.y > bounds.top && start.y < bounds.bottom && Math.max(start.x, end.x) > bounds.left && Math.min(start.x, end.x) < bounds.right;
  return true;
}
