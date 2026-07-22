import {
  APPLICATION_VERSION, PROJECT_FORMAT, PROJECT_SCHEMA_VERSION, type ProjectDocument,
  type ProjectMetadata, type ProjectSettings,
} from '../../models/project/ProjectDocument';
import type { ConnectionStore } from '../ConnectionStore';
import type { OperationStore } from '../OperationStore';
import type { ResourceStore } from '../ResourceStore';
import type { WorkspaceStore } from '../WorkspaceStore';
import type { FactoryStructureStore } from '../FactoryStructureStore';
import type { FactoryRouteStore } from '../FactoryRouteStore';
import { cloneFactoryRoute } from '../../models/factory/FactoryRoute';
import type { FactoryAnnotationStore } from '../FactoryAnnotationStore';
import { cloneFactoryAnnotation } from '../../models/factory/FactoryAnnotation';

export interface ProjectSerializationSource {
  readonly metadata: ProjectMetadata;
  readonly settings: ProjectSettings;
  readonly resources: ResourceStore;
  readonly operations: OperationStore;
  readonly connections: ConnectionStore;
  readonly structure: FactoryStructureStore;
  readonly routes: FactoryRouteStore;
  readonly annotations: FactoryAnnotationStore;
  readonly workspaces: WorkspaceStore;
}

export function createProjectDocument(source: ProjectSerializationSource, modifiedUtc = new Date().toISOString()): ProjectDocument {
  const byId = <T extends { readonly id: string }>(items: readonly T[]): T[] => [...items].sort((left, right) => left.id.localeCompare(right.id));
  return {
    format: PROJECT_FORMAT,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    applicationVersion: APPLICATION_VERSION,
    project: { ...source.metadata, modifiedUtc },
    resourceTemplates: byId(source.resources.getTemplates()).map((item) => ({ ...item, tags: [...item.tags] })),
    operationTemplates: byId(source.operations.getTemplates()).map((item) => ({ ...item, tags: [...item.tags] })),
    resources: byId(source.resources.getPlacedResources()).map(({ selected: _selected, ...item }) => ({ ...item, clearance: { ...item.clearance } })),
    operations: byId(source.operations.getOperations()).map(({ selected: _selected, ...item }) => ({ ...item })),
    connections: byId(source.connections.getConnections()).map(({ selected: _selected, routePoints: _points, routeStatus: _status, ...item }) => ({ ...item, sourceAnchor: { ...item.sourceAnchor }, targetAnchor: { ...item.targetAnchor } })),
    layoutBoundaries: byId(source.structure.getBoundaries()).map((item) => ({ ...item, points: item.points.map((point) => ({ ...point })) })),
    walls: byId(source.structure.getWalls()).map((item) => ({ ...item, start: { ...item.start }, end: { ...item.end } })),
    areas: byId(source.structure.getAreas()).map((item) => ({ ...item })),
    aisles: byId(source.structure.getAisles()).map((item) => ({ ...item, points: item.points.map((point) => ({ ...point })) })),
    factoryRoutes: byId(source.routes.getRoutes()).map(cloneFactoryRoute),
    factoryAnnotations: byId(source.annotations.getAnnotations()).map(cloneFactoryAnnotation),
    workspaces: {
      active: source.workspaces.getActive(),
      processFlow: source.workspaces.getViewport('processFlow'),
      factoryLayout: source.workspaces.getViewport('factoryLayout'),
    },
    settings: { ...source.settings },
  };
}

export function serializeProject(source: ProjectSerializationSource, modifiedUtc?: string): { readonly document: ProjectDocument; readonly text: string } {
  const document = createProjectDocument(source, modifiedUtc);
  return { document, text: `${JSON.stringify(document, null, 2)}\n` };
}
