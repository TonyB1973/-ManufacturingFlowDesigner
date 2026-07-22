import { OPERATION_TEMPLATES } from '../../core/constants/operationTemplates';
import { RESOURCE_TEMPLATES } from '../../core/constants/resourceTemplates';
import type { ProcessConnection } from '../../models/connections/ProcessConnection';
import type { OperationInstance } from '../../models/operations/OperationInstance';
import {
  APPLICATION_VERSION, DEFAULT_PROJECT_SETTINGS, PROJECT_FORMAT, PROJECT_SCHEMA_VERSION, defaultViewport, type ProjectDocument, type ProjectMetadata, type ProjectSettings,
} from '../../models/project/ProjectDocument';
import type { ResourceInstance } from '../../models/resources/ResourceInstance';
import type { SelectionController } from '../../models/selection/Selection';
import { ConnectionIdGenerator } from '../../utilities/ConnectionIdGenerator';
import { OperationIdGenerator } from '../../utilities/OperationIdGenerator';
import { ProjectIdGenerator } from '../../utilities/ProjectIdGenerator';
import { ResourceIdGenerator } from '../../utilities/ResourceIdGenerator';
import type { ConnectionStoreChange, ConnectionStore } from '../ConnectionStore';
import type { OperationStore, OperationStoreChange } from '../OperationStore';
import type { ResourceStore, ResourceStoreChange } from '../ResourceStore';
import type { WorkspaceStore } from '../WorkspaceStore';
import { DirtyStateService } from './DirtyStateService';
import type { CommandHistoryService } from '../history/CommandHistoryService';
import type { FactoryStructureStore, FactoryStructureChange } from '../FactoryStructureStore';
import type { FactoryRouteStore, FactoryRouteChange } from '../FactoryRouteStore';
import type { FactoryRouteIdGenerator } from '../../utilities/FactoryRouteIdGenerator';

export interface ProjectSessionState {
  readonly metadata: ProjectMetadata;
  readonly settings: ProjectSettings;
  readonly fileName: string | null;
  readonly dirty: boolean;
}

export class ProjectSessionService {
  private metadata: ProjectMetadata;
  private settings: ProjectSettings = { ...DEFAULT_PROJECT_SETTINGS };
  private fileName: string | null = null;
  private loading = false;
  private readonly listeners = new Set<(state: ProjectSessionState) => void>();
  private readonly dirtyState = new DirtyStateService();
  private readonly unsubscribers: (() => void)[];
  private history: CommandHistoryService | null = null;
  private unsubscribeHistory: (() => void) | null = null;

  public constructor(
    public readonly resources: ResourceStore,
    public readonly operations: OperationStore,
    public readonly connections: ConnectionStore,
    public readonly structure: FactoryStructureStore,
    public readonly routes: FactoryRouteStore,
    public readonly workspaces: WorkspaceStore,
    private readonly selection: SelectionController,
    private readonly resourceIds: ResourceIdGenerator,
    private readonly operationIds: OperationIdGenerator,
    private readonly connectionIds: ConnectionIdGenerator,
    private readonly routeIds: FactoryRouteIdGenerator,
    private readonly projectIds = new ProjectIdGenerator(),
  ) {
    this.metadata = this.createMetadata();
    this.unsubscribers = [
      resources.subscribe((change) => this.resourceChanged(change)),
      operations.subscribe((change) => this.operationChanged(change)),
      connections.subscribe((change) => this.connectionChanged(change)),
      structure.subscribe((change) => this.structureChanged(change)),
      routes.subscribe((change) => this.routeChanged(change)),
      this.dirtyState.subscribe(() => this.notify()),
    ];
  }

  public getState(): ProjectSessionState { return { metadata: { ...this.metadata }, settings: { ...this.settings }, fileName: this.fileName, dirty: this.dirtyState.isDirty() }; }
  public getMetadata(): ProjectMetadata { return { ...this.metadata }; }
  public getSettings(): ProjectSettings { return { ...this.settings }; }
  public isDirty(): boolean { return this.dirtyState.isDirty(); }
  public subscribe(listener: (state: ProjectSessionState) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }

  public applyMetadata(patch: Partial<Pick<ProjectMetadata, 'name' | 'description' | 'author' | 'company'>>): boolean {
    const next = { ...this.metadata, ...patch };
    if (!next.name.trim() || next.name.length > 200 || next.description.length > 10000 || next.author.length > 200 || next.company.length > 200) return false;
    this.metadata = next; this.notify(); return true;
  }
  public applySettings(patch: Partial<ProjectSettings>): boolean {
    const next = { ...this.settings, ...patch };
    if (!Number.isFinite(next.gridBaseInterval) || next.gridBaseInterval <= 0 || !Number.isFinite(next.routingClearance) || next.routingClearance < 0 || next.unitSystem !== 'metric' || !Number.isInteger(next.displayPrecision) || next.displayPrecision < 0 || next.displayPrecision > 6) return false;
    this.settings = next; if (patch.routingClearance !== undefined) this.connections.recalculateAll(); this.notify(); return true;
  }

