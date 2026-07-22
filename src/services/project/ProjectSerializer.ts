import {
  APPLICATION_VERSION, PROJECT_FORMAT, PROJECT_SCHEMA_VERSION, type ProjectDocument,
  type ProjectMetadata, type ProjectSettings,
} from '../../models/project/ProjectDocument';
import type { ConnectionStore } from '../ConnectionStore';
import type { OperationStore } from '../OperationStore';
import type { ResourceStore } from '../ResourceStore';
import type { WorkspaceStore } from '../WorkspaceStore';

export interface ProjectSerializationSource {
  readonly metadata: ProjectMetadata;
  readonly settings: ProjectSettings;
  readonly resources: ResourceStore;
  readonly operations: OperationStore;
  readonly connections: ConnectionStore;
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
