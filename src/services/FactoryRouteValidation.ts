import type { FactoryAisle, FactoryAisleType } from '../models/factory/FactoryAisle';
import type { FactoryArea } from '../models/factory/FactoryArea';
import type { FactoryRoute, FactoryRouteType } from '../models/factory/FactoryRoute';
import type { ResourceInstance } from '../models/resources/ResourceInstance';
import type { FactoryRouteStore } from './FactoryRouteStore';
import type { FactoryStructureStore } from './FactoryStructureStore';
import { clearancePolygon, footprintPolygon, rectangleCorners } from './geometry/FactoryFootprintGeometry';
import { ROUTE_ENDPOINT_APPROACH_ALLOWANCE, factoryRouteDistance, polylineIntersectsPolygon, resolveFactoryRoutePolyline, routeContainedByBoundary, routeSegments, validateResolvedRoute } from './geometry/FactoryRouteGeometry';
import { aisleCorridorRectangles, pointInPolygon, wallRectangle } from './geometry/FactoryStructureGeometry';

export type FactoryRouteIssueType = 'broken-reference' | 'invalid-geometry' | 'outside-boundary' | 'wall-obstruction' | 'resource-obstruction' | 'clearance-warning' | 'area-policy' | 'aisle-compatibility' | 'aisle-coverage';
export interface FactoryRouteIssue {
  readonly type: FactoryRouteIssueType;
  readonly severity: 'error' | 'warning';
  readonly routeId: string;
  readonly relatedKind?: 'resource' | 'area' | 'wall' | 'aisle' | 'boundary';
  readonly relatedId?: string;
  readonly message: string;
}

export interface FactoryRouteSummary {
  readonly total: number;
  readonly enabled: number;
  readonly countsByType: Readonly<Record<FactoryRouteType, number>>;
  readonly distanceByType: Readonly<Record<FactoryRouteType, number>>;
  readonly withNominalSpeed: number;
  readonly errors: number;
  readonly warnings: number;
  readonly issues: readonly FactoryRouteIssue[];
}

export interface FactoryRouteValidationSource {
  readonly resources: readonly ResourceInstance[];
  readonly structure: FactoryStructureStore;
  readonly routes: FactoryRouteStore;
}

const ROUTE_TYPES: readonly FactoryRouteType[] = ['Walking', 'Material', 'Forklift', 'AGV', 'Tugger', 'General'];
const compatibleAisles: Readonly<Record<FactoryRouteType, readonly FactoryAisleType[]>> = {
  Walking: ['Pedestrian', 'Shared', 'Emergency'], Material: ['Material', 'Shared', 'Forklift'], Forklift: ['Forklift', 'Shared'], AGV: ['Material', 'Shared', 'General'], Tugger: ['Material', 'Shared', 'Forklift'], General: ['Pedestrian', 'Material', 'Forklift', 'Shared', 'Emergency', 'General'],
};

const areaPolygon = (area: FactoryArea) => rectangleCorners({ x: area.worldX, y: area.worldY }, area.width, area.depth, area.rotationDegrees);
const endpointResourceIds = (route: FactoryRoute): Set<string> => new Set([route.source, route.target].filter((endpoint): endpoint is Extract<typeof endpoint, { kind: 'resource' }> => endpoint.kind === 'resource').map((endpoint) => endpoint.resourceId));
const endpointAreaIds = (route: FactoryRoute): Set<string> => new Set([route.source, route.target].filter((endpoint): endpoint is Extract<typeof endpoint, { kind: 'area' }> => endpoint.kind === 'area').map((endpoint) => endpoint.areaId));
const segmentMidpointInCorridor = (start: { x: number; y: number }, end: { x: number; y: number }, aisle: FactoryAisle): boolean => {
  const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  return aisleCorridorRectangles(aisle).some((corridor) => pointInPolygon(midpoint, corridor, true));
};

