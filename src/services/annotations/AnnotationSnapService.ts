import type { AnnotationAnchor, RectangleAnnotationFeature } from '../../models/factory/FactoryAnnotation';
import type { FactoryAnnotationStore } from '../FactoryAnnotationStore';
import type { FactoryRouteStore } from '../FactoryRouteStore';
import type { FactoryStructureStore } from '../FactoryStructureStore';
import type { ResourceStore } from '../ResourceStore';
import type { SnapService } from '../SnapService';
import { nearestRectangleAnchor } from '../factoryRoutes/FactoryRouteEndpointResolver';
import type { GeometryPoint } from '../geometry/FactoryFootprintGeometry';
import { resolveFactoryRouteEndpoint } from '../factoryRoutes/FactoryRouteEndpointResolver';
import type { AnnotationAnchorResolver } from './AnnotationAnchorResolver';

export interface AnnotationSnapResult { readonly point: GeometryPoint; readonly anchor: AnnotationAnchor; readonly snapped: boolean; readonly label: string; }
interface Candidate { readonly point: GeometryPoint; readonly anchor: AnnotationAnchor; readonly label: string; }
const distance = (a: GeometryPoint, b: GeometryPoint): number => Math.hypot(a.x - b.x, a.y - b.y);
const rectangleFeatures: readonly RectangleAnnotationFeature[] = ['centre', 'topLeft', 'topCentre', 'topRight', 'rightCentre', 'bottomRight', 'bottomCentre', 'bottomLeft', 'leftCentre'];

export class AnnotationSnapService {
  public constructor(private readonly resources: ResourceStore, private readonly structure: FactoryStructureStore, private readonly routes: FactoryRouteStore, private readonly annotations: FactoryAnnotationStore, private readonly resolver: AnnotationAnchorResolver, private readonly grid: SnapService) {}
  public resolve(point: GeometryPoint, zoom: number, bypass: boolean): AnnotationSnapResult {
    if (bypass) return { point: { ...point }, anchor: { kind: 'free', point: { ...point } }, snapped: false, label: 'Free point' };
    const tolerance = 9 / Math.max(zoom, 0.01); const candidates = this.candidates(point); const nearest = candidates.map((item) => ({ item, distance: distance(point, item.point) })).filter((item) => item.distance <= tolerance).sort((a, b) => a.distance - b.distance)[0]?.item;
    if (nearest) return { ...nearest, point: { ...nearest.point }, snapped: true };
    const gridPoint = this.grid.snapPoint(point); const gridSnapped = distance(point, gridPoint) > 1e-9;
    return { point: gridPoint, anchor: { kind: 'free', point: { ...gridPoint } }, snapped: gridSnapped, label: gridSnapped ? 'Grid' : 'Free point' };
  }
  private candidates(pointer: GeometryPoint): Candidate[] {
    const values: Candidate[] = [];
    for (const resource of this.resources.getPlacedResources().filter((item) => item.visible)) {
      const centre = { x: resource.worldX, y: resource.worldY };
      for (const feature of rectangleFeatures) { const anchor = { kind: 'resource' as const, resourceId: resource.id, feature }; const resolved = this.resolver.resolve(anchor, resource.layoutId); if (resolved.point) values.push({ point: resolved.point, anchor, label: `${resource.id} ${feature}` }); }
      const perimeter = nearestRectangleAnchor(pointer, centre, resource.width, resource.depth, resource.rotationDegrees); values.push({ point: perimeter.point, anchor: { kind: 'resource', resourceId: resource.id, feature: 'perimeter', side: perimeter.side, offset: perimeter.offset }, label: `${resource.id} perimeter` });
    }
    for (const area of this.structure.getAreas().filter((item) => item.visible)) { const centre = { x: area.worldX, y: area.worldY }; for (const feature of rectangleFeatures) { const anchor = { kind: 'area' as const, areaId: area.id, feature }; const resolved = this.resolver.resolve(anchor, area.layoutId); if (resolved.point) values.push({ point: resolved.point, anchor, label: `${area.id} ${feature}` }); } const perimeter = nearestRectangleAnchor(pointer, centre, area.width, area.depth, area.rotationDegrees); values.push({ point: perimeter.point, anchor: { kind: 'area', areaId: area.id, feature: 'perimeter', side: perimeter.side, offset: perimeter.offset }, label: `${area.id} perimeter` }); }
    for (const boundary of this.structure.getBoundaries().filter((item) => item.visible)) boundary.points.forEach((point, index) => values.push({ point: { ...point }, anchor: { kind: 'boundary', boundaryId: boundary.id, feature: 'vertex', index }, label: `${boundary.id} vertex ${index + 1}` }));
    for (const wall of this.structure.getWalls().filter((item) => item.visible)) { values.push({ point: { ...wall.start }, anchor: { kind: 'wall', wallId: wall.id, feature: 'start' }, label: `${wall.id} start` }, { point: { x: (wall.start.x + wall.end.x) / 2, y: (wall.start.y + wall.end.y) / 2 }, anchor: { kind: 'wall', wallId: wall.id, feature: 'centre' }, label: `${wall.id} centre` }, { point: { ...wall.end }, anchor: { kind: 'wall', wallId: wall.id, feature: 'end' }, label: `${wall.id} end` }); }
    for (const aisle of this.structure.getAisles().filter((item) => item.visible)) aisle.points.forEach((point, index) => values.push({ point: { ...point }, anchor: { kind: 'aisle', aisleId: aisle.id, feature: 'vertex', index }, label: `${aisle.id} vertex ${index + 1}` }));
    const endpointSource = { getResource: (id: string) => this.resources.getResource(id), getArea: (id: string) => this.structure.getArea(id) };
    for (const route of this.routes.getRoutes().filter((item) => item.visible)) { const source = resolveFactoryRouteEndpoint(route.source, endpointSource); const target = resolveFactoryRouteEndpoint(route.target, endpointSource); if (source) values.push({ point: source, anchor: { kind: 'factoryRoute', factoryRouteId: route.id, feature: 'source' }, label: `${route.id} source` }); if (target) values.push({ point: target, anchor: { kind: 'factoryRoute', factoryRouteId: route.id, feature: 'target' }, label: `${route.id} target` }); route.waypoints.forEach((waypoint, index) => values.push({ point: { ...waypoint }, anchor: { kind: 'factoryRoute', factoryRouteId: route.id, feature: 'waypoint', index }, label: `${route.id} waypoint ${index + 1}` })); }
    for (const annotation of this.annotations.getAnnotations().filter((item) => item.visible)) { const anchors = annotation.annotationType === 'linearDimension' ? [annotation.startAnchor, annotation.endAnchor] : annotation.annotationType === 'coordinate' || annotation.annotationType === 'leader' ? [annotation.anchor] : []; for (const anchor of anchors) { const resolved = this.resolver.resolve(anchor, annotation.layoutId); if (resolved.point) values.push({ point: resolved.point, anchor, label: `${annotation.id} anchor` }); } }
    return values;
  }
}
