import type { ProcessConnection } from '../../models/connections/ProcessConnection';
import type { OperationInstance } from '../../models/operations/OperationInstance';
import type { OperationTemplate } from '../../models/operations/OperationTemplate';
import {
  PROJECT_FORMAT, PROJECT_SCHEMA_VERSION, type ProjectDocument, type ProjectMetadata,
  type ProjectSettings, type PersistedProcessConnection, type PersistedWorkspaces,
} from '../../models/project/ProjectDocument';
import type { ResourceInstance } from '../../models/resources/ResourceInstance';
import type { ResourceTemplate } from '../../models/resources/ResourceTemplate';
import type { WorkspaceViewportState } from '../../models/workspace/Workspace';
import { DEFAULT_FACTORY_LAYOUT_ID } from '../../models/workspace/Workspace';
import { defaultViewport } from '../../models/project/ProjectDocument';
import type { FactoryLayoutBoundary } from '../../models/factory/FactoryLayoutBoundary';
import { FACTORY_WALL_TYPES, type FactoryWall } from '../../models/factory/FactoryWall';
import { FACTORY_AREA_TYPES, RESOURCE_PLACEMENT_POLICIES, type FactoryArea } from '../../models/factory/FactoryArea';
import { FACTORY_AISLE_DIRECTIONS, FACTORY_AISLE_TYPES, type FactoryAisle } from '../../models/factory/FactoryAisle';
import { validateOrthogonalPolygon, validateOrthogonalPolyline } from '../geometry/FactoryStructureGeometry';
import { FACTORY_ROUTE_ANCHOR_SIDES, FACTORY_ROUTE_DIRECTIONS, FACTORY_ROUTE_TYPES, type FactoryRoute, type FactoryRouteEndpoint } from '../../models/factory/FactoryRoute';
import { FACTORY_ANNOTATION_LAYERS, LEADER_ARROW_STYLES, LINEAR_DIMENSION_KINDS, RECTANGLE_ANNOTATION_FEATURES, type AnnotationAnchor, type FactoryAnnotation } from '../../models/factory/FactoryAnnotation';
import { LENGTH_UNITS } from '../units/LengthUnitService';
import { STANDARD_WORK_LIMITS, STANDARD_WORK_TIME_FORMATS, isValidStandardWorkEntry, isValidStandardWorkStudy, type StandardWorkEntry, type StandardWorkStudy } from '../../models/standardWork/StandardWork';

const LIMITS = { templates: 2000, resources: 10000, operations: 10000, connections: 20000, boundaries: 10, walls: 50000, areas: 20000, aisles: 20000, routes: 50000, annotations: 100000, studies: 10000, standardWorkEntries: 500000, boundaryVertices: 50000, aislePoints: 500000, routeWaypoints: 1000000, waypointsPerRoute: 10000, leaderPoints: 1000000, leaderPointsPerAnnotation: 1000 } as const;
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const ANCHOR_SIDES = new Set(['top', 'right', 'bottom', 'left']);
const CONNECTION_TYPES = new Set(['Standard', 'Rework', 'Alternate', 'Information']);
const RESOURCE_CATEGORIES = new Set(['Machines', 'Manual Process', 'Quality', 'People', 'Material Handling', 'Documentation', 'General']);
const RESOURCE_TYPES = new Set(['CNC Machine', 'Manual Workstation', 'Inspection', 'Load / Unload', 'Operator', 'Walking', 'Material Buffer', 'Tooling', 'Document', 'Generic Equipment']);
const RESOURCE_ICONS = new Set(['cnc', 'workstation', 'inspection', 'handling', 'operator', 'walking', 'buffer', 'tooling', 'document', 'equipment']);
const OPERATION_TYPES = new Set(['Machining', 'Fabrication', 'Assembly', 'Inspection', 'Material Handling', 'Finishing', 'Packaging', 'Maintenance', 'Storage', 'Administrative']);
const TIMING_CATEGORIES = new Set(['manual', 'automatic', 'walking', 'waiting']);
const OPERATION_CATEGORIES = new Set(['Production', 'Quality', 'Logistics', 'Support', 'Finishing', 'Assembly', 'Material Flow', 'Storage', 'Planning']);
const CLEARANCE_CATEGORIES = new Set(['operational', 'maintenance', 'safety', 'loading', 'access', 'general']);

export class ProjectValidationError extends Error {
  public constructor(public readonly issues: readonly string[]) {
    super(`The project could not be opened:\n${issues.map((issue) => `• ${issue}`).join('\n')}`);
    this.name = 'ProjectValidationError';
  }
}

