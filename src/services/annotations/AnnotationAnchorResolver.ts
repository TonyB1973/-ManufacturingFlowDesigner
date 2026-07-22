import type { AnnotationAnchor, RectangleAnnotationFeature } from '../../models/factory/FactoryAnnotation';
import type { FactoryRoute } from '../../models/factory/FactoryRoute';
import type { FactoryRouteStore } from '../FactoryRouteStore';
import type { FactoryStructureStore } from '../FactoryStructureStore';
import type { ResourceStore } from '../ResourceStore';
import { resolveFactoryRouteEndpoint, resolveRectangleAnchor } from '../factoryRoutes/FactoryRouteEndpointResolver';
import type { GeometryPoint } from '../geometry/FactoryFootprintGeometry';
import { rotatePoint } from '../geometry/FactoryFootprintGeometry';

export interface AnnotationAnchorResolverSource { readonly resources: ResourceStore; readonly structure: FactoryStructureStore; readonly routes: FactoryRouteStore; }
export interface AnnotationAnchorResolution { readonly point: GeometryPoint | null; readonly error: string | null; }

const ok = (point: GeometryPoint): AnnotationAnchorResolution => ({ point, error: null });
const fail = (error: string): AnnotationAnchorResolution => ({ point: null, error });
const interpolate = (start: GeometryPoint, end: GeometryPoint, offset = 0.5): GeometryPoint => ({ x: start.x + (end.x - start.x) * offset, y: start.y + (end.y - start.y) * offset });
const validOffset = (offset: number | undefined): number | null => offset === undefined ? 0.5 : Number.isFinite(offset) && offset >= 0 && offset <= 1 ? offset : null;

function rectangleFeature(centre: GeometryPoint, width: number, depth: number, rotation: number, feature: RectangleAnnotationFeature, side?: 'top' | 'right' | 'bottom' | 'left', offset?: number): AnnotationAnchorResolution {
  if (feature === 'perimeter') { const resolvedOffset = validOffset(offset); return side && resolvedOffset !== null ? ok(resolveRectangleAnchor(centre, width, depth, rotation, side, resolvedOffset)) : fail('Perimeter anchor side or offset is invalid.'); }
  const local: Record<Exclude<RectangleAnnotationFeature, 'perimeter'>, GeometryPoint> = {
    centre: { x: 0, y: 0 }, topLeft: { x: -width / 2, y: -depth / 2 }, topCentre: { x: 0, y: -depth / 2 }, topRight: { x: width / 2, y: -depth / 2 }, rightCentre: { x: width / 2, y: 0 }, bottomRight: { x: width / 2, y: depth / 2 }, bottomCentre: { x: 0, y: depth / 2 }, bottomLeft: { x: -width / 2, y: depth / 2 }, leftCentre: { x: -width / 2, y: 0 },
  };
  const point = local[feature];
  return point ? ok(rotatePoint({ x: centre.x + point.x, y: centre.y + point.y }, centre, rotation)) : fail('Rectangle anchor feature is invalid.');
}

