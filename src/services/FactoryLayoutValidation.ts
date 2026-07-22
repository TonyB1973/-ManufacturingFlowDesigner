import type { ResourceInstance } from '../models/resources/ResourceInstance';
import { clearancePolygon, footprintPolygon, polygonAabb, polygonsOverlap, type GeometryAabb } from './geometry/FactoryFootprintGeometry';

export type FactoryLayoutIssueType = 'footprint-overlap' | 'clearance-footprint' | 'clearance-overlap';
export interface FactoryLayoutIssue {
  readonly type: FactoryLayoutIssueType;
  readonly severity: 'error' | 'warning';
  readonly resourceIds: readonly [string, string];
  readonly message: string;
}
export interface FactoryLayoutSummary {
  readonly total: number;
  readonly active: number;
  readonly clearanceEnabled: number;
  readonly footprintArea: number;
  readonly footprintExtents: GeometryAabb | null;
  readonly clearanceExtents: GeometryAabb | null;
  readonly issues: readonly FactoryLayoutIssue[];
}

export function validateFactoryLayout(resources: readonly ResourceInstance[]): FactoryLayoutSummary {
  const visible = resources.filter((resource) => resource.visible);
  const footprint = new Map(visible.map((resource) => [resource.id, footprintPolygon(resource)]));
  const clearance = new Map(visible.filter((resource) => resource.clearance.enabled).map((resource) => [resource.id, clearancePolygon(resource)]));
  const issues: FactoryLayoutIssue[] = [];
  for (let leftIndex = 0; leftIndex < visible.length; leftIndex += 1) {
    const left = visible[leftIndex];
    for (let rightIndex = leftIndex + 1; rightIndex < visible.length; rightIndex += 1) {
      const right = visible[rightIndex]; const leftFootprint = footprint.get(left.id)!; const rightFootprint = footprint.get(right.id)!;
      if (left.active && right.active && polygonsOverlap(leftFootprint, rightFootprint)) issues.push({ type: 'footprint-overlap', severity: 'error', resourceIds: [left.id, right.id], message: `Physical footprints overlap: ${left.id} and ${right.id}.` });
      const leftClearance = clearance.get(left.id); const rightClearance = clearance.get(right.id);
      const clearanceTouchesFootprint = Boolean((leftClearance && polygonsOverlap(leftClearance, rightFootprint)) || (rightClearance && polygonsOverlap(rightClearance, leftFootprint)));
      if (clearanceTouchesFootprint) issues.push({ type: 'clearance-footprint', severity: 'warning', resourceIds: [left.id, right.id], message: `Clearance intersects a physical footprint: ${left.id} and ${right.id}.` });
      if (leftClearance && rightClearance && polygonsOverlap(leftClearance, rightClearance)) issues.push({ type: 'clearance-overlap', severity: 'warning', resourceIds: [left.id, right.id], message: `Clearance envelopes overlap: ${left.id} and ${right.id}.` });
    }
  }
  return {
    total: resources.length,
    active: resources.filter((resource) => resource.active).length,
    clearanceEnabled: resources.filter((resource) => resource.clearance.enabled).length,
    footprintArea: resources.filter((resource) => resource.active).reduce((sum, resource) => sum + resource.width * resource.depth, 0),
    footprintExtents: combineExtents([...footprint.values()].map(polygonAabb)),
    clearanceExtents: combineExtents([...clearance.values()].map(polygonAabb)),
    issues,
  };
}

function combineExtents(values: readonly GeometryAabb[]): GeometryAabb | null {
  if (!values.length) return null;
  return values.reduce((result, value) => ({ minX: Math.min(result.minX, value.minX), minY: Math.min(result.minY, value.minY), maxX: Math.max(result.maxX, value.maxX), maxY: Math.max(result.maxY, value.maxY) }));
}

export function issueIdsForResource(summary: FactoryLayoutSummary, resourceId: string): readonly string[] {
  return summary.issues.filter((issue) => issue.resourceIds.includes(resourceId)).flatMap((issue) => issue.resourceIds).filter((id) => id !== resourceId).filter((id, index, all) => all.indexOf(id) === index);
}