export function validateFactoryRoutes(source: FactoryRouteValidationSource): FactoryRouteSummary {
  const resources = new Map(source.resources.map((resource) => [resource.id, resource]));
  const areas = new Map(source.structure.getAreas().map((area) => [area.id, area]));
  const resolver = { getResource: (id: string) => resources.get(id), getArea: (id: string) => areas.get(id) };
  const issues: FactoryRouteIssue[] = []; const issueKeys = new Set<string>();
  const report = (issue: FactoryRouteIssue): void => { const key = `${issue.routeId}|${issue.type}|${issue.relatedKind ?? ''}|${issue.relatedId ?? ''}|${issue.message}`; if (!issueKeys.has(key)) { issueKeys.add(key); issues.push(issue); } };
  const boundary = source.structure.getActiveBoundary(); const walls = source.structure.getWalls().filter((item) => item.visible); const visibleAreas = source.structure.getAreas().filter((item) => item.visible); const aisles = source.structure.getAisles().filter((item) => item.visible);

  for (const route of source.routes.getRoutes()) {
    for (const endpoint of [route.source, route.target]) {
      if (endpoint.kind === 'resource' && !resources.has(endpoint.resourceId)) report({ type: 'broken-reference', severity: 'error', routeId: route.id, relatedKind: 'resource', relatedId: endpoint.resourceId, message: `${route.id} references missing physical resource ${endpoint.resourceId}.` });
      if (endpoint.kind === 'area' && !areas.has(endpoint.areaId)) report({ type: 'broken-reference', severity: 'error', routeId: route.id, relatedKind: 'area', relatedId: endpoint.areaId, message: `${route.id} references missing factory area ${endpoint.areaId}.` });
    }
    const points = resolveFactoryRoutePolyline(route, resolver);
    const geometryIssues = validateResolvedRoute(points);
    for (const message of geometryIssues) report({ type: 'invalid-geometry', severity: 'error', routeId: route.id, message: `${route.id}: ${message}` });
    if (points.length < 2) continue;
    if (boundary && !routeContainedByBoundary(points, boundary.points)) report({ type: 'outside-boundary', severity: 'error', routeId: route.id, relatedKind: 'boundary', relatedId: boundary.id, message: `${route.id} extends outside the factory boundary.` });
    for (const wall of walls) if (polylineIntersectsPolygon(points, wallRectangle(wall), false)) report({ type: 'wall-obstruction', severity: 'error', routeId: route.id, relatedKind: 'wall', relatedId: wall.id, message: `${route.id} crosses ${wall.id}.` });
    const endpointResources = endpointResourceIds(route);
    for (const resource of source.resources.filter((item) => item.visible && !endpointResources.has(item.id))) {
      if (polylineIntersectsPolygon(points, footprintPolygon(resource), false)) report({ type: 'resource-obstruction', severity: resource.active ? 'error' : 'warning', routeId: route.id, relatedKind: 'resource', relatedId: resource.id, message: `${route.id} passes through ${resource.active ? 'active' : 'inactive'} resource ${resource.id}.` });
      else if (resource.clearance.enabled && polylineIntersectsPolygon(points, clearancePolygon(resource), false)) report({ type: 'clearance-warning', severity: 'warning', routeId: route.id, relatedKind: 'resource', relatedId: resource.id, message: `${route.id} passes through ${resource.id} clearance.` });
    }
    const endpointAreas = endpointAreaIds(route);
    for (const area of visibleAreas.filter((item) => item.resourcePlacementPolicy !== 'Allowed' && !endpointAreas.has(item.id))) if (polylineIntersectsPolygon(points, areaPolygon(area), false)) report({ type: 'area-policy', severity: area.resourcePlacementPolicy === 'Prohibited' ? 'error' : 'warning', routeId: route.id, relatedKind: 'area', relatedId: area.id, message: `${route.id} crosses ${area.id} (${area.resourcePlacementPolicy.toLowerCase()} policy).` });
    for (const aisle of aisles) {
      const used = routeSegments(points).some((segment) => segmentMidpointInCorridor(segment.start, segment.end, aisle));
      if (used && !compatibleAisles[route.routeType].includes(aisle.aisleType)) report({ type: 'aisle-compatibility', severity: 'warning', routeId: route.id, relatedKind: 'aisle', relatedId: aisle.id, message: `${route.id} (${route.routeType}) uses incompatible ${aisle.aisleType} aisle ${aisle.id}.` });
    }
    if (route.routeType === 'Material' || route.routeType === 'Forklift' || route.routeType === 'AGV' || route.routeType === 'Tugger') {
      const segments = routeSegments(points); const uncovered = segments.filter((segment, index) => index !== 0 && index !== segments.length - 1 && !aisles.some((aisle) => compatibleAisles[route.routeType].includes(aisle.aisleType) && segmentMidpointInCorridor(segment.start, segment.end, aisle))).reduce((sum, segment) => sum + segment.length, 0);
      if (uncovered > ROUTE_ENDPOINT_APPROACH_ALLOWANCE) report({ type: 'aisle-coverage', severity: 'warning', routeId: route.id, message: `${route.id} has ${uncovered.toFixed(1)} project units outside a compatible aisle.` });
    }
  }

  const countsByType = Object.fromEntries(ROUTE_TYPES.map((type) => [type, 0])) as Record<FactoryRouteType, number>;
  const distanceByType = Object.fromEntries(ROUTE_TYPES.map((type) => [type, 0])) as Record<FactoryRouteType, number>;
  for (const route of source.routes.getRoutes()) { countsByType[route.routeType] += 1; distanceByType[route.routeType] += factoryRouteDistance(route, resolver); }
  return { total: source.routes.getCount(), enabled: source.routes.getRoutes().filter((route) => route.enabled).length, countsByType, distanceByType, withNominalSpeed: source.routes.getRoutes().filter((route) => route.nominalSpeed !== null).length, errors: issues.filter((issue) => issue.severity === 'error').length, warnings: issues.filter((issue) => issue.severity === 'warning').length, issues };
}

export function routeValidationIssues(routeId: string, summary: FactoryRouteSummary): readonly FactoryRouteIssue[] { return summary.issues.filter((issue) => issue.routeId === routeId); }
