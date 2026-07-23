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
import type { FactoryAnnotationStore, FactoryAnnotationChange } from '../FactoryAnnotationStore';
import type { FactoryAnnotationIdGenerator } from '../../utilities/FactoryAnnotationIdGenerator';
import { FACTORY_ANNOTATION_LAYERS } from '../../models/factory/FactoryAnnotation';
import { LENGTH_UNITS } from '../units/LengthUnitService';
import { StandardWorkStore, type StandardWorkChange } from '../StandardWorkStore';
import { StandardWorkSelectionStore } from '../standardWork/StandardWorkSelectionStore';
import { StandardWorkEntryIdGenerator, StandardWorkHandoverIdGenerator, StandardWorkOperatorIdGenerator, StandardWorkStudyIdGenerator } from '../../utilities/StandardWorkIdGenerator';
import { STANDARD_WORK_TIME_FORMATS } from '../../models/standardWork/StandardWork';
import { isValidStandardWorkChartSettings } from '../../models/standardWork/StandardWorkChartSettings';
import { StandardWorkOperatorStore, type StandardWorkOperatorChange } from '../standardWork/StandardWorkOperatorStore';
import { StandardWorkHandoverStore, type StandardWorkHandoverChange } from '../standardWork/StandardWorkHandoverStore';
import { StandardWorkPlanningStore, type StandardWorkPlanningChange } from '../standardWork/StandardWorkPlanningStore';
import { createDefaultStandardWorkPlanning } from '../../models/standardWork/StandardWorkPlanning';
import { AvailabilityStore, type AvailabilityChange } from '../availability/AvailabilityStore';
import type { AvailabilitySelectionStore } from '../availability/AvailabilitySelectionStore';
import type { ManufacturingScenario, ManufacturingScenarioState, ScenarioSummary } from '../../models/scenarios/ManufacturingScenario';
import { ScenarioCloneService } from '../scenarios/ScenarioCloneService';
import { ScenarioIdGenerator } from '../../utilities/ScenarioIdGenerator';
import { scenarioStateFromStores } from './ProjectSerializer';
import { validateScenario } from '../scenarios/ScenarioValidationService';

export interface ProjectSessionState {
  readonly metadata: ProjectMetadata;
  readonly settings: ProjectSettings;
  readonly fileName: string | null;
  readonly dirty: boolean;
  readonly activeScenarioId: string;
  readonly scenarioCount: number;
}

export interface ScenarioCalendarReferenceSummary {
  readonly scenarioId: string;
  readonly scenarioName: string;
  readonly resources: number;
  readonly operators: number;
  readonly planningRecords: number;
  readonly total: number;
}

export interface CalendarReferenceSummary {
  readonly calendarId: string;
  readonly projectDefault: boolean;
  readonly scenarios: readonly ScenarioCalendarReferenceSummary[];
  readonly total: number;
}

