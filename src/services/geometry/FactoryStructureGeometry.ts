import type { FactoryAisle } from '../../models/factory/FactoryAisle';
import type { FactoryWall } from '../../models/factory/FactoryWall';
import type { GeometryAabb, GeometryPoint } from './FactoryFootprintGeometry';
import { polygonAabb, polygonsOverlap } from './FactoryFootprintGeometry';

export const FACTORY_GEOMETRY_TOLERANCE = 1e-7;

export interface OrthogonalValidation {
  readonly valid: boolean;
  readonly points: readonly GeometryPoint[];
  readonly issues: readonly string[];
  readonly area: number;
}

const samePoint = (left: GeometryPoint, right: GeometryPoint): boolean =>
  Math.abs(left.x - right.x) <= FACTORY_GEOMETRY_TOLERANCE && Math.abs(left.y - right.y) <= FACTORY_GEOMETRY_TOLERANCE;

export function simplifyOrthogonalPolyline(points: readonly GeometryPoint[], closed = false): GeometryPoint[] {
  const result: GeometryPoint[] = [];
  for (const point of points) if (!result.length || !samePoint(result.at(-1)!, point)) result.push({ ...point });
  if (closed && result.length > 1 && samePoint(result[0], result.at(-1)!)) result.pop();
  let changed = true;
  while (changed && result.length >= (closed ? 4 : 3)) {
    changed = false;
    for (let index = 0; index < result.length; index += 1) {
      if (!closed && (index === 0 || index === result.length - 1)) continue;
      const previous = result[(index - 1 + result.length) % result.length];
      const current = result[index];
      const next = result[(index + 1) % result.length];
      if ((previous.x === current.x && current.x === next.x) || (previous.y === current.y && current.y === next.y)) {
        result.splice(index, 1); changed = true; break;
      }
    }
  }
  return result;
}

export function polygonArea(points: readonly GeometryPoint[]): number {
  let twiceArea = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]; const next = points[(index + 1) % points.length];
    twiceArea += current.x * next.y - next.x * current.y;
  }
  return twiceArea / 2;
}

export function validateOrthogonalPolygon(source: readonly GeometryPoint[]): OrthogonalValidation {
  const issues: string[] = [];
  if (source.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) issues.push('Vertices must use finite coordinates.');
  for (let index = 1; index < source.length; index += 1) if (samePoint(source[index - 1], source[index])) issues.push('Consecutive duplicate vertices are not allowed.');
  const points = simplifyOrthogonalPolyline(source, true);
  if (points.length < 4) issues.push('An orthogonal boundary requires at least four vertices.');
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]; const next = points[(index + 1) % points.length];
    if (samePoint(current, next)) issues.push('Zero-length edges are not allowed.');
    else if (current.x !== next.x && current.y !== next.y) issues.push('Boundary edges must be horizontal or vertical.');
  }
  for (let left = 0; left < points.length; left += 1) {
    const leftNext = (left + 1) % points.length;
    for (let right = left + 1; right < points.length; right += 1) {
      const rightNext = (right + 1) % points.length;
      if (left === right || leftNext === right || rightNext === left) continue;
      if (segmentsIntersect(points[left], points[leftNext], points[right], points[rightNext], false)) issues.push('Boundary must not self-intersect.');
    }
  }
  const signedArea = polygonArea(points);
  if (Math.abs(signedArea) <= FACTORY_GEOMETRY_TOLERANCE) issues.push('Boundary area must be positive.');
  const normalized = signedArea < 0 ? [...points].reverse() : points;
  return { valid: issues.length === 0, points: normalized, issues: [...new Set(issues)], area: Math.abs(signedArea) };
}

export function pointInPolygon(point: GeometryPoint, polygon: readonly GeometryPoint[], includeEdge = true): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const a = polygon[previous]; const b = polygon[index];
    if (pointOnSegment(point, a, b)) return includeEdge;
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function segmentsIntersect(a: GeometryPoint, b: GeometryPoint, c: GeometryPoint, d: GeometryPoint, includeTouch = true): boolean {
  const cross = (p: GeometryPoint, q: GeometryPoint, r: GeometryPoint): number => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const abC = cross(a, b, c); const abD = cross(a, b, d); const cdA = cross(c, d, a); const cdB = cross(c, d, b);
  if (((abC > FACTORY_GEOMETRY_TOLERANCE && abD < -FACTORY_GEOMETRY_TOLERANCE) || (abC < -FACTORY_GEOMETRY_TOLERANCE && abD > FACTORY_GEOMETRY_TOLERANCE))
    && ((cdA > FACTORY_GEOMETRY_TOLERANCE && cdB < -FACTORY_GEOMETRY_TOLERANCE) || (cdA < -FACTORY_GEOMETRY_TOLERANCE && cdB > FACTORY_GEOMETRY_TOLERANCE))) return true;
  if (!includeTouch) return false;
  return (Math.abs(abC) <= FACTORY_GEOMETRY_TOLERANCE && pointOnSegment(c, a, b))
    || (Math.abs(abD) <= FACTORY_GEOMETRY_TOLERANCE && pointOnSegment(d, a, b))
    || (Math.abs(cdA) <= FACTORY_GEOMETRY_TOLERANCE && pointOnSegment(a, c, d))
    || (Math.abs(cdB) <= FACTORY_GEOMETRY_TOLERANCE && pointOnSegment(b, c, d));
}

