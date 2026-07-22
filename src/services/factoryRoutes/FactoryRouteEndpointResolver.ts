import type { FactoryArea } from '../../models/factory/FactoryArea';
import type { FactoryRouteAnchorSide, FactoryRouteEndpoint } from '../../models/factory/FactoryRoute';
import type { ResourceInstance } from '../../models/resources/ResourceInstance';
import type { GeometryPoint } from '../geometry/FactoryFootprintGeometry';
import { rotatePoint } from '../geometry/FactoryFootprintGeometry';

export interface FactoryRouteEndpointResolverSource {
  getResource(id: string): ResourceInstance | undefined;
  getArea(id: string): FactoryArea | undefined;
}

function localAnchor(width: number, depth: number, side: FactoryRouteAnchorSide, offset: number): GeometryPoint {
  const clamped = Math.max(0, Math.min(1, offset));
  if (side === 'top') return { x: -width / 2 + width * clamped, y: -depth / 2 };
  if (side === 'right') return { x: width / 2, y: -depth / 2 + depth * clamped };
  if (side === 'bottom') return { x: width / 2 - width * clamped, y: depth / 2 };
  return { x: -width / 2, y: depth / 2 - depth * clamped };
}

export function resolveRectangleAnchor(centre: GeometryPoint, width: number, depth: number, rotationDegrees: number, side: FactoryRouteAnchorSide, offset: number): GeometryPoint {
  const local = localAnchor(width, depth, side, offset);
  return rotatePoint({ x: centre.x + local.x, y: centre.y + local.y }, centre, rotationDegrees);
}

export function resolveFactoryRouteEndpoint(endpoint: FactoryRouteEndpoint, source: FactoryRouteEndpointResolverSource): GeometryPoint | null {
  if (endpoint.kind === 'free') return Number.isFinite(endpoint.point.x) && Number.isFinite(endpoint.point.y) ? { ...endpoint.point } : null;
  if (!Number.isFinite(endpoint.anchorOffset)) return null;
  if (endpoint.kind === 'resource') {
    const resource = source.getResource(endpoint.resourceId);
    return resource ? resolveRectangleAnchor({ x: resource.worldX, y: resource.worldY }, resource.width, resource.depth, resource.rotationDegrees, endpoint.anchorSide, endpoint.anchorOffset) : null;
  }
  const area = source.getArea(endpoint.areaId);
  return area ? resolveRectangleAnchor({ x: area.worldX, y: area.worldY }, area.width, area.depth, area.rotationDegrees, endpoint.anchorSide, endpoint.anchorOffset) : null;
}

export function nearestRectangleAnchor(point: GeometryPoint, centre: GeometryPoint, width: number, depth: number, rotationDegrees: number): { readonly side: FactoryRouteAnchorSide; readonly offset: number; readonly point: GeometryPoint } {
  const radians = -rotationDegrees * Math.PI / 180;
  const dx = point.x - centre.x; const dy = point.y - centre.y;
  const local = { x: dx * Math.cos(radians) - dy * Math.sin(radians), y: dx * Math.sin(radians) + dy * Math.cos(radians) };
  const candidates: { side: FactoryRouteAnchorSide; offset: number; distance: number }[] = [
    { side: 'top', offset: (local.x + width / 2) / width, distance: Math.abs(local.y + depth / 2) },
    { side: 'right', offset: (local.y + depth / 2) / depth, distance: Math.abs(local.x - width / 2) },
    { side: 'bottom', offset: (width / 2 - local.x) / width, distance: Math.abs(local.y - depth / 2) },
    { side: 'left', offset: (depth / 2 - local.y) / depth, distance: Math.abs(local.x + width / 2) },
  ];
  const best = candidates.sort((a, b) => a.distance - b.distance)[0];
  const offset = Math.max(0, Math.min(1, best.offset));
  return { side: best.side, offset, point: resolveRectangleAnchor(centre, width, depth, rotationDegrees, best.side, offset) };
}
