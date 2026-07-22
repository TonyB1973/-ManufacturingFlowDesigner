import type { FactoryAisle } from '../../models/factory/FactoryAisle';
import type { FactoryRoute } from '../../models/factory/FactoryRoute';
import type { GeometryAabb, GeometryPoint } from './FactoryFootprintGeometry';
import { polygonAabb } from './FactoryFootprintGeometry';
import { FACTORY_GEOMETRY_TOLERANCE, pointInPolygon, segmentsIntersect, simplifyOrthogonalPolyline, validateOrthogonalPolyline } from './FactoryStructureGeometry';
import { resolveFactoryRouteEndpoint, type FactoryRouteEndpointResolverSource } from '../factoryRoutes/FactoryRouteEndpointResolver';

export const FACTORY_ROUTE_TOLERANCE = 1e-6;
export const ROUTE_ENDPOINT_APPROACH_ALLOWANCE = 250;

const samePoint = (left: GeometryPoint, right: GeometryPoint): boolean => Math.abs(left.x - right.x) <= FACTORY_ROUTE_TOLERANCE && Math.abs(left.y - right.y) <= FACTORY_ROUTE_TOLERANCE;
const isOrthogonal = (left: GeometryPoint, right: GeometryPoint): boolean => samePoint(left, right) || Math.abs(left.x - right.x) <= FACTORY_ROUTE_TOLERANCE || Math.abs(left.y - right.y) <= FACTORY_ROUTE_TOLERANCE;

export function orthogonalDogleg(start: GeometryPoint, end: GeometryPoint, preferHorizontal = true): GeometryPoint[] {
  if (isOrthogonal(start, end)) return [{ ...start }, { ...end }];
  return preferHorizontal
    ? [{ ...start }, { x: end.x, y: start.y }, { ...end }]
    : [{ ...start }, { x: start.x, y: end.y }, { ...end }];
}

export function resolveFactoryRoutePolyline(route: FactoryRoute, source: FactoryRouteEndpointResolverSource): GeometryPoint[] {
  const start = resolveFactoryRouteEndpoint(route.source, source); const end = resolveFactoryRouteEndpoint(route.target, source);
  if (!start || !end) return [];
  const intent = route.waypoints.map((point) => ({ ...point }));
  if (!intent.length) return simplifyOrthogonalPolyline(orthogonalDogleg(start, end, true));
  const result: GeometryPoint[] = [...orthogonalDogleg(start, intent[0], true)];
  for (let index = 1; index < intent.length; index += 1) {
    const next = intent[index]; const previous = result.at(-1)!;
    const repair = orthogonalDogleg(previous, next, index % 2 === 0);
    result.push(...repair.slice(1));
  }
  result.push(...orthogonalDogleg(result.at(-1)!, end, false).slice(1));
  return simplifyOrthogonalPolyline(result);
}

export function factoryRouteDistance(route: FactoryRoute, source: FactoryRouteEndpointResolverSource): number {
  const points = resolveFactoryRoutePolyline(route, source);
  return points.slice(1).reduce((sum, point, index) => sum + Math.abs(point.x - points[index].x) + Math.abs(point.y - points[index].y), 0);
}

export function estimatedTravelTimeSeconds(route: FactoryRoute, source: FactoryRouteEndpointResolverSource): number | null {
  return route.nominalSpeed !== null && Number.isFinite(route.nominalSpeed) && route.nominalSpeed > 0 ? factoryRouteDistance(route, source) / route.nominalSpeed : null;
}

export function routeBounds(points: readonly GeometryPoint[]): GeometryAabb | null { return points.length ? polygonAabb(points) : null; }

export function pointToSegmentDistance(point: GeometryPoint, start: GeometryPoint, end: GeometryPoint): number {
  const dx = end.x - start.x; const dy = end.y - start.y; const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= FACTORY_ROUTE_TOLERANCE) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

export function routeSelfIntersects(points: readonly GeometryPoint[]): boolean {
  for (let left = 1; left < points.length; left += 1) for (let right = left + 2; right < points.length; right += 1) {
    if (left === 1 && right === points.length - 1 && samePoint(points[0], points.at(-1)!)) continue;
    if (segmentsIntersect(points[left - 1], points[left], points[right - 1], points[right], true)) return true;
  }
  return false;
}

export function validateResolvedRoute(points: readonly GeometryPoint[]): readonly string[] {
  const issues = [...validateOrthogonalPolyline(points)];
  if (routeSelfIntersects(points)) issues.push('Route must not self-intersect or overlap itself.');
  return [...new Set(issues)];
}

export function segmentIntersectsPolygon(start: GeometryPoint, end: GeometryPoint, polygon: readonly GeometryPoint[], includeTouch = false): boolean {
  if (pointInPolygon(start, polygon, false) || pointInPolygon(end, polygon, false)) return true;
  for (let index = 0; index < polygon.length; index += 1) if (segmentsIntersect(start, end, polygon[index], polygon[(index + 1) % polygon.length], includeTouch)) return true;
  const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  return pointInPolygon(midpoint, polygon, false);
}

export function polylineIntersectsPolygon(points: readonly GeometryPoint[], polygon: readonly GeometryPoint[], includeTouch = false): boolean {
  return points.slice(1).some((point, index) => segmentIntersectsPolygon(points[index], point, polygon, includeTouch));
}

export function routeContainedByBoundary(points: readonly GeometryPoint[], boundary: readonly GeometryPoint[]): boolean {
  if (!points.every((point) => pointInPolygon(point, boundary, true))) return false;
  return points.slice(1).every((point, index) => pointInPolygon({ x: (point.x + points[index].x) / 2, y: (point.y + points[index].y) / 2 }, boundary, true));
}

export function nearestAisleCentreline(point: GeometryPoint, aisles: readonly FactoryAisle[], tolerance: number): GeometryPoint | null {
  let best: { readonly point: GeometryPoint; readonly distance: number } | null = null;
  for (const aisle of aisles.filter((item) => item.visible)) for (let index = 1; index < aisle.points.length; index += 1) {
    const start = aisle.points[index - 1]; const end = aisle.points[index];
    const snapped = start.x === end.x
      ? { x: start.x, y: Math.max(Math.min(point.y, Math.max(start.y, end.y)), Math.min(start.y, end.y)) }
      : { x: Math.max(Math.min(point.x, Math.max(start.x, end.x)), Math.min(start.x, end.x)), y: start.y };
    const distance = Math.hypot(point.x - snapped.x, point.y - snapped.y);
    if (distance <= tolerance && (!best || distance < best.distance)) best = { point: snapped, distance };
  }
  return best?.point ?? null;
}

export function routeSegments(points: readonly GeometryPoint[]): readonly { readonly start: GeometryPoint; readonly end: GeometryPoint; readonly length: number }[] {
  return points.slice(1).map((end, index) => ({ start: points[index], end, length: Math.abs(end.x - points[index].x) + Math.abs(end.y - points[index].y) }));
}

export function pointOnRoute(point: GeometryPoint, points: readonly GeometryPoint[], tolerance: number): boolean {
  return routeSegments(points).some((segment) => pointToSegmentDistance(point, segment.start, segment.end) <= tolerance + FACTORY_GEOMETRY_TOLERANCE);
}