function pointOnSegment(point: GeometryPoint, start: GeometryPoint, end: GeometryPoint): boolean {
  const cross = (point.y - start.y) * (end.x - start.x) - (point.x - start.x) * (end.y - start.y);
  return Math.abs(cross) <= FACTORY_GEOMETRY_TOLERANCE
    && point.x >= Math.min(start.x, end.x) - FACTORY_GEOMETRY_TOLERANCE && point.x <= Math.max(start.x, end.x) + FACTORY_GEOMETRY_TOLERANCE
    && point.y >= Math.min(start.y, end.y) - FACTORY_GEOMETRY_TOLERANCE && point.y <= Math.max(start.y, end.y) + FACTORY_GEOMETRY_TOLERANCE;
}

export function polygonContainedByBoundary(polygon: readonly GeometryPoint[], boundary: readonly GeometryPoint[]): boolean {
  return polygon.every((point) => pointInPolygon(point, boundary, true));
}

export function wallLength(wall: Pick<FactoryWall, 'start' | 'end'>): number { return Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y); }

export function wallRectangle(wall: Pick<FactoryWall, 'start' | 'end' | 'thickness'>): readonly GeometryPoint[] {
  const half = wall.thickness / 2;
  if (wall.start.y === wall.end.y) return [
    { x: Math.min(wall.start.x, wall.end.x), y: wall.start.y - half }, { x: Math.max(wall.start.x, wall.end.x), y: wall.start.y - half },
    { x: Math.max(wall.start.x, wall.end.x), y: wall.start.y + half }, { x: Math.min(wall.start.x, wall.end.x), y: wall.start.y + half },
  ];
  return [
    { x: wall.start.x - half, y: Math.min(wall.start.y, wall.end.y) }, { x: wall.start.x + half, y: Math.min(wall.start.y, wall.end.y) },
    { x: wall.start.x + half, y: Math.max(wall.start.y, wall.end.y) }, { x: wall.start.x - half, y: Math.max(wall.start.y, wall.end.y) },
  ];
}

export function polylineLength(points: readonly GeometryPoint[]): number {
  return points.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - points[index].x, point.y - points[index].y), 0);
}

export function validateOrthogonalPolyline(points: readonly GeometryPoint[]): readonly string[] {
  const issues: string[] = [];
  if (points.length < 2) issues.push('At least two points are required.');
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]; const current = points[index];
    if (samePoint(previous, current)) issues.push('Zero-length segments are not allowed.');
    else if (previous.x !== current.x && previous.y !== current.y) issues.push('Segments must be horizontal or vertical.');
  }
  return [...new Set(issues)];
}

export function aisleCorridorRectangles(aisle: Pick<FactoryAisle, 'points' | 'width'>): readonly (readonly GeometryPoint[])[] {
  const half = aisle.width / 2;
  return aisle.points.slice(1).map((point, index) => {
    const previous = aisle.points[index];
    return wallRectangle({ start: previous, end: point, thickness: aisle.width }).map((corner) => ({
      x: corner.x + (previous.x === point.x ? 0 : corner.x === Math.min(previous.x, point.x) ? -half : half),
      y: corner.y + (previous.y === point.y ? 0 : corner.y === Math.min(previous.y, point.y) ? -half : half),
    }));
  });
}

export const polygonIntersectsAny = (polygon: readonly GeometryPoint[], candidates: readonly (readonly GeometryPoint[])[]): boolean =>
  candidates.some((candidate) => polygonsOverlap(polygon, candidate));

export function combineFactoryExtents(polygons: readonly (readonly GeometryPoint[])[]): GeometryAabb | null {
  if (!polygons.length) return null;
  return polygons.map(polygonAabb).reduce((result, value) => ({ minX: Math.min(result.minX, value.minX), minY: Math.min(result.minY, value.minY), maxX: Math.max(result.maxX, value.maxX), maxY: Math.max(result.maxY, value.maxY) }));
}
