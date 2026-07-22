import type { ProcessConnection } from '../connections/ProcessConnection';
import type { OperationInstance } from '../operations/OperationInstance';
import type { OperationTemplate } from '../operations/OperationTemplate';
import type { ResourceInstance } from '../resources/ResourceInstance';
import type { ResourceTemplate } from '../resources/ResourceTemplate';
import type { WorkspaceId, WorkspaceViewportState } from '../workspace/Workspace';
import type { FactoryLayoutBoundary } from '../factory/FactoryLayoutBoundary';
import type { FactoryWall } from '../factory/FactoryWall';
import type { FactoryArea } from '../factory/FactoryArea';
import type { FactoryAisle } from '../factory/FactoryAisle';
import type { FactoryRoute } from '../factory/FactoryRoute';

export const PROJECT_FORMAT = 'ManufacturingFlowDesigner' as const;
export const PROJECT_SCHEMA_VERSION = '1.3.0' as const;
export const APPLICATION_VERSION = '0.5.0' as const;
export const PROJECT_MIME_TYPE = 'application/vnd.manufacturing-flow-designer+json' as const;
export const PROJECT_FILE_EXTENSION = '.mflow' as const;

export interface ProjectMetadata {
  readonly id: string;
  name: string;
  description: string;
  author: string;
  company: string;
  readonly createdUtc: string;
  modifiedUtc: string;
}

export interface ProjectSettings {
  gridBaseInterval: number;
  routingClearance: number;
  unitSystem: 'metric';
  displayPrecision: number;
}

export type PersistedResourceInstance = Omit<ResourceInstance, 'selected'>;
export type PersistedOperationInstance = Omit<OperationInstance, 'selected'>;
export type PersistedProcessConnection = Omit<ProcessConnection, 'selected' | 'routePoints' | 'routeStatus'>;

export interface PersistedWorkspaces {
  active: WorkspaceId;
  processFlow: WorkspaceViewportState;
  factoryLayout: WorkspaceViewportState;
}

export interface ProjectDocument {
  readonly format: typeof PROJECT_FORMAT;
  readonly schemaVersion: typeof PROJECT_SCHEMA_VERSION;
  readonly applicationVersion: string;
  readonly project: ProjectMetadata;
  readonly resourceTemplates: readonly ResourceTemplate[];
  readonly operationTemplates: readonly OperationTemplate[];
  readonly resources: readonly PersistedResourceInstance[];
  readonly operations: readonly PersistedOperationInstance[];
  readonly connections: readonly PersistedProcessConnection[];
  readonly layoutBoundaries: readonly FactoryLayoutBoundary[];
  readonly walls: readonly FactoryWall[];
  readonly areas: readonly FactoryArea[];
  readonly aisles: readonly FactoryAisle[];
  readonly factoryRoutes: readonly FactoryRoute[];
  readonly workspaces: PersistedWorkspaces;
  readonly settings: ProjectSettings;
}

export const DEFAULT_PROJECT_SETTINGS: Readonly<ProjectSettings> = {
  gridBaseInterval: 20,
  routingClearance: 16,
  unitSystem: 'metric',
  displayPrecision: 2,
};

export function defaultViewport(): WorkspaceViewportState {
  return { panX: 0, panY: 0, zoom: 1, gridVisible: true, originVisible: true, snapEnabled: true };
}