  public updateMetadata(patch: Partial<Pick<ProjectMetadata, 'name' | 'description' | 'author' | 'company'>>): void { if (this.applyMetadata(patch) && !this.history) this.dirtyState.markDirty(); }
  public updateSettings(patch: Partial<ProjectSettings>): void { if (this.applySettings(patch) && !this.history) this.dirtyState.markDirty(); }
  public attachHistory(history: CommandHistoryService): void { this.unsubscribeHistory?.(); this.history = history; this.unsubscribeHistory = history.subscribe((state) => { if (state.atSavedCheckpoint) this.dirtyState.markClean(); else this.dirtyState.markDirty(); }); this.dirtyState.markClean(); }

  public newProject(now = new Date().toISOString()): void {
    const metadata = this.createMetadata(now);
    this.replace({
      format: PROJECT_FORMAT, schemaVersion: PROJECT_SCHEMA_VERSION, applicationVersion: APPLICATION_VERSION, project: metadata,
      resourceTemplates: RESOURCE_TEMPLATES, operationTemplates: OPERATION_TEMPLATES,
      resources: [], operations: [], connections: [], layoutBoundaries: [], walls: [], areas: [], aisles: [], factoryRoutes: [],
      workspaces: { active: 'processFlow', processFlow: defaultViewport(), factoryLayout: defaultViewport() },
      settings: { ...DEFAULT_PROJECT_SETTINGS },
    }, null);
  }

  public openProject(document: ProjectDocument, fileName: string): void { this.replace(document, fileName); }
  public markSaved(metadata: ProjectMetadata, fileName: string): void { this.metadata = { ...metadata }; this.fileName = fileName; if (this.history) this.history.markSaved(); else this.dirtyState.markClean(); this.notify(); }
  public dispose(): void { this.unsubscribeHistory?.(); this.unsubscribers.forEach((unsubscribe) => unsubscribe()); this.listeners.clear(); }

  private replace(document: ProjectDocument, fileName: string | null): void {
    this.loading = true;
    try {
      this.selection.clear();
      const resources: ResourceInstance[] = document.resources.map((item) => ({ ...item, clearance: { ...item.clearance }, selected: false }));
      const operations: OperationInstance[] = document.operations.map((item) => ({ ...item, selected: false }));
      const connections: ProcessConnection[] = document.connections.map((item) => ({ ...item, sourceAnchor: { ...item.sourceAnchor }, targetAnchor: { ...item.targetAnchor }, routePoints: [], routeStatus: 'clear', selected: false }));
      this.metadata = { ...document.project };
      this.settings = { ...document.settings };
      this.fileName = fileName;
      this.resources.replaceAll(document.resourceTemplates, resources, false);
      this.operations.replaceAll(document.operationTemplates, operations, false);
      this.connections.replaceAll(connections, false);
      this.structure.replaceAll(document.layoutBoundaries, document.walls, document.areas, document.aisles, false);
      this.routes.replaceAll(document.factoryRoutes, false);
      this.workspaces.restore(document.workspaces.active, document.workspaces.processFlow, document.workspaces.factoryLayout, false);
      this.resourceIds.ensureAfter(resources.map((item) => item.id));
      this.operationIds.ensureAfter(operations.map((item) => item.id));
      this.connectionIds.ensureAfter(connections.map((item) => item.id));
      this.routeIds.ensureAfter(document.factoryRoutes.map((item) => item.id));
      this.projectIds.ensureAfter([document.project.id]);
      this.resources.publishReset(); this.operations.publishReset(); this.connections.publishReset(); this.structure.publishReset(); this.routes.publishReset(); this.workspaces.publish();
      if (this.history) this.history.clear(); else this.dirtyState.markClean();
    } finally { this.loading = false; }
    this.notify();
  }

  private createMetadata(now = new Date().toISOString()): ProjectMetadata {
    return { id: this.projectIds.next(), name: 'Untitled Project', description: '', author: '', company: '', createdUtc: now, modifiedUtc: now };
  }
  private resourceChanged(change: ResourceStoreChange): void { if (!this.history && !this.loading && change.kind !== 'selection' && change.kind !== 'reset') this.dirtyState.markDirty(); }
  private operationChanged(change: OperationStoreChange): void { if (!this.history && !this.loading && change.kind !== 'selection' && change.kind !== 'validation' && change.kind !== 'reset') this.dirtyState.markDirty(); }
  private connectionChanged(change: ConnectionStoreChange): void { if (!this.history && !this.loading && change.kind !== 'selection' && change.kind !== 'validation' && change.kind !== 'reset') this.dirtyState.markDirty(); }
  private structureChanged(change: FactoryStructureChange): void { if (!this.history && !this.loading && change.kind !== 'reset') this.dirtyState.markDirty(); }
  private routeChanged(change: FactoryRouteChange): void { if (!this.history && !this.loading && change.kind !== 'reset') this.dirtyState.markDirty(); }
  private notify(): void { const state = this.getState(); for (const listener of this.listeners) listener(state); }
}
