import type { FactoryArea } from '../models/factory/FactoryArea';
import type { FactoryStructureKind, FactoryStructureStore } from './FactoryStructureStore';
import type { ResourceInstance } from '../models/resources/ResourceInstance';
import { clearancePolygon, footprintPolygon, polygonsOverlap, rectangleCorners } from './geometry/FactoryFootprintGeometry';
import { aisleCorridorRectangles, polygonContainedByBoundary, polygonIntersectsAny, polylineLength, validateOrthogonalPolygon, validateOrthogonalPolyline, wallLength, wallRectangle } from './geometry/FactoryStructureGeometry';

export type FactoryStructureIssueType = 'invalid-geometry' | 'outside-boundary' | 'resource-wall' | 'clearance-wall' | 'resource-area-policy' | 'aisle-resource' | 'aisle-wall' | 'aisle-area';
export interface FactoryStructureIssue {
  readonly type: FactoryStructureIssueType;
  readonly severity: 'error' | 'warning';
  readonly entityKind: FactoryStructureKind | 'resource';
  readonly entityId: string;
  readonly relatedEntityKind?: FactoryStructureKind | 'resource';
  readonly relatedEntityId?: string;
  readonly message: string;
}
export interface FactoryStructureSummary {
  readonly boundaryArea: number;
  readonly boundaryWidth: number;
  readonly boundaryDepth: number;
  readonly wallCount: number;
  readonly totalWallLength: number;
  readonly areaCount: number;
  readonly areaCountsByType: Readonly<Record<string, number>>;
  readonly aisleCount: number;
  readonly totalAisleLength: number;
  readonly issues: readonly FactoryStructureIssue[];
}

const areaPolygon = (area: FactoryArea) => rectangleCorners({ x: area.worldX, y: area.worldY }, area.width, area.depth, area.rotationDegrees);