export function validateProjectDocument(value: unknown): ProjectDocument {
  const issues: string[] = [];
  scanSafety(value, issues);
  const root = record(value, 'Project document', issues);
  if (!root) throw new ProjectValidationError(issues);
  if (root.format !== PROJECT_FORMAT) issues.push(`format must be "${PROJECT_FORMAT}".`);
  if (root.schemaVersion !== PROJECT_SCHEMA_VERSION) issues.push(`schemaVersion must be "${PROJECT_SCHEMA_VERSION}" after migration.`);
  if (!nonEmpty(root.applicationVersion)) issues.push('applicationVersion must be a non-empty string.');

  const metadata = metadataValue(root.project, issues);
  const resourceTemplates = resourceTemplateValues(root.resourceTemplates, issues);
  const operationTemplates = operationTemplateValues(root.operationTemplates, issues);
  const resources = resourceValues(root.resources, issues);
  const operations = operationValues(root.operations, issues);
  const connections = connectionValues(root.connections, issues);
  const layoutBoundaries = boundaryValues(root.layoutBoundaries, issues);
  const walls = wallValues(root.walls, issues);
  const areas = areaValues(root.areas, issues);
  const aisles = aisleValues(root.aisles, issues);
  const factoryRoutes = factoryRouteValues(root.factoryRoutes, issues);
  const factoryAnnotations = factoryAnnotationValues(root.factoryAnnotations, issues);
  const standardWorkStudies = standardWorkStudyValues(root.standardWorkStudies, issues);
  const standardWorkEntries = standardWorkEntryValues(root.standardWorkEntries, issues);
  const workspaces = workspaceValues(root.workspaces, issues);
  const settings = settingsValue(root.settings, issues);

  uniqueIds('resource template', resourceTemplates, issues);
  uniqueIds('operation template', operationTemplates, issues);
  uniqueIds('resource', resources, issues);
  uniqueIds('operation', operations, issues);
  uniqueIds('connection', connections, issues);
  uniqueIds('boundary', layoutBoundaries, issues); uniqueIds('wall', walls, issues); uniqueIds('area', areas, issues); uniqueIds('aisle', aisles, issues); uniqueIds('factory route', factoryRoutes, issues); uniqueIds('factory annotation', factoryAnnotations, issues);
  uniqueIds('Standard Work study', standardWorkStudies, issues); uniqueIds('Standard Work entry', standardWorkEntries, issues);
  if (layoutBoundaries.filter((item) => item.layoutId === DEFAULT_FACTORY_LAYOUT_ID).length > 1) issues.push('Only one active factory boundary is allowed per layout.');
  const entityIds = new Set<string>();
  [...resources, ...operations, ...connections, ...layoutBoundaries, ...walls, ...areas, ...aisles, ...factoryRoutes, ...factoryAnnotations, ...standardWorkStudies, ...standardWorkEntries].forEach((item) => { if (entityIds.has(item.id)) issues.push(`Project entity id ${item.id} is used by more than one entity type.`); entityIds.add(item.id); });
  const resourceTemplateIds = new Set(resourceTemplates.map((item) => item.id));
  const operationTemplateIds = new Set(operationTemplates.map((item) => item.id));
  const resourceIds = new Set(resources.map((item) => item.id));
  const operationIds = new Set(operations.map((item) => item.id));
  const studyIds = new Set(standardWorkStudies.map((item) => item.id));
  const areaIds = new Set(areas.map((item) => item.id));
  const boundaryIds = new Set(layoutBoundaries.map((item) => item.id)); const wallIds = new Set(walls.map((item) => item.id)); const aisleIds = new Set(aisles.map((item) => item.id)); const routeIds = new Set(factoryRoutes.map((item) => item.id));
  resources.forEach((item) => { if (!resourceTemplateIds.has(item.templateId)) issues.push(`Resource ${item.id} references missing template ${item.templateId}.`); });
  operations.forEach((item) => {
    if (!operationTemplateIds.has(item.templateId)) issues.push(`Operation ${item.id} references missing template ${item.templateId}.`);
    if (item.assignedResourceId !== null && !resourceIds.has(item.assignedResourceId)) issues.push(`Operation ${item.id} references missing physical resource ${item.assignedResourceId}.`);
  });
  const standardPairs = new Set<string>();
  connections.forEach((item) => {
    if (!operationIds.has(item.sourceOperationId) || !operationIds.has(item.targetOperationId)) issues.push(`Connection ${item.id} references a missing operation.`);
    if (item.sourceOperationId === item.targetOperationId) issues.push(`Connection ${item.id} cannot connect an operation to itself.`);
    if (item.connectionType === 'Standard') {
      const pair = `${item.sourceOperationId}\u0000${item.targetOperationId}`;
      if (standardPairs.has(pair)) issues.push(`Connection ${item.id} duplicates a Standard connection.`);
      standardPairs.add(pair);
    }
  });
  const standardWorkPairs = new Set<string>(); const standardWorkCounts = new Map<string, number>();
  standardWorkEntries.forEach((entry) => { if (!studyIds.has(entry.studyId)) issues.push(`Standard Work entry ${entry.id} references missing study ${entry.studyId}.`); if (!operationIds.has(entry.operationId)) issues.push(`Standard Work entry ${entry.id} references missing operation ${entry.operationId}.`); const pair = `${entry.studyId}\u0000${entry.operationId}`; if (standardWorkPairs.has(pair)) issues.push(`Standard Work study ${entry.studyId} contains duplicate operation ${entry.operationId}.`); standardWorkPairs.add(pair); standardWorkCounts.set(entry.studyId, (standardWorkCounts.get(entry.studyId) ?? 0) + 1); });
  standardWorkCounts.forEach((count, studyId) => { if (count > STANDARD_WORK_LIMITS.entriesPerStudy) issues.push(`Standard Work study ${studyId} exceeds ${STANDARD_WORK_LIMITS.entriesPerStudy} entries.`); });
  factoryRoutes.forEach((route) => {
    for (const endpoint of [route.source, route.target]) {
      if (endpoint.kind === 'resource' && !resourceIds.has(endpoint.resourceId)) issues.push(`FactoryRoute ${route.id} references missing physical resource ${endpoint.resourceId}.`);
      if (endpoint.kind === 'area' && !areaIds.has(endpoint.areaId)) issues.push(`FactoryRoute ${route.id} references missing factory area ${endpoint.areaId}.`);
    }
  });
  factoryAnnotations.forEach((annotation) => {
    const anchors = annotation.annotationType === 'linearDimension' ? [annotation.startAnchor, annotation.endAnchor] : annotation.annotationType === 'coordinate' || annotation.annotationType === 'leader' ? [annotation.anchor] : [];
    for (const anchor of anchors) {
      if (anchor.kind === 'resource' && !resourceIds.has(anchor.resourceId)) issues.push(`FactoryAnnotation ${annotation.id} references missing physical resource ${anchor.resourceId}.`);
      if (anchor.kind === 'boundary' && !boundaryIds.has(anchor.boundaryId)) issues.push(`FactoryAnnotation ${annotation.id} references missing boundary ${anchor.boundaryId}.`);
      if (anchor.kind === 'wall' && !wallIds.has(anchor.wallId)) issues.push(`FactoryAnnotation ${annotation.id} references missing wall ${anchor.wallId}.`);
      if (anchor.kind === 'area' && !areaIds.has(anchor.areaId)) issues.push(`FactoryAnnotation ${annotation.id} references missing area ${anchor.areaId}.`);
      if (anchor.kind === 'aisle' && !aisleIds.has(anchor.aisleId)) issues.push(`FactoryAnnotation ${annotation.id} references missing aisle ${anchor.aisleId}.`);
      if (anchor.kind === 'factoryRoute' && !routeIds.has(anchor.factoryRouteId)) issues.push(`FactoryAnnotation ${annotation.id} references missing FactoryRoute ${anchor.factoryRouteId}.`);
      if (anchor.kind === 'boundary') { const entity = layoutBoundaries.find((item) => item.id === anchor.boundaryId); if (entity && (anchor.index < 0 || anchor.index >= entity.points.length)) issues.push(`FactoryAnnotation ${annotation.id} has an invalid boundary anchor index.`); }
      if (anchor.kind === 'aisle') { const entity = aisles.find((item) => item.id === anchor.aisleId); const limit = anchor.feature === 'vertex' ? entity?.points.length ?? 0 : Math.max(0, (entity?.points.length ?? 0) - 1); if (entity && (anchor.index < 0 || anchor.index >= limit)) issues.push(`FactoryAnnotation ${annotation.id} has an invalid aisle anchor index.`); }
      if (anchor.kind === 'factoryRoute' && (anchor.feature === 'waypoint' || anchor.feature === 'segment')) { const entity = factoryRoutes.find((item) => item.id === anchor.factoryRouteId); const index = anchor.index ?? -1; const limit = anchor.feature === 'waypoint' ? entity?.waypoints.length ?? 0 : (entity?.waypoints.length ?? 0) + 1; if (entity && (index < 0 || index >= limit)) issues.push(`FactoryAnnotation ${annotation.id} has an invalid FactoryRoute anchor index.`); }
    }
  });
  if (issues.length) throw new ProjectValidationError(issues);
  return {
    format: PROJECT_FORMAT, schemaVersion: PROJECT_SCHEMA_VERSION, applicationVersion: root.applicationVersion as string,
    project: metadata!, resourceTemplates, operationTemplates, resources, operations, connections, layoutBoundaries, walls, areas, aisles, factoryRoutes, factoryAnnotations, standardWorkStudies, standardWorkEntries,
    workspaces: workspaces!, settings: settings!,
  };
}