export class ProjectSessionService {
  public readonly standardWorkOperators: StandardWorkOperatorStore;
  public readonly standardWorkHandovers: StandardWorkHandoverStore;
  public readonly standardWorkPlanning: StandardWorkPlanningStore;
  public readonly availability = new AvailabilityStore();
  private readonly scenarios = new Map<string, ManufacturingScenario>();
  private readonly scenarioRevisions = new Map<string, number>();
  private readonly scenarioClone = new ScenarioCloneService();
  private readonly scenarioIds = new ScenarioIdGenerator();
  private activeScenarioId = 'SCN-0001';
  private metadata: ProjectMetadata;
  private settings: ProjectSettings = { ...DEFAULT_PROJECT_SETTINGS, units: { ...DEFAULT_PROJECT_SETTINGS.units }, standardWork: { ...DEFAULT_PROJECT_SETTINGS.standardWork, chart: { ...DEFAULT_PROJECT_SETTINGS.standardWork.chart } } };
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
    public readonly annotations: FactoryAnnotationStore,
    public readonly workspaces: WorkspaceStore,
    private readonly selection: SelectionController,
    private readonly resourceIds: ResourceIdGenerator,
    private readonly operationIds: OperationIdGenerator,
    private readonly connectionIds: ConnectionIdGenerator,
    private readonly routeIds: FactoryRouteIdGenerator,
    private readonly annotationIds: FactoryAnnotationIdGenerator,
    public readonly standardWork: StandardWorkStore = new StandardWorkStore(new StandardWorkStudyIdGenerator(), new StandardWorkEntryIdGenerator(), (id) => Boolean(this.operations.getOperation(id))),
    private readonly standardWorkSelection: StandardWorkSelectionStore = new StandardWorkSelectionStore(),
    private readonly availabilitySelection?: AvailabilitySelectionStore,
    private readonly projectIds = new ProjectIdGenerator(),
  ) {
    this.standardWorkOperators = new StandardWorkOperatorStore(new StandardWorkOperatorIdGenerator(), (id) => Boolean(this.standardWork.getStudy(id)), (id) => Boolean(this.resources.getResource(id)));
    this.standardWorkHandovers = new StandardWorkHandoverStore(new StandardWorkHandoverIdGenerator(), (id) => this.standardWork.getEntry(id), (studyId) => this.standardWork.getEntries(studyId));
    this.standardWorkPlanning = new StandardWorkPlanningStore((id) => Boolean(this.standardWork.getStudy(id)));
    this.standardWork.setOperatorResolver((id) => this.standardWorkOperators.getOperator(id)?.studyId ?? null);
    this.metadata = this.createMetadata();
    const initialBaseline = this.createBaselineScenario(this.metadata.createdUtc);
    this.scenarios.set(initialBaseline.id, initialBaseline);
    this.scenarioRevisions.set(initialBaseline.id, 0);
    this.scenarioIds.reset([initialBaseline.id]);
    this.unsubscribers = [
      resources.subscribe((change) => this.resourceChanged(change)),
      operations.subscribe((change) => this.operationChanged(change)),
      connections.subscribe((change) => this.connectionChanged(change)),
      structure.subscribe((change) => this.structureChanged(change)),
      routes.subscribe((change) => this.routeChanged(change)),
      annotations.subscribe((change) => this.annotationChanged(change)),
      standardWork.subscribe((change) => this.standardWorkChanged(change)),
      this.standardWorkOperators.subscribe((change) => this.standardWorkOperatorChanged(change)),
      this.standardWorkHandovers.subscribe((change) => this.standardWorkHandoverChanged(change)),
      this.standardWorkPlanning.subscribe((change) => this.standardWorkPlanningChanged(change)),
      this.availability.subscribe((change) => this.availabilityChanged(change)),
      this.dirtyState.subscribe(() => this.notify()),
    ];
  }

  public getState(): ProjectSessionState { return { metadata: { ...this.metadata }, settings: this.getSettings(), fileName: this.fileName, dirty: this.dirtyState.isDirty(), activeScenarioId: this.activeScenarioId, scenarioCount: this.scenarios.size }; }
  public getMetadata(): ProjectMetadata { return { ...this.metadata }; }
  public getSettings(): ProjectSettings { return { ...this.settings, units: { ...this.settings.units }, standardWork: { ...this.settings.standardWork, chart: { ...this.settings.standardWork.chart } } }; }
  public isDirty(): boolean { return this.dirtyState.isDirty(); }
  public subscribe(listener: (state: ProjectSessionState) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }

  public getActiveScenarioId(): string { return this.activeScenarioId; }
  public getActiveScenario(): ManufacturingScenario { return this.getScenario(this.activeScenarioId)!; }
  public getScenario(id: string): ManufacturingScenario | undefined {
    if (id === this.activeScenarioId) this.synchronizeActiveScenarioState(false);
    const value = this.scenarios.get(id); return value ? this.scenarioClone.cloneScenario(value) : undefined;
  }
  public getScenarios(): readonly ManufacturingScenario[] {
    this.synchronizeActiveScenarioState(false);
    return [...this.scenarios.values()].sort((left, right) => left.createdUtc.localeCompare(right.createdUtc) || left.id.localeCompare(right.id)).map((item) => this.scenarioClone.cloneScenario(item));
  }
  public getScenarioSummaries(): readonly ScenarioSummary[] {
    const ids = new Set(this.scenarios.keys());
    return this.getScenarios().map((item) => {
      const health = validateScenario(item, this.availability.getCalendars(), this.settings);
      return {
        id: item.id, name: item.name, isBaseline: item.isBaseline, locked: item.locked, active: item.id === this.activeScenarioId,
        sourceScenarioId: item.sourceScenarioId, sourceAvailable: item.sourceScenarioId === null || ids.has(item.sourceScenarioId),
        createdUtc: item.createdUtc, modifiedUtc: item.modifiedUtc, resourceCount: item.state.resources.length,
        operationCount: item.state.operations.length, standardWorkStudyCount: item.state.standardWorkStudies.length,
        operatorCount: item.state.standardWorkOperators.length, revision: this.scenarioRevisions.get(item.id) ?? 0,
        errors: health.errors, warnings: health.warnings,
      };
    });
  }
  public getBaselineScenario(): ManufacturingScenario { return this.getScenarios().find((item) => item.isBaseline)!; }
  public getScenarioRevision(id: string): number { return this.scenarioRevisions.get(id) ?? 0; }
  public isActiveScenarioLocked(): boolean { return this.scenarios.get(this.activeScenarioId)?.locked ?? false; }
  public getCalendarReferences(calendarId: string): CalendarReferenceSummary {
    const scenarios = this.getScenarios().map((scenario) => {
      const resources = scenario.state.resources.filter((item) => item.availabilityCalendarId === calendarId).length;
      const operators = scenario.state.standardWorkOperators.filter((item) => item.availabilityCalendarId === calendarId).length;
      const planningRecords = scenario.state.standardWorkPlanning.filter((item) => item.planningCalendarId === calendarId).length;
      return { scenarioId: scenario.id, scenarioName: scenario.name, resources, operators, planningRecords, total: resources + operators + planningRecords };
    }).filter((item) => item.total > 0);
    const projectDefault = this.settings.defaultAvailabilityCalendarId === calendarId;
    return { calendarId, projectDefault, scenarios, total: scenarios.reduce((sum, item) => sum + item.total, projectDefault ? 1 : 0) };
  }

  public replaceCalendarReferences(calendarId: string, replacementId: string | null): number {
    if (replacementId === calendarId || (replacementId !== null && !this.availability.getCalendar(replacementId))) return 0;
    this.synchronizeActiveScenarioState(false);
    let changed = 0; const now = new Date().toISOString();
    for (const scenario of this.scenarios.values()) {
      let scenarioChanged = false;
      const resources = scenario.state.resources.map((item) => item.availabilityCalendarId === calendarId ? (changed += 1, scenarioChanged = true, { ...item, availabilityCalendarId: replacementId }) : item);
      const standardWorkOperators = scenario.state.standardWorkOperators.map((item) => item.availabilityCalendarId === calendarId ? (changed += 1, scenarioChanged = true, { ...item, availabilityCalendarId: replacementId }) : item);
      const standardWorkPlanning = scenario.state.standardWorkPlanning.map((item) => item.planningCalendarId === calendarId ? (changed += 1, scenarioChanged = true, { ...item, planningCalendarId: replacementId }) : item);
      if (scenarioChanged) {
        scenario.state = { ...scenario.state, resources, standardWorkOperators, standardWorkPlanning };
        scenario.modifiedUtc = now; this.bumpScenario(scenario.id);
      }
    }
    if (changed) this.loadScenarioState(this.scenarios.get(this.activeScenarioId)!.state);
    else this.notify();
    return changed;
  }

  public applyMetadata(patch: Partial<Pick<ProjectMetadata, 'name' | 'description' | 'author' | 'company'>>): boolean {
    const next = { ...this.metadata, ...patch };
    if (!next.name.trim() || next.name.length > 200 || next.description.length > 10000 || next.author.length > 200 || next.company.length > 200) return false;
    this.metadata = next; this.notify(); return true;
  }
  public applySettings(patch: Partial<ProjectSettings>): boolean {
    const next = { ...this.settings, ...patch, units: { ...this.settings.units, ...patch.units }, standardWork: { ...this.settings.standardWork, ...patch.standardWork, chart: { ...this.settings.standardWork.chart, ...patch.standardWork?.chart } } };
    if (!Number.isFinite(next.gridBaseInterval) || next.gridBaseInterval <= 0 || !Number.isFinite(next.routingClearance) || next.routingClearance < 0 || next.unitSystem !== 'metric' || !Number.isInteger(next.displayPrecision) || next.displayPrecision < 0 || next.displayPrecision > 6) return false;
    if (!LENGTH_UNITS.includes(next.units.modelLengthUnit) || !LENGTH_UNITS.includes(next.units.displayLengthUnit) || !Number.isInteger(next.units.displayPrecision) || next.units.displayPrecision < 0 || next.units.displayPrecision > 6 || typeof next.units.showTrailingZeros !== 'boolean') return false;
    if (![next.dimensionTextScale, next.annotationTextSize, next.defaultDimensionOffset].every((value) => Number.isFinite(value) && value > 0) || !FACTORY_ANNOTATION_LAYERS.includes(next.defaultDimensionLayer)) return false;
    if (!STANDARD_WORK_TIME_FORMATS.includes(next.standardWork.timeFormat) || !isValidStandardWorkChartSettings(next.standardWork.chart)) return false;
    if (next.defaultAvailabilityCalendarId !== null && !this.availability.getCalendar(next.defaultAvailabilityCalendarId)) return false;
    this.settings = next; if (patch.routingClearance !== undefined) this.connections.recalculateAll(); this.notify(); return true;
  }

  public updateMetadata(patch: Partial<Pick<ProjectMetadata, 'name' | 'description' | 'author' | 'company'>>): void { if (this.applyMetadata(patch) && !this.history) this.dirtyState.markDirty(); }
  public updateSettings(patch: Partial<ProjectSettings>): void { if (this.applySettings(patch) && !this.history) this.dirtyState.markDirty(); }
  public attachHistory(history: CommandHistoryService): void { this.unsubscribeHistory?.(); this.history = history; this.unsubscribeHistory = history.subscribe((state) => { if (state.atSavedCheckpoint) this.dirtyState.markClean(); else this.dirtyState.markDirty(); }); this.dirtyState.markClean(); }

  public activateScenario(id: string): boolean {
    if (id === this.activeScenarioId) return true;
    const target = this.scenarios.get(id); if (!target) return false;
    this.synchronizeActiveScenarioState(false);
    this.activeScenarioId = id;
    this.loadScenarioState(target.state);
    this.notify();
    return true;
  }

  public createScenarioFrom(sourceId: string, name: string, now = new Date().toISOString()): ManufacturingScenario | null {
    const source = this.getScenario(sourceId); const trimmed = name.trim();
    if (!source || !trimmed || trimmed.length > 200) return null;
    const scenario: ManufacturingScenario = {
      id: this.scenarioIds.next(), name: trimmed, description: '', isBaseline: false, locked: false,
      createdUtc: now, modifiedUtc: now, sourceScenarioId: source.id, state: this.scenarioClone.cloneState(source.state),
    };
    this.scenarios.set(scenario.id, scenario); this.scenarioRevisions.set(scenario.id, 0); this.activateScenario(scenario.id); return this.scenarioClone.cloneScenario(scenario);
  }

  public restoreScenario(value: ManufacturingScenario, makeActive = false): boolean {
    if (this.scenarios.has(value.id) || !value.name.trim()) return false;
    const scenario = this.scenarioClone.cloneScenario(value);
    this.scenarios.set(scenario.id, scenario); this.scenarioRevisions.set(scenario.id, 0); this.scenarioIds.ensureAfter([scenario.id]);
    if (makeActive) this.activateScenario(scenario.id); else this.notify();
    return true;
  }

  public updateScenario(id: string, patch: Partial<Pick<ManufacturingScenario, 'name' | 'description' | 'locked'>>): boolean {
    const scenario = this.scenarios.get(id); if (!scenario) return false;
    const nextName = patch.name?.trim() ?? scenario.name; const nextDescription = patch.description ?? scenario.description;
    if (!nextName || nextName.length > 200 || nextDescription.length > 10000) return false;
    scenario.name = nextName; scenario.description = nextDescription; if (patch.locked !== undefined) scenario.locked = patch.locked;
    scenario.modifiedUtc = new Date().toISOString(); this.bumpScenario(id); this.notify(); return true;
  }

  public setBaselineScenario(id: string): boolean {
    const target = this.scenarios.get(id); if (!target || target.isBaseline) return false;
    const now = new Date().toISOString();
    for (const scenario of this.scenarios.values()) {
      const next = scenario.id === id;
      if (scenario.isBaseline !== next) { scenario.isBaseline = next; scenario.modifiedUtc = now; this.bumpScenario(scenario.id); }
    }
    this.notify(); return true;
  }

  public deleteScenario(id: string): ManufacturingScenario | null {
    const scenario = this.scenarios.get(id); if (!scenario || scenario.isBaseline || this.scenarios.size <= 1) return null;
    const snapshot = this.scenarioClone.cloneScenario(scenario); const wasActive = id === this.activeScenarioId;
    this.scenarios.delete(id); this.scenarioRevisions.delete(id);
    if (wasActive) {
      const replacement = [...this.scenarios.values()].sort((left, right) => Number(right.isBaseline) - Number(left.isBaseline) || left.createdUtc.localeCompare(right.createdUtc) || left.id.localeCompare(right.id))[0];
      this.activeScenarioId = replacement.id; this.loadScenarioState(replacement.state);
    }
    this.notify(); return snapshot;
  }

  public replaceScenario(value: ManufacturingScenario): boolean {
    if (!this.scenarios.has(value.id)) return false;
    this.scenarios.set(value.id, this.scenarioClone.cloneScenario(value)); this.bumpScenario(value.id);
    if (value.id === this.activeScenarioId) { this.loadScenarioState(value.state); this.notify(); } else this.notify();
    return true;
  }

  public newProject(now = new Date().toISOString()): void {
    const metadata = this.createMetadata(now);
    const baseline = this.createBaselineScenario(now);
    this.replace({
      format: PROJECT_FORMAT, schemaVersion: PROJECT_SCHEMA_VERSION, applicationVersion: APPLICATION_VERSION, project: metadata,
      resourceTemplates: RESOURCE_TEMPLATES, operationTemplates: OPERATION_TEMPLATES,
      activeScenarioId: baseline.id, scenarios: [baseline],
      shiftDefinitions: [], shiftBreaks: [], availabilityCalendars: [], calendarExceptions: [],
      settings: { ...DEFAULT_PROJECT_SETTINGS, units: { ...DEFAULT_PROJECT_SETTINGS.units }, standardWork: { ...DEFAULT_PROJECT_SETTINGS.standardWork, chart: { ...DEFAULT_PROJECT_SETTINGS.standardWork.chart } } },
    }, null);
  }

  public openProject(document: ProjectDocument, fileName: string): void { this.replace(document, fileName); }
  public markSaved(metadata: ProjectMetadata, fileName: string): void { this.metadata = { ...metadata }; this.fileName = fileName; if (this.history) this.history.markSaved(); else this.dirtyState.markClean(); this.notify(); }
  public dispose(): void { this.unsubscribeHistory?.(); this.unsubscribers.forEach((unsubscribe) => unsubscribe()); this.listeners.clear(); }

  private replace(document: ProjectDocument, fileName: string | null): void {
    this.loading = true;
    try {
      this.selection.clear();
      this.standardWorkSelection.clear();
      this.availabilitySelection?.clear();
      this.metadata = { ...document.project };
      this.settings = { ...document.settings, units: { ...document.settings.units }, standardWork: { ...document.settings.standardWork, chart: { ...document.settings.standardWork.chart } } };
      this.fileName = fileName;
      this.scenarios.clear(); this.scenarioRevisions.clear();
      for (const value of document.scenarios) { const scenario = this.scenarioClone.cloneScenario(value); this.scenarios.set(scenario.id, scenario); this.scenarioRevisions.set(scenario.id, 0); }
      this.activeScenarioId = this.scenarios.has(document.activeScenarioId) ? document.activeScenarioId : [...this.scenarios.values()].find((item) => item.isBaseline)!.id;
      this.scenarioIds.reset(this.scenarios.keys());
      this.availability.replaceAll({
        shifts: document.shiftDefinitions ?? [],
        breaks: document.shiftBreaks ?? [],
        calendars: document.availabilityCalendars ?? [],
        exceptions: document.calendarExceptions ?? [],
      }, false);
      this.resources.replaceAll(document.resourceTemplates, [], false);
      this.operations.replaceAll(document.operationTemplates, [], false);
      this.loadScenarioState(this.scenarios.get(this.activeScenarioId)!.state, false);
      this.projectIds.ensureAfter([document.project.id]);
      this.resources.publishReset(); this.operations.publishReset(); this.connections.publishReset(); this.structure.publishReset(); this.routes.publishReset(); this.annotations.publishReset(); this.standardWork.publishReset(); this.standardWorkOperators.publishReset(); this.standardWorkHandovers.publishReset(); this.standardWorkPlanning.publishReset(); this.availability.publishReset(); this.workspaces.publish();
      if (this.history) this.history.clear(); else this.dirtyState.markClean();
    } finally { this.loading = false; }
    this.notify();
  }

  private createBaselineScenario(now: string): ManufacturingScenario {
    return {
      id: 'SCN-0001', name: 'Baseline', description: '', isBaseline: true, locked: false,
      createdUtc: now, modifiedUtc: now, sourceScenarioId: null,
      state: {
        resources: [], operations: [], connections: [], layoutBoundaries: [], walls: [], areas: [], aisles: [],
        factoryRoutes: [], factoryAnnotations: [], standardWorkStudies: [], standardWorkEntries: [],
        standardWorkOperators: [], standardWorkHandovers: [], standardWorkPlanning: [],
        workspaces: { active: 'processFlow', processFlow: defaultViewport(), factoryLayout: defaultViewport() },
      },
    };
  }

  private loadScenarioState(state: ManufacturingScenarioState, notify = true): void {
    const wasLoading = this.loading; this.loading = true;
    try {
      this.selection.clear(); this.standardWorkSelection.clear(); this.availabilitySelection?.clear();
      const resources: ResourceInstance[] = state.resources.map((item) => ({ ...item, clearance: { ...item.clearance }, selected: false }));
      const operations: OperationInstance[] = state.operations.map((item) => ({ ...item, selected: false }));
      const connections: ProcessConnection[] = state.connections.map((item) => ({ ...item, sourceAnchor: { ...item.sourceAnchor }, targetAnchor: { ...item.targetAnchor }, routePoints: [], routeStatus: 'clear', selected: false }));
      this.resources.replaceAll(this.resources.getTemplates(), resources, false);
      this.operations.replaceAll(this.operations.getTemplates(), operations, false);
      this.connections.replaceAll(connections, false);
      this.structure.replaceAll(state.layoutBoundaries, state.walls, state.areas, state.aisles, false);
      this.routes.replaceAll(state.factoryRoutes, false); this.annotations.replaceAll(state.factoryAnnotations, false);
      this.standardWork.replaceAll(state.standardWorkStudies, state.standardWorkEntries, false);
      this.standardWorkOperators.replaceAll(state.standardWorkOperators, false);
      this.standardWorkHandovers.replaceAll(state.standardWorkHandovers, false);
      this.standardWorkPlanning.replaceAll(state.standardWorkPlanning.length ? state.standardWorkPlanning : state.standardWorkStudies.map((study) => createDefaultStandardWorkPlanning(study.id)), false);
      this.workspaces.restore(state.workspaces.active, state.workspaces.processFlow, state.workspaces.factoryLayout, false);
      this.resourceIds.reset(resources.map((item) => item.id)); this.operationIds.reset(operations.map((item) => item.id)); this.connectionIds.reset(connections.map((item) => item.id));
      this.routeIds.reset(state.factoryRoutes.map((item) => item.id)); this.annotationIds.reset(state.factoryAnnotations.map((item) => item.id));
      this.connections.recalculateAll();
      if (notify) { this.resources.publishReset(); this.operations.publishReset(); this.connections.publishReset(); this.structure.publishReset(); this.routes.publishReset(); this.annotations.publishReset(); this.standardWork.publishReset(); this.standardWorkOperators.publishReset(); this.standardWorkHandovers.publishReset(); this.standardWorkPlanning.publishReset(); this.workspaces.publish(); }
    } finally { this.loading = wasLoading; }
  }

  private synchronizeActiveScenarioState(touch: boolean): void {
    if (this.loading) return;
    const scenario = this.scenarios.get(this.activeScenarioId); if (!scenario) return;
    scenario.state = this.scenarioClone.cloneState(scenarioStateFromStores(this));
    if (touch) { scenario.modifiedUtc = new Date().toISOString(); this.bumpScenario(scenario.id); }
  }
  private bumpScenario(id: string): void { this.scenarioRevisions.set(id, (this.scenarioRevisions.get(id) ?? 0) + 1); }
  private recordScenarioChange(): void { this.synchronizeActiveScenarioState(true); if (!this.history) this.dirtyState.markDirty(); this.notify(); }

  private createMetadata(now = new Date().toISOString()): ProjectMetadata {
    return { id: this.projectIds.next(), name: 'Untitled Project', description: '', author: '', company: '', createdUtc: now, modifiedUtc: now };
  }
  private resourceChanged(change: ResourceStoreChange): void { if (!this.loading && !['selection', 'template', 'reset'].includes(change.kind)) this.recordScenarioChange(); }
  private operationChanged(change: OperationStoreChange): void { if (!this.loading && !['selection', 'validation', 'reset'].includes(change.kind)) this.recordScenarioChange(); }
  private connectionChanged(change: ConnectionStoreChange): void { if (!this.loading && !['selection', 'validation', 'reset'].includes(change.kind)) this.recordScenarioChange(); }
  private structureChanged(change: FactoryStructureChange): void { if (!this.loading && change.kind !== 'reset') this.recordScenarioChange(); }
  private routeChanged(change: FactoryRouteChange): void { if (!this.loading && change.kind !== 'reset') this.recordScenarioChange(); }
  private annotationChanged(change: FactoryAnnotationChange): void { if (!this.loading && change.kind !== 'reset') this.recordScenarioChange(); }
  private standardWorkChanged(change: StandardWorkChange): void { if (!this.loading && change.kind !== 'reset') this.recordScenarioChange(); }
  private standardWorkOperatorChanged(change: StandardWorkOperatorChange): void { if (!this.loading && change.kind !== 'reset') this.recordScenarioChange(); }
  private standardWorkHandoverChanged(change: StandardWorkHandoverChange): void { if (!this.loading && change.kind !== 'reset') this.recordScenarioChange(); }
  private standardWorkPlanningChanged(change: StandardWorkPlanningChange): void { if (!this.loading && change.kind !== 'reset') this.recordScenarioChange(); }
  private availabilityChanged(change: AvailabilityChange): void { if (!this.history && !this.loading && change.kind !== 'reset') this.dirtyState.markDirty(); }
  private notify(): void { const state = this.getState(); for (const listener of this.listeners) listener(state); }
}
