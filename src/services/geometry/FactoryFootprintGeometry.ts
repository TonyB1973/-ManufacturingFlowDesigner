import type { ResourceInstance } from '../../models/resources/ResourceInstance';

export interface GeometryPoint { readonly x: number; readonly y: number; }
export interface GeometryAabb { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number; }

const EPSILON = 1e-7;
export const degreesToRadians = (degrees: number): number => degrees * Math.PI / 180;

export function rotatePoint(point: GeometryPoint, centre: GeometryPoint, degrees: number): GeometryPoint {
  const radians = degreesToRadians(degrees); const cosine = Math.cos(radians); const sine = Math.sin(radians);
  const dx = point.x - centre.x; const dy = point.y - centre.y;
  return { x: centre.x + dx * cosine - dy * sine, y: centre.y + dx * sine + dy * cosine };
}

export function rectangleCorners(centre: GeometryPoint, width: number, depth: number, rotationDegrees: number): readonly GeometryPoint[] {
  const halfWidth = width / 2; const halfDepth = depth / 2;
  return [
    { x: centre.x - halfWidth, y: centre.y - halfDepth },
    { x: centre.x + halfWidth, y: centre.y - halfDepth },
    { x: centre.x + halfWidth, y: centre.y + halfDepth },
    { x: centre.x - halfWidth, y: centre.y + halfDepth },
  ].map((point) => rotatePoint(point, centre, rotationDegrees));
}

export const footprintPolygon = (resource: ResourceInstance): readonly GeometryPoint[] => rectangleCorners(
  { x: resource.worldX, y: resource.worldY }, resource.width, resource.depth, resource.rotationDegrees,
);

export function clearancePolygon(resource: ResourceInstance): readonly GeometryPoint[] {
  const { left, right, top, bottom } = resource.clearance;
  const localCentre = { x: resource.worldX + (right - left) / 2, y: resource.worldY + (bottom - top) / 2 };
  const rotatedCentre = rotatePoint(localCentre, { x: resource.worldX, y: resource.worldY }, resource.rotationDegrees);
  return rectangleCorners(rotatedCentre, resource.width + left + right, resource.depth + top + bottom, resource.rotationDegrees);
}

export function polygonAabb(points: readonly GeometryPoint[]): GeometryAabb {
  return {
    minX: Math.min(...points.map((point) => point.x)), minY: Math.min(...points.map((point) => point.y)),
    maxX: Math.max(...points.map((point) => point.x)), maxY: Math.max(...points.map((point) => point.y)),
  };
}

export const aabbsOverlap = (left: GeometryAabb, right: GeometryAabb, tolerance = EPSILON): boolean =>
  Math.min(left.maxX, right.maxX) - Math.max(left.minX, right.minX) > tolerance
  && Math.min(left.maxY, right.maxY) - Math.max(left.minY, right.minY) > tolerance;

export function polygonsOverlap(left: readonly GeometryPoint[], right: readonly GeometryPoint[], tolerance = EPSILON): boolean {
  if (!aabbsOverlap(polygonAabb(left), polygonAabb(right), tolerance)) return false;
  for (const polygon of [left, right]) {
    for (let index = 0; index < polygon.length; index += 1) {
      const current = polygon[index]; const next = polygon[(index + 1) % polygon.length];
      const axis = { x: -(next.y - current.y), y: next.x - current.x };
      const length = Math.hypot(axis.x, axis.y); const normalized = { x: axis.x / length, y: axis.y / length };
      const leftProjection = left.map((point) => point.x * normalized.x + point.y * normalized.y);
      const rightProjection = right.map((point) => point.x * normalized.x + point.y * normalized.y);
      const penetration = Math.min(Math.max(...leftProjection), Math.max(...rightProjection)) - Math.max(Math.min(...leftProjection), Math.min(...rightProjection));
      if (penetration <= tolerance) return false;
    }
  }
  return true;
}