function record(value: unknown, label: string, issues: string[]): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) { issues.push(`${label} must be an object.`); return null; }
  return value as Record<string, unknown>;
}
function nonEmpty(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0; }
function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }
function positive(value: unknown): value is number { return finite(value) && value > 0; }
function bool(value: unknown): value is boolean { return typeof value === 'boolean'; }
function boundedString(value: unknown, maximum = 10000): value is string { return typeof value === 'string' && value.length <= maximum; }
function isoUtc(value: unknown): value is string { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) && Number.isFinite(Date.parse(value)); }
function stringArray(value: unknown): value is string[] { return Array.isArray(value) && value.length <= 200 && value.every((item) => boundedString(item, 100)); }
function arrayValue(value: unknown, label: string, maximum: number, issues: string[]): unknown[] {
  if (!Array.isArray(value)) { issues.push(`${label} must be an array.`); return []; }
  if (value.length > maximum) issues.push(`${label} exceeds the safety limit of ${maximum}.`);
  return value.slice(0, maximum);
}

function metadataValue(value: unknown, issues: string[]): ProjectMetadata | null {
  const item = record(value, 'project', issues); if (!item) return null;
  if (!nonEmpty(item.id) || !boundedString(item.id, 200)) issues.push('project.id must be a non-empty bounded string.');
  if (!nonEmpty(item.name) || !boundedString(item.name, 200)) issues.push('project.name must be a non-empty bounded string.');
  for (const field of ['description', 'author', 'company'] as const) if (!boundedString(item[field], field === 'description' ? 10000 : 200)) issues.push(`project.${field} must be a bounded string.`);
  for (const field of ['createdUtc', 'modifiedUtc'] as const) if (!isoUtc(item[field])) issues.push(`project.${field} must be an ISO 8601 UTC date.`);
  return item as unknown as ProjectMetadata;
}

