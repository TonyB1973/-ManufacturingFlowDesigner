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

const LIMITS = { templates: 2000, resources: 10000, operations: 10000, connections: 20000 } as const;
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const ANCHOR_SIDES = new Set(['top', 'right', 'bottom', 'left']);
const CONNECTION_TYPES = new Set(['Standard', 'Rework', 'Alternate', 'Information']);
const RESOURCE_CATEGORIES = new Set(['Machines', 'Manual Process', 'Quality', 'People', 'Material Handling', 'Documentation', 'General']);
const RESOURCE_TYPES = new Set(['CNC Machine', 'Manual Workstation', 'Inspection', 'Load / Unload', 'Operator', 'Walking', 'Material Buffer', 'Tooling', 'Document', 'Generic Equipment']);
const RESOURCE_ICONS = new Set(['cnc', 'workstation', 'inspection', 'handling', 'operator', 'walking', 'buffer', 'tooling', 'document', 'equipment']);
const OPERATION_TYPES = new Set(['Machining', 'Fabrication', 'Assembly', 'Inspection', 'Material Handling', 'Finishing', 'Packaging', 'Maintenance', 'Storage', 'Administrative']);
const TIMING_CATEGORIES = new Set(['Value Added', 'Non-Value Added', 'Required Non-Value Added']);
const OPERATION_CATEGORIES = new Set(['Production', 'Quality', 'Logistics', 'Support', 'Finishing', 'Assembly', 'Material Flow', 'Storage', 'Planning']);

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
  const workspaces = workspaceValues(root.workspaces, issues);
  const settings = settingsValue(root.settings, issues);

  uniqueIds('resource template', resourceTemplates, issues);
  uniqueIds('operation template', operationTemplates, issues);
  uniqueIds('resource', resources, issues);
  uniqueIds('operation', operations, issues);
  uniqueIds('connection', connections, issues);
  const entityIds = new Set<string>();
  [...resources, ...operations, ...connections].forEach((item) => { if (entityIds.has(item.id)) issues.push(`Project entity id ${item.id} is used by more than one entity type.`); entityIds.add(item.id); });
  const resourceTemplateIds = new Set(resourceTemplates.map((item) => item.id));
  const operationTemplateIds = new Set(operationTemplates.map((item) => item.id));
  const resourceIds = new Set(resources.map((item) => item.id));
  const operationIds = new Set(operations.map((item) => item.id));
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
  if (issues.length) throw new ProjectValidationError(issues);
  return {
    format: PROJECT_FORMAT, schemaVersion: PROJECT_SCHEMA_VERSION, applicationVersion: root.applicationVersion as string,
    project: metadata!, resourceTemplates, operationTemplates, resources, operations, connections,
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
    if (!nonEmpty(item.id) || !nonEmpty(item.name) || !boundedString(item.description) || !RESOURCE_CATEGORIES.has(String(item.category)) || !RESOURCE_TYPES.has(String(item.resourceType)) || !RESOURCE_ICONS.has(String(item.icon)) || !positive(item.defaultWidth) || !positive(item.defaultHeight) || !stringArray(item.tags) || !bool(item.isFavourite)) issues.push(`resourceTemplates[${index}] has invalid fields.`);
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
    if (!nonEmpty(item.id) || !nonEmpty(item.templateId) || !nonEmpty(item.name) || !RESOURCE_TYPES.has(String(item.resourceType)) || item.layoutId !== DEFAULT_FACTORY_LAYOUT_ID || !finite(item.worldX) || !finite(item.worldY) || !finite(item.width) || item.width < 100 || !finite(item.height) || item.height < 60 || !finite(item.rotationDegrees) || !bool(item.active) || !bool(item.visible) || !bool(item.locked) || !Number.isInteger(item.capacity) || (item.capacity as number) < 1) issues.push(`resources[${index}] has invalid fields.`);
    return [item as unknown as Omit<ResourceInstance, 'selected'>];
  });
}
function operationValues(value: unknown, issues: string[]): Omit<OperationInstance, 'selected'>[] {
  return arrayValue(value, 'operations', LIMITS.operations, issues).flatMap((raw, index) => {
    const item = record(raw, `operations[${index}]`, issues); if (!item) return [];
    if (!nonEmpty(item.id) || !nonEmpty(item.templateId) || !nonEmpty(item.name) || !OPERATION_TYPES.has(String(item.operationType)) || !TIMING_CATEGORIES.has(String(item.timingCategory)) || !positive(item.cycleTimeSeconds) || !Number.isInteger(item.sequence) || (item.sequence as number) <= 0 || !(item.assignedResourceId === null || nonEmpty(item.assignedResourceId)) || !boundedString(item.notes) || !finite(item.worldX) || !finite(item.worldY) || !finite(item.width) || item.width < 150 || !finite(item.height) || item.height < 82 || !bool(item.visible) || !bool(item.locked)) issues.push(`operations[${index}] has invalid fields.`);
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
function anchorValue(value: unknown): ProcessConnection['sourceAnchor'] | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  return ANCHOR_SIDES.has(String(item.side)) && finite(item.offset) && item.offset >= 0 && item.offset <= 1 ? item as unknown as ProcessConnection['sourceAnchor'] : null;
}
function workspaceValues(value: unknown, issues: string[]): PersistedWorkspaces | null {
  const item = record(value, 'workspaces', issues); if (!item) return null;
  const processFlow = viewportValue(item.processFlow); const factoryLayout = viewportValue(item.factoryLayout);
  const active = item.active === undefined ? 'processFlow' : item.active;
  if (active !== 'processFlow' && active !== 'factoryLayout') issues.push('workspaces.active is invalid.');
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
  if (!positive(item.gridBaseInterval) || !finite(item.routingClearance) || item.routingClearance < 0 || item.unitSystem !== 'metric' || !finite(item.displayPrecision) || !Number.isInteger(item.displayPrecision) || item.displayPrecision < 0 || item.displayPrecision > 6) issues.push('settings has invalid fields.');
  return item as unknown as ProjectSettings;
}
function uniqueIds(label: string, items: readonly { readonly id: string }[], issues: string[]): void {
  const ids = new Set<string>(); items.forEach((item) => { if (ids.has(item.id)) issues.push(`Duplicate ${label} id ${item.id}.`); ids.add(item.id); });
}
function scanSafety(value: unknown, issues: string[]): void {
  const queue: { value: unknown; depth: number }[] = [{ value, depth: 0 }]; let count = 0;
  while (queue.length) {
    const current = queue.pop()!; count += 1;
    if (count > 200000) { issues.push('Project contains too many nested values.'); return; }
    if (current.depth > 30) { issues.push('Project nesting exceeds the safety limit.'); return; }
    if (!current.value || typeof current.value !== 'object') continue;
    for (const key of Object.keys(current.value)) {
      if (FORBIDDEN_KEYS.has(key)) issues.push(`Forbidden object key "${key}" was found.`);
      queue.push({ value: (current.value as Record<string, unknown>)[key], depth: current.depth + 1 });
    }
  }
}