export function validateFactoryStructure(resources: readonly ResourceInstance[], structure: FactoryStructureStore): FactoryStructureSummary {
  const boundary = structure.getActiveBoundary(); const boundaryPoints = boundary?.points ?? null; const issues: FactoryStructureIssue[] = [];
  const reportOutside = (entityKind: FactoryStructureKind | 'resource', entityId: string, severity: 'error' | 'warning', label: string): void => { issues.push({ type: 'outside-boundary', severity, entityKind, entityId, message: `${label} extends outside the factory boundary.` }); };
  if (boundary) { const validation = validateOrthogonalPolygon(boundary.points); if (!validation.valid) issues.push({ type: 'invalid-geometry', severity: 'error', entityKind: 'boundary', entityId: boundary.id, message: validation.issues.join(' ') }); }
  const walls = structure.getWalls(); const areas = structure.getAreas(); const aisles = structure.getAisles();
  for (const wall of walls) {
    const polygon = wallRectangle(wall);
    if (!(wall.start.x === wall.end.x || wall.start.y === wall.end.y) || wallLength(wall) <= 0 || wall.thickness <= 0) issues.push({ type: 'invalid-geometry', severity: 'error', entityKind: 'wall', entityId: wall.id, message: `${wall.id} has invalid orthogonal wall geometry.` });
    if (boundaryPoints && !polygonContainedByBoundary(polygon, boundaryPoints)) reportOutside('wall', wall.id, 'error', wall.id);
  }
  for (const area of areas) {
    const polygon = areaPolygon(area);
    if (boundaryPoints && !polygonContainedByBoundary(polygon, boundaryPoints)) reportOutside('area', area.id, area.resourcePlacementPolicy === 'Prohibited' ? 'error' : 'warning', area.id);
  }
  for (const aisle of aisles) {
    const corridors = aisleCorridorRectangles(aisle); const geometryIssues = validateOrthogonalPolyline(aisle.points);
    if (geometryIssues.length || aisle.width <= 0) issues.push({ type: 'invalid-geometry', severity: 'error', entityKind: 'aisle', entityId: aisle.id, message: geometryIssues.join(' ') || `${aisle.id} width must be positive.` });
    if (boundaryPoints && corridors.some((polygon) => !polygonContainedByBoundary(polygon, boundaryPoints))) reportOutside('aisle', aisle.id, 'error', aisle.id);
  }
  for (const resource of resources.filter((item) => item.visible)) {
    const footprint = footprintPolygon(resource); const clearance = resource.clearance.enabled ? clearancePolygon(resource) : null;
    if (boundaryPoints && resource.active && !polygonContainedByBoundary(footprint, boundaryPoints)) reportOutside('resource', resource.id, 'error', resource.id);
    if (boundaryPoints && clearance && !polygonContainedByBoundary(clearance, boundaryPoints)) reportOutside('resource', resource.id, 'warning', `${resource.id} clearance`);
    for (const wall of walls.filter((item) => item.visible)) {
      const wallPolygon = wallRectangle(wall);
      if (polygonsOverlap(footprint, wallPolygon)) issues.push({ type: 'resource-wall', severity: resource.active ? 'error' : 'warning', entityKind: 'resource', entityId: resource.id, relatedEntityKind: 'wall', relatedEntityId: wall.id, message: `${resource.id} physical footprint intersects ${wall.id}.` });
      else if (clearance && polygonsOverlap(clearance, wallPolygon)) issues.push({ type: 'clearance-wall', severity: 'warning', entityKind: 'resource', entityId: resource.id, relatedEntityKind: 'wall', relatedEntityId: wall.id, message: `${resource.id} clearance intersects ${wall.id}.` });
    }
    for (const area of areas.filter((item) => item.visible && item.resourcePlacementPolicy !== 'Allowed')) if (polygonsOverlap(footprint, areaPolygon(area))) issues.push({ type: 'resource-area-policy', severity: area.resourcePlacementPolicy === 'Prohibited' ? 'error' : 'warning', entityKind: 'resource', entityId: resource.id, relatedEntityKind: 'area', relatedEntityId: area.id, message: `${resource.id} intersects ${area.id} (${area.resourcePlacementPolicy.toLowerCase()} resource placement).` });
    for (const aisle of aisles.filter((item) => item.visible)) if (polygonIntersectsAny(footprint, aisleCorridorRectangles(aisle))) issues.push({ type: 'aisle-resource', severity: aisle.aisleType === 'Emergency' ? 'error' : 'warning', entityKind: 'aisle', entityId: aisle.id, relatedEntityKind: 'resource', relatedEntityId: resource.id, message: `${resource.id} obstructs ${aisle.id}${aisle.aisleType === 'Emergency' ? ' emergency aisle' : ''}.` });
  }
  for (const aisle of aisles.filter((item) => item.visible)) {
    const corridors = aisleCorridorRectangles(aisle);
    for (const wall of walls.filter((item) => item.visible)) if (polygonIntersectsAny(wallRectangle(wall), corridors)) issues.push({ type: 'aisle-wall', severity: aisle.aisleType === 'Emergency' ? 'error' : 'warning', entityKind: 'aisle', entityId: aisle.id, relatedEntityKind: 'wall', relatedEntityId: wall.id, message: `${wall.id} crosses ${aisle.id}.` });
    for (const area of areas.filter((item) => item.visible && item.resourcePlacementPolicy === 'Prohibited')) if (polygonIntersectsAny(areaPolygon(area), corridors)) issues.push({ type: 'aisle-area', severity: aisle.aisleType === 'Emergency' ? 'error' : 'warning', entityKind: 'aisle', entityId: aisle.id, relatedEntityKind: 'area', relatedEntityId: area.id, message: `${aisle.id} overlaps prohibited area ${area.id}.` });
  }
  const bounds = boundaryPoints ? { minX: Math.min(...boundaryPoints.map((point) => point.x)), maxX: Math.max(...boundaryPoints.map((point) => point.x)), minY: Math.min(...boundaryPoints.map((point) => point.y)), maxY: Math.max(...boundaryPoints.map((point) => point.y)) } : null;
  const areaCountsByType: Record<string, number> = {}; for (const area of areas) areaCountsByType[area.areaType] = (areaCountsByType[area.areaType] ?? 0) + 1;
  return { boundaryArea: boundary ? Math.abs(validateOrthogonalPolygon(boundary.points).area) : 0, boundaryWidth: bounds ? bounds.maxX - bounds.minX : 0, boundaryDepth: bounds ? bounds.maxY - bounds.minY : 0, wallCount: walls.length, totalWallLength: walls.reduce((sum, wall) => sum + wallLength(wall), 0), areaCount: areas.length, areaCountsByType, aisleCount: aisles.length, totalAisleLength: aisles.reduce((sum, aisle) => sum + polylineLength(aisle.points), 0), issues };
}