function resourceTemplateValues(value: unknown, issues: string[]): ResourceTemplate[] {
  return arrayValue(value, 'resourceTemplates', LIMITS.templates, issues).flatMap((raw, index) => {
    const item = record(raw, `resourceTemplates[${index}]`, issues); if (!item) return [];
    if (!nonEmpty(item.id) || !nonEmpty(item.name) || !boundedString(item.description) || !RESOURCE_CATEGORIES.has(String(item.category)) || !RESOURCE_TYPES.has(String(item.resourceType)) || !RESOURCE_ICONS.has(String(item.icon)) || !positive(item.defaultWidth) || !positive(item.defaultDepth) || !stringArray(item.tags) || !bool(item.isFavourite)) issues.push(`resourceTemplates[${index}] has invalid fields.`);
    return [item as unknown as ResourceTemplate];
  });
}
function operationTemplateValues(value: unknown, issues: string[]): OperationTemplate[] {
  return arrayValue(value, 'operationTemplates', LIMITS.templates, issues).flatMap((raw, index) => {
    const item = record(raw, `operationTemplates[${index}]`, issues); if (!item) return [];
    if (!nonEmpty(item.id) || !nonEmpty(item.name) || !OPERATION_TYPES.has(String(item.operationType)) || !TIMING_CATEGORIES.has(String(item.timingCategory)) || !OPERATION_CATEGORIES.has(String(item.category)) || !boundedString(item.icon, 50) || !positive(item.defaultCycleTimeSeconds) || !stringArray(item.tags)) issues.push(`operationTemplates[${index}] has invalid fields.`);
    return [item as unknown as OperationTemplate];
  });
}
function resourceValues(value: unknown, issues: string[]): Omit<ResourceInstance, 'selected'>[] {
  return arrayValue(value, 'resources', LIMITS.resources, issues).flatMap((raw, index) => {
    const item = record(raw, `resources[${index}]`, issues); if (!item) return [];
    const clearance = record(item.clearance, `resources[${index}].clearance`, issues);
    const validClearance = clearance && bool(clearance.enabled) && [clearance.left, clearance.right, clearance.top, clearance.bottom].every((distance) => finite(distance) && distance >= 0) && CLEARANCE_CATEGORIES.has(String(clearance.category)) && boundedString(clearance.note, 1000);
    if (!nonEmpty(item.id) || !nonEmpty(item.templateId) || !nonEmpty(item.name) || !RESOURCE_TYPES.has(String(item.resourceType)) || item.layoutId !== DEFAULT_FACTORY_LAYOUT_ID || !finite(item.worldX) || !finite(item.worldY) || !finite(item.width) || item.width < 100 || !finite(item.depth) || item.depth < 60 || !finite(item.rotationDegrees) || item.rotationDegrees < 0 || item.rotationDegrees >= 360 || !validClearance || !bool(item.active) || !bool(item.visible) || !bool(item.locked) || !Number.isInteger(item.capacity) || (item.capacity as number) < 1) issues.push(`resources[${index}] has invalid fields.`);
    return [item as unknown as Omit<ResourceInstance, 'selected'>];
  });
}
function operationValues(value: unknown, issues: string[]): Omit<OperationInstance, 'selected'>[] {
  return arrayValue(value, 'operations', LIMITS.operations, issues).flatMap((raw, index) => {
    const item = record(raw, `operations[${index}]`, issues); if (!item) return [];
    if (!nonEmpty(item.id) || !nonEmpty(item.templateId) || !nonEmpty(item.name) || !OPERATION_TYPES.has(String(item.operationType)) || !TIMING_CATEGORIES.has(String(item.timingCategory)) || !finite(item.cycleTimeSeconds) || item.cycleTimeSeconds < 0 || !Number.isInteger(item.sequence) || (item.sequence as number) <= 0 || !(item.assignedResourceId === null || nonEmpty(item.assignedResourceId)) || !boundedString(item.notes) || !finite(item.worldX) || !finite(item.worldY) || !finite(item.width) || item.width < 150 || !finite(item.height) || item.height < 82 || !bool(item.visible) || !bool(item.locked)) issues.push(`operations[${index}] has invalid fields.`);
    return [item as unknown as Omit<OperationInstance, 'selected'>];
  });
}
function connectionValues(value: unknown, issues: string[]): PersistedProcessConnection[] {
  return arrayValue(value, 'connections', LIMITS.connections, issues).flatMap((raw, index) => {
    const item = record(raw, `connections[${index}]`, issues); if (!item) return [];
    const source = anchorValue(item.sourceAnchor); const target = anchorValue(item.targetAnchor);
    if (!nonEmpty(item.id) || !nonEmpty(item.sourceOperationId) || !nonEmpty(item.targetOperationId) || !source || !target || !boundedString(item.label, 120) || !CONNECTION_TYPES.has(String(item.connectionType)) || !bool(item.visible) || !bool(item.locked)) issues.push(`connections[${index}] has invalid fields.`);
    return [{ ...item, sourceAnchor: source ?? item.sourceAnchor, targetAnchor: target ?? item.targetAnchor } as unknown as PersistedProcessConnection];
  });
}
function pointValue(value: unknown): { x: number; y: number } | null { if (!value || typeof value !== 'object' || Array.isArray(value)) return null; const item = value as Record<string, unknown>; return finite(item.x) && finite(item.y) ? { x: item.x, y: item.y } : null; }
function pointsValue(value: unknown, label: string, maximum: number, issues: string[]): { x: number; y: number }[] { return arrayValue(value, label, maximum, issues).flatMap((raw, index) => { const point = pointValue(raw); if (!point) issues.push(`${label}[${index}] is not a finite world point.`); return point ? [point] : []; }); }
function validStructureCommon(item: Record<string, unknown>): boolean { return nonEmpty(item.id) && item.layoutId === DEFAULT_FACTORY_LAYOUT_ID && nonEmpty(item.name) && boundedString(item.note) && bool(item.visible) && bool(item.locked); }
function boundaryValues(value: unknown, issues: string[]): FactoryLayoutBoundary[] {
  let totalVertices = 0;
  const result = arrayValue(value, 'layoutBoundaries', LIMITS.boundaries, issues).flatMap((raw, index) => { const item = record(raw, `layoutBoundaries[${index}]`, issues); if (!item) return []; const points = pointsValue(item.points, `layoutBoundaries[${index}].points`, LIMITS.boundaryVertices, issues); totalVertices += points.length; const geometry = validateOrthogonalPolygon(points); if (!validStructureCommon(item) || !bool(item.fillVisible) || !geometry.valid) issues.push(`layoutBoundaries[${index}] has invalid fields or geometry: ${geometry.issues.join(' ')}`); return [{ ...item, points: geometry.points } as unknown as FactoryLayoutBoundary]; });
  if (totalVertices > LIMITS.boundaryVertices) issues.push(`Total boundary vertices exceed the safety limit of ${LIMITS.boundaryVertices}.`); return result;
}
function wallValues(value: unknown, issues: string[]): FactoryWall[] {
  return arrayValue(value, 'walls', LIMITS.walls, issues).flatMap((raw, index) => { const item = record(raw, `walls[${index}]`, issues); if (!item) return []; const start = pointValue(item.start); const end = pointValue(item.end); if (!validStructureCommon(item) || !start || !end || !(start.x === end.x || start.y === end.y) || (start.x === end.x && start.y === end.y) || !positive(item.thickness) || !FACTORY_WALL_TYPES.includes(item.wallType as never)) issues.push(`walls[${index}] has invalid fields or geometry.`); return start && end ? [{ ...item, start, end } as unknown as FactoryWall] : []; });
}
function areaValues(value: unknown, issues: string[]): FactoryArea[] {
  return arrayValue(value, 'areas', LIMITS.areas, issues).flatMap((raw, index) => { const item = record(raw, `areas[${index}]`, issues); if (!item) return []; if (!validStructureCommon(item) || !FACTORY_AREA_TYPES.includes(item.areaType as never) || !RESOURCE_PLACEMENT_POLICIES.includes(item.resourcePlacementPolicy as never) || !finite(item.worldX) || !finite(item.worldY) || !positive(item.width) || !positive(item.depth) || !finite(item.rotationDegrees) || item.rotationDegrees < 0 || item.rotationDegrees >= 360 || !bool(item.fillVisible)) issues.push(`areas[${index}] has invalid fields.`); return [item as unknown as FactoryArea]; });
}
function aisleValues(value: unknown, issues: string[]): FactoryAisle[] {
  let totalPoints = 0;
  const result = arrayValue(value, 'aisles', LIMITS.aisles, issues).flatMap((raw, index) => { const item = record(raw, `aisles[${index}]`, issues); if (!item) return []; const points = pointsValue(item.points, `aisles[${index}].points`, LIMITS.aislePoints, issues); totalPoints += points.length; const geometryIssues = validateOrthogonalPolyline(points); if (!validStructureCommon(item) || !positive(item.width) || !FACTORY_AISLE_TYPES.includes(item.aisleType as never) || !FACTORY_AISLE_DIRECTIONS.includes(item.direction as never) || geometryIssues.length) issues.push(`aisles[${index}] has invalid fields or geometry: ${geometryIssues.join(' ')}`); return [{ ...item, points } as unknown as FactoryAisle]; });
  if (totalPoints > LIMITS.aislePoints) issues.push(`Total aisle points exceed the safety limit of ${LIMITS.aislePoints}.`); return result;
}
function factoryRouteValues(value: unknown, issues: string[]): FactoryRoute[] {
  let totalWaypoints = 0;
  const result = arrayValue(value, 'factoryRoutes', LIMITS.routes, issues).flatMap((raw, index) => {
    const item = record(raw, `factoryRoutes[${index}]`, issues); if (!item) return [];
    const source = factoryRouteEndpointValue(item.source); const target = factoryRouteEndpointValue(item.target);
    const waypoints = pointsValue(item.waypoints, `factoryRoutes[${index}].waypoints`, LIMITS.waypointsPerRoute, issues); totalWaypoints += waypoints.length;
    const geometryIssues = waypoints.length > 1 ? validateOrthogonalPolyline(waypoints) : [];
    const nominalSpeedValid = item.nominalSpeed === null || positive(item.nominalSpeed);
    if (!nonEmpty(item.id) || !/^FRT-\d+$/.test(String(item.id)) || item.layoutId !== DEFAULT_FACTORY_LAYOUT_ID || !nonEmpty(item.name) || !boundedString(item.name, 200) || !FACTORY_ROUTE_TYPES.includes(item.routeType as never) || !FACTORY_ROUTE_DIRECTIONS.includes(item.direction as never) || !source || !target || geometryIssues.length || !bool(item.visible) || !bool(item.locked) || !bool(item.enabled) || !nominalSpeedValid || !boundedString(item.note)) issues.push(`factoryRoutes[${index}] has invalid fields or geometry${geometryIssues.length ? `: ${geometryIssues.join(' ')}` : '.'}`);
    return source && target ? [{ ...item, source, target, waypoints } as unknown as FactoryRoute] : [];
  });
  if (totalWaypoints > LIMITS.routeWaypoints) issues.push(`Total FactoryRoute waypoints exceed the safety limit of ${LIMITS.routeWaypoints}.`);
  return result;
}
function factoryRouteEndpointValue(value: unknown): FactoryRouteEndpoint | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (item.kind === 'free') { const point = pointValue(item.point); return point ? { kind: 'free', point } : null; }
  if (!FACTORY_ROUTE_ANCHOR_SIDES.includes(item.anchorSide as never) || !finite(item.anchorOffset) || item.anchorOffset < 0 || item.anchorOffset > 1) return null;
  if (item.kind === 'resource' && nonEmpty(item.resourceId)) return { kind: 'resource', resourceId: item.resourceId, anchorSide: item.anchorSide as Extract<FactoryRouteEndpoint, { kind: 'resource' }>['anchorSide'], anchorOffset: item.anchorOffset };
  if (item.kind === 'area' && nonEmpty(item.areaId)) return { kind: 'area', areaId: item.areaId, anchorSide: item.anchorSide as Extract<FactoryRouteEndpoint, { kind: 'area' }>['anchorSide'], anchorOffset: item.anchorOffset };
  return null;
}
function annotationAnchorValue(value: unknown): AnnotationAnchor | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null; const item = value as Record<string, unknown>;
  if (item.kind === 'free') { const point = pointValue(item.point); return point ? { kind: 'free', point } : null; }
  const validOptionalOffset = item.offset === undefined || finite(item.offset) && item.offset >= 0 && item.offset <= 1;
  const validRectangleFeature = RECTANGLE_ANNOTATION_FEATURES.includes(item.feature as never) && validOptionalOffset && (item.feature !== 'perimeter' || ANCHOR_SIDES.has(String(item.side)));
  if (item.kind === 'resource' && nonEmpty(item.resourceId) && validRectangleFeature) return { kind: 'resource', resourceId: item.resourceId, feature: item.feature as never, ...(item.side !== undefined ? { side: item.side as never } : {}), ...(item.offset !== undefined ? { offset: item.offset as number } : {}) };
  if (item.kind === 'area' && nonEmpty(item.areaId) && validRectangleFeature) return { kind: 'area', areaId: item.areaId, feature: item.feature as never, ...(item.side !== undefined ? { side: item.side as never } : {}), ...(item.offset !== undefined ? { offset: item.offset as number } : {}) };
  if (item.kind === 'boundary' && nonEmpty(item.boundaryId) && (item.feature === 'vertex' || item.feature === 'edge') && Number.isInteger(item.index) && Number(item.index) >= 0 && validOptionalOffset) return { kind: 'boundary', boundaryId: item.boundaryId, feature: item.feature, index: item.index as number, ...(item.offset !== undefined ? { offset: item.offset as number } : {}) };
  if (item.kind === 'wall' && nonEmpty(item.wallId) && ['start', 'centre', 'end', 'edge'].includes(String(item.feature)) && validOptionalOffset) return { kind: 'wall', wallId: item.wallId, feature: item.feature as never, ...(item.offset !== undefined ? { offset: item.offset as number } : {}) };
  if (item.kind === 'aisle' && nonEmpty(item.aisleId) && (item.feature === 'vertex' || item.feature === 'segment') && Number.isInteger(item.index) && Number(item.index) >= 0 && validOptionalOffset) return { kind: 'aisle', aisleId: item.aisleId, feature: item.feature, index: item.index as number, ...(item.offset !== undefined ? { offset: item.offset as number } : {}) };
  if (item.kind === 'factoryRoute' && nonEmpty(item.factoryRouteId) && ['source', 'target', 'waypoint', 'segment'].includes(String(item.feature)) && (item.feature === 'source' || item.feature === 'target' || Number.isInteger(item.index) && Number(item.index) >= 0) && validOptionalOffset) return { kind: 'factoryRoute', factoryRouteId: item.factoryRouteId, feature: item.feature as never, ...(item.index !== undefined ? { index: item.index as number } : {}), ...(item.offset !== undefined ? { offset: item.offset as number } : {}) };
  return null;
}
function validAnnotationCommon(item: Record<string, unknown>): boolean { return nonEmpty(item.id) && /^ANN-\d+$/.test(String(item.id)) && item.layoutId === DEFAULT_FACTORY_LAYOUT_ID && FACTORY_ANNOTATION_LAYERS.includes(item.layer as never) && bool(item.visible) && bool(item.locked) && boundedString(item.note) && isoUtc(item.createdUtc); }
function factoryAnnotationValues(value: unknown, issues: string[]): FactoryAnnotation[] {
  let leaderPoints = 0;
  const result = arrayValue(value, 'factoryAnnotations', LIMITS.annotations, issues).flatMap((raw, index) => {
    const item = record(raw, `factoryAnnotations[${index}]`, issues); if (!item) return [];
    let valid = validAnnotationCommon(item);
    if (item.annotationType === 'linearDimension') { const start = annotationAnchorValue(item.startAnchor); const end = annotationAnchorValue(item.endAnchor); valid &&= Boolean(start && end && LINEAR_DIMENSION_KINDS.includes(item.dimensionKind as never) && finite(item.offset) && finite(item.textPosition) && item.textPosition >= 0 && item.textPosition <= 1 && boundedString(item.textOverride, 20000) && boundedString(item.prefix, 200) && boundedString(item.suffix, 200) && bool(item.showUnit) && (item.precisionOverride === null || Number.isInteger(item.precisionOverride) && Number(item.precisionOverride) >= 0 && Number(item.precisionOverride) <= 6)); if (!valid) issues.push(`factoryAnnotations[${index}] has invalid linear dimension fields.`); return start && end ? [{ ...item, startAnchor: start, endAnchor: end } as unknown as FactoryAnnotation] : []; }
    if (item.annotationType === 'coordinate') { const anchor = annotationAnchorValue(item.anchor); const labelOffset = pointValue(item.labelOffset); valid &&= Boolean(anchor && labelOffset && bool(item.showX) && bool(item.showY) && (item.showX || item.showY) && boundedString(item.prefix, 200) && boundedString(item.suffix, 200) && (item.precisionOverride === null || Number.isInteger(item.precisionOverride) && Number(item.precisionOverride) >= 0 && Number(item.precisionOverride) <= 6)); if (!valid) issues.push(`factoryAnnotations[${index}] has invalid coordinate fields.`); return anchor && labelOffset ? [{ ...item, anchor, labelOffset } as unknown as FactoryAnnotation] : []; }
    if (item.annotationType === 'text') { const worldPosition = pointValue(item.worldPosition); valid &&= Boolean(worldPosition && boundedString(item.text, 20000) && positive(item.textSize) && item.textSize <= 200 && ['left', 'centre', 'right'].includes(String(item.textAlign)) && finite(item.rotationDegrees) && bool(item.backgroundEnabled) && bool(item.borderEnabled)); if (!valid) issues.push(`factoryAnnotations[${index}] has invalid text fields.`); return worldPosition ? [{ ...item, worldPosition } as unknown as FactoryAnnotation] : []; }
    if (item.annotationType === 'leader') { const anchor = annotationAnchorValue(item.anchor); const textPosition = pointValue(item.textPosition); const elbowPoints = pointsValue(item.elbowPoints, `factoryAnnotations[${index}].elbowPoints`, LIMITS.leaderPointsPerAnnotation, issues); leaderPoints += elbowPoints.length; valid &&= Boolean(anchor && textPosition && boundedString(item.text, 20000) && positive(item.textSize) && item.textSize <= 200 && LEADER_ARROW_STYLES.includes(item.arrowStyle as never)); if (!valid) issues.push(`factoryAnnotations[${index}] has invalid leader fields.`); return anchor && textPosition ? [{ ...item, anchor, textPosition, elbowPoints } as unknown as FactoryAnnotation] : []; }
    issues.push(`factoryAnnotations[${index}] has an unrecognised annotation type.`); return [];
  });
  if (leaderPoints > LIMITS.leaderPoints) issues.push(`Total leader points exceed the safety limit of ${LIMITS.leaderPoints}.`); return result;
}
function standardWorkStudyValues(value: unknown, issues: string[]): StandardWorkStudy[] {
  return arrayValue(value, 'standardWorkStudies', LIMITS.studies, issues).flatMap((raw, index) => { const item = record(raw, `standardWorkStudies[${index}]`, issues); if (!item) return []; const study = item as unknown as StandardWorkStudy; if (!isValidStandardWorkStudy(study)) issues.push(`standardWorkStudies[${index}] has invalid fields.`); return [study]; });
}
function standardWorkEntryValues(value: unknown, issues: string[]): StandardWorkEntry[] {
  return arrayValue(value, 'standardWorkEntries', LIMITS.standardWorkEntries, issues).flatMap((raw, index) => { const item = record(raw, `standardWorkEntries[${index}]`, issues); if (!item) return []; const entry = item as unknown as StandardWorkEntry; if (!isValidStandardWorkEntry(entry)) issues.push(`standardWorkEntries[${index}] has invalid fields.`); return [entry]; });
}
function anchorValue(value: unknown): ProcessConnection['sourceAnchor'] | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  return ANCHOR_SIDES.has(String(item.side)) && finite(item.offset) && item.offset >= 0 && item.offset <= 1 ? item as unknown as ProcessConnection['sourceAnchor'] : null;
}
function workspaceValues(value: unknown, issues: string[]): PersistedWorkspaces | null {
  const item = record(value, 'workspaces', issues); if (!item) return null;
  const processFlow = viewportValue(item.processFlow); const factoryLayout = viewportValue(item.factoryLayout);
  const active = item.active === undefined ? 'processFlow' : item.active;
  if (active !== 'processFlow' && active !== 'factoryLayout' && active !== 'standardWork') issues.push('workspaces.active is invalid.');
  if (!processFlow || !factoryLayout) issues.push('Workspace viewport state is invalid.');
  return processFlow && factoryLayout ? { active: active as PersistedWorkspaces['active'], processFlow, factoryLayout } : null;
}
function viewportValue(value: unknown): WorkspaceViewportState | null {
  const defaults = defaultViewport();
  if (value === undefined) return defaults;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const panX = item.panX ?? defaults.panX; const panY = item.panY ?? defaults.panY; const zoom = item.zoom ?? defaults.zoom;
  const gridVisible = item.gridVisible ?? defaults.gridVisible; const originVisible = item.originVisible ?? defaults.originVisible; const snapEnabled = item.snapEnabled ?? defaults.snapEnabled;
  if (!finite(panX) || !finite(panY) || !finite(zoom) || !bool(gridVisible) || !bool(originVisible) || !bool(snapEnabled)) return null;
  return { panX, panY, zoom: Math.min(4, Math.max(0.1, zoom)), gridVisible, originVisible, snapEnabled };
}
function settingsValue(value: unknown, issues: string[]): ProjectSettings | null {
  const item = record(value, 'settings', issues); if (!item) return null;
  const units = record(item.units, 'settings.units', issues);
  const validUnits = units && LENGTH_UNITS.includes(units.modelLengthUnit as never) && LENGTH_UNITS.includes(units.displayLengthUnit as never) && Number.isInteger(units.displayPrecision) && Number(units.displayPrecision) >= 0 && Number(units.displayPrecision) <= 6 && bool(units.showTrailingZeros);
  const standardWork = record(item.standardWork, 'settings.standardWork', issues); const validStandardWork = standardWork && STANDARD_WORK_TIME_FORMATS.includes(standardWork.timeFormat as never);
  if (!positive(item.gridBaseInterval) || !finite(item.routingClearance) || item.routingClearance < 0 || item.unitSystem !== 'metric' || !finite(item.displayPrecision) || !Number.isInteger(item.displayPrecision) || item.displayPrecision < 0 || item.displayPrecision > 6 || !validUnits || !validStandardWork || !positive(item.dimensionTextScale) || !positive(item.annotationTextSize) || !positive(item.defaultDimensionOffset) || !FACTORY_ANNOTATION_LAYERS.includes(item.defaultDimensionLayer as never)) issues.push('settings has invalid fields.');
  return item as unknown as ProjectSettings;
}
function uniqueIds(label: string, items: readonly { readonly id: string }[], issues: string[]): void {
  const ids = new Set<string>(); items.forEach((item) => { if (ids.has(item.id)) issues.push(`Duplicate ${label} id ${item.id}.`); ids.add(item.id); });
}
function scanSafety(value: unknown, issues: string[]): void {
  const queue: { value: unknown; depth: number }[] = [{ value, depth: 0 }]; let count = 0;
  while (queue.length) {
    const current = queue.pop()!; count += 1;
    if (count > 2000000) { issues.push('Project contains too many nested values.'); return; }
    if (current.depth > 30) { issues.push('Project nesting exceeds the safety limit.'); return; }
    if (!current.value || typeof current.value !== 'object') continue;
    for (const key of Object.keys(current.value)) {
      if (FORBIDDEN_KEYS.has(key)) issues.push(`Forbidden object key "${key}" was found.`);
      queue.push({ value: (current.value as Record<string, unknown>)[key], depth: current.depth + 1 });
    }
  }
}