export class AnnotationAnchorResolver {
  public constructor(private readonly source: AnnotationAnchorResolverSource) {}
  public resolve(anchor: AnnotationAnchor, layoutId: string): AnnotationAnchorResolution {
    if (anchor.kind === 'free') return Number.isFinite(anchor.point.x) && Number.isFinite(anchor.point.y) ? ok({ ...anchor.point }) : fail('Free anchor is not finite.');
    if (anchor.kind === 'resource') { const item = this.source.resources.getResource(anchor.resourceId); if (!item) return fail(`Physical resource ${anchor.resourceId} is missing.`); if (item.layoutId !== layoutId) return fail('Physical resource belongs to another layout.'); return rectangleFeature({ x: item.worldX, y: item.worldY }, item.width, item.depth, item.rotationDegrees, anchor.feature, anchor.side, anchor.offset); }
    if (anchor.kind === 'area') { const item = this.source.structure.getArea(anchor.areaId); if (!item) return fail(`Factory area ${anchor.areaId} is missing.`); if (item.layoutId !== layoutId) return fail('Factory area belongs to another layout.'); return rectangleFeature({ x: item.worldX, y: item.worldY }, item.width, item.depth, item.rotationDegrees, anchor.feature, anchor.side, anchor.offset); }
    if (anchor.kind === 'boundary') { const item = this.source.structure.getBoundary(anchor.boundaryId); if (!item) return fail(`Factory boundary ${anchor.boundaryId} is missing.`); if (item.layoutId !== layoutId) return fail('Factory boundary belongs to another layout.'); const start = item.points[anchor.index]; if (!start) return fail('Boundary anchor index is outside the vertex collection.'); if (anchor.feature === 'vertex') return ok({ ...start }); const end = item.points[(anchor.index + 1) % item.points.length]; const offset = validOffset(anchor.offset); return end && offset !== null ? ok(interpolate(start, end, offset)) : fail('Boundary edge anchor is invalid.'); }
    if (anchor.kind === 'wall') { const item = this.source.structure.getWall(anchor.wallId); if (!item) return fail(`Factory wall ${anchor.wallId} is missing.`); if (item.layoutId !== layoutId) return fail('Factory wall belongs to another layout.'); if (anchor.feature === 'start') return ok({ ...item.start }); if (anchor.feature === 'end') return ok({ ...item.end }); const offset = anchor.feature === 'centre' ? 0.5 : validOffset(anchor.offset); return offset !== null ? ok(interpolate(item.start, item.end, offset)) : fail('Wall edge anchor offset is invalid.'); }
    if (anchor.kind === 'aisle') { const item = this.source.structure.getAisle(anchor.aisleId); if (!item) return fail(`Factory aisle ${anchor.aisleId} is missing.`); if (item.layoutId !== layoutId) return fail('Factory aisle belongs to another layout.'); const start = item.points[anchor.index]; if (!start) return fail('Aisle anchor index is outside the centreline collection.'); if (anchor.feature === 'vertex') return ok({ ...start }); const end = item.points[anchor.index + 1]; const offset = validOffset(anchor.offset); return end && offset !== null ? ok(interpolate(start, end, offset)) : fail('Aisle segment anchor is invalid.'); }
    const route = this.source.routes.getRoute(anchor.factoryRouteId); if (!route) return fail(`Factory route ${anchor.factoryRouteId} is missing.`); if (route.layoutId !== layoutId) return fail('Factory route belongs to another layout.'); return this.resolveRoute(anchor, route);
  }
  private resolveRoute(anchor: Extract<AnnotationAnchor, { kind: 'factoryRoute' }>, route: FactoryRoute): AnnotationAnchorResolution {
    const endpointSource = { getResource: (id: string) => this.source.resources.getResource(id), getArea: (id: string) => this.source.structure.getArea(id) };
    if (anchor.feature === 'source' || anchor.feature === 'target') { const point = resolveFactoryRouteEndpoint(route[anchor.feature], endpointSource); return point ? ok(point) : fail(`Factory route ${anchor.feature} cannot be resolved.`); }
    if (anchor.feature === 'waypoint') { const point = route.waypoints[anchor.index ?? -1]; return point ? ok({ ...point }) : fail('Factory route waypoint index is invalid.'); }
    const source = resolveFactoryRouteEndpoint(route.source, endpointSource); const target = resolveFactoryRouteEndpoint(route.target, endpointSource); if (!source || !target) return fail('Factory route endpoint cannot be resolved.'); const authored = [source, ...route.waypoints, target]; const index = anchor.index ?? -1; const start = authored[index]; const end = authored[index + 1]; const offset = validOffset(anchor.offset); return start && end && offset !== null ? ok(interpolate(start, end, offset)) : fail('Factory route segment anchor is invalid.');
  }
}
