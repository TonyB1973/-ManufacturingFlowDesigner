import { PROJECT_SCHEMA_VERSION } from '../../models/project/ProjectDocument';
import { DEFAULT_STANDARD_WORK_CHART_SETTINGS } from '../../models/standardWork/StandardWorkChartSettings';

export type ProjectMigration = (document: Record<string, unknown>) => Record<string, unknown>;

export class ProjectMigrationService {
  private readonly migrations = new Map<string, { readonly to: string; readonly migrate: ProjectMigration }>();

  public constructor() {
    this.register('1.0.0', '1.1.0', migrateFactoryLayoutEngineering);
    this.register('1.1.0', '1.2.0', migrateFactoryStructure);
    this.register('1.2.0', '1.3.0', migrateFactoryRoutes);
    this.register('1.3.0', '1.4.0', migrateFactoryAnnotations);
    this.register('1.4.0', '1.5.0', migrateStandardWork);
    this.register('1.5.0', '1.6.0', migrateStandardWorkChart);
    this.register('1.6.0', '1.7.0', migrateStandardWorkOperators);
    this.register('1.7.0', '1.8.0', migrateStandardWorkPlanning);
  }

  public register(from: string, to: string, migrate: ProjectMigration): void {
    this.migrations.set(from, { to, migrate });
  }

  public migrate(candidate: unknown): { readonly value: unknown; readonly migratedFrom: string | null } {
    if (!isRecord(candidate)) return { value: candidate, migratedFrom: null };
    const schemaVersion = candidate.schemaVersion;
    if (typeof schemaVersion !== 'string') return { value: candidate, migratedFrom: null };
    const currentMajor = versionParts(PROJECT_SCHEMA_VERSION)?.[0];
    const candidateParts = versionParts(schemaVersion);
    if (!candidateParts) throw new Error('The project schema version is not a valid semantic version.');
    if (currentMajor !== undefined && candidateParts[0] > currentMajor) {
      throw new Error(`This project uses newer schema ${schemaVersion}; this version supports ${PROJECT_SCHEMA_VERSION}.`);
    }
    let value = { ...candidate };
    const migratedFrom = schemaVersion === PROJECT_SCHEMA_VERSION ? null : schemaVersion;
    const visited = new Set<string>();
    while (value.schemaVersion !== PROJECT_SCHEMA_VERSION) {
      const version = String(value.schemaVersion);
      if (visited.has(version)) throw new Error('A project schema migration cycle was detected.');
      visited.add(version);
      const step = this.migrations.get(version);
      if (!step) throw new Error(`Project schema ${version} is not supported by this version of the application.`);
      value = { ...step.migrate(value), schemaVersion: step.to };
    }
    return { value, migratedFrom };
  }
}

function migrateStandardWorkPlanning(document: Record<string, unknown>): Record<string, unknown> {
  const studies = Array.isArray(document.standardWorkStudies) ? document.standardWorkStudies.filter(isRecord) : [];
  const standardWorkPlanning = studies.map((study) => ({ studyId: String(study.id), periodName: 'Shift', scheduledProductionTimeSeconds: 28_800, plannedBreakTimeSeconds: 0, plannedDowntimeSeconds: 0, requiredOutputUnits: 1, active: false, notes: '' }));
  const settings = isRecord(document.settings) ? document.settings : {}; const standardWork = isRecord(settings.standardWork) ? settings.standardWork : {}; const chart = isRecord(standardWork.chart) ? standardWork.chart : {};
  return { ...document, applicationVersion: '1.0.0', standardWorkPlanning, settings: { ...settings, standardWork: { ...standardWork, chart: { ...DEFAULT_STANDARD_WORK_CHART_SETTINGS, ...chart } } } };
}

function migrateStandardWorkOperators(document: Record<string, unknown>): Record<string, unknown> {
  const studies = Array.isArray(document.standardWorkStudies) ? document.standardWorkStudies.filter(isRecord).sort((a, b) => String(a.id).localeCompare(String(b.id))) : [];
  const operatorByStudy = new Map<string, string>();
  const standardWorkOperators = studies.map((study, index) => { const studyId = String(study.id); const id = `SWO-${String(index + 1).padStart(4, '0')}`; operatorByStudy.set(studyId, id); return { id, studyId, name: 'Operator 1', role: '', displayOrder: 10, active: true, linkedResourceId: null, notes: '' }; });
  const standardWorkEntries = Array.isArray(document.standardWorkEntries) ? document.standardWorkEntries.map((candidate) => isRecord(candidate) ? { ...candidate, assignedOperatorId: operatorByStudy.get(String(candidate.studyId)) ?? '' } : candidate) : [];
  const settings = isRecord(document.settings) ? document.settings : {}; const standardWork = isRecord(settings.standardWork) ? settings.standardWork : {}; const chart = isRecord(standardWork.chart) ? standardWork.chart : {};
  return { ...document, applicationVersion: '0.9.0', standardWorkOperators, standardWorkEntries, standardWorkHandovers: [], settings: { ...settings, standardWork: { ...standardWork, chart: { ...DEFAULT_STANDARD_WORK_CHART_SETTINGS, ...chart } } } };
}

function migrateStandardWorkChart(document: Record<string, unknown>): Record<string, unknown> {
  const settings = isRecord(document.settings) ? document.settings : {};
  const standardWork = isRecord(settings.standardWork) ? settings.standardWork : {};
  return {
    ...document,
    applicationVersion: '0.8.0',
    settings: { ...settings, standardWork: { ...standardWork, timeFormat: standardWork.timeFormat ?? 'seconds', chart: { ...DEFAULT_STANDARD_WORK_CHART_SETTINGS } } },
  };
}

function migrateStandardWork(document: Record<string, unknown>): Record<string, unknown> {
  const timingCategory = (candidate: Record<string, unknown>): 'manual' | 'automatic' | 'walking' | 'waiting' => {
    const templateId = String(candidate.templateId ?? candidate.id ?? ''); const operationType = String(candidate.operationType ?? '');
    if (templateId === 'op-machine' || templateId === 'op-test' || operationType === 'Machining') return 'automatic';
    if (templateId === 'op-move' || operationType === 'Material Handling') return 'walking';
    if (templateId === 'op-store' || operationType === 'Storage') return 'waiting';
    return 'manual';
  };
  const migrateValues = (value: unknown): unknown => Array.isArray(value) ? value.map((candidate) => isRecord(candidate) ? { ...candidate, timingCategory: timingCategory(candidate) } : candidate) : value;
  const settings = isRecord(document.settings) ? document.settings : {};
  return { ...document, applicationVersion: '0.7.0', operationTemplates: migrateValues(document.operationTemplates), operations: migrateValues(document.operations), standardWorkStudies: [], standardWorkEntries: [], settings: { ...settings, standardWork: { timeFormat: 'seconds' } } };
}

function migrateFactoryAnnotations(document: Record<string, unknown>): Record<string, unknown> {
  const settings = isRecord(document.settings) ? document.settings : {};
  const legacyPrecision = typeof settings.displayPrecision === 'number' ? settings.displayPrecision : 2;
  return {
    ...document,
    applicationVersion: '0.6.0',
    factoryAnnotations: [],
    settings: {
      ...settings,
      unitSystem: 'metric',
      displayPrecision: legacyPrecision,
      units: { modelLengthUnit: 'mm', displayLengthUnit: 'mm', displayPrecision: legacyPrecision, showTrailingZeros: false },
      dimensionTextScale: 1,
      annotationTextSize: 14,
      defaultDimensionOffset: 60,
      defaultDimensionLayer: 'Dimensions',
    },
  };
}

function migrateFactoryRoutes(document: Record<string, unknown>): Record<string, unknown> {
  return { ...document, applicationVersion: '0.5.0', factoryRoutes: [] };
}

function migrateFactoryStructure(document: Record<string, unknown>): Record<string, unknown> {
  return { ...document, applicationVersion: '0.4.0', layoutBoundaries: [], walls: [], areas: [], aisles: [] };
}

function migrateFactoryLayoutEngineering(document: Record<string, unknown>): Record<string, unknown> {
  const resources = Array.isArray(document.resources) ? document.resources.map((candidate) => {
    if (!isRecord(candidate)) return candidate;
    const { height: legacyHeight, ...resource } = candidate;
    return {
      ...resource,
      depth: typeof resource.depth === 'number' ? resource.depth : legacyHeight,
      rotationDegrees: normalizeAngle(typeof resource.rotationDegrees === 'number' ? resource.rotationDegrees : 0),
      clearance: migrateClearance(resource.clearance),
    };
  }) : document.resources;
  const resourceTemplates = Array.isArray(document.resourceTemplates) ? document.resourceTemplates.map((candidate) => {
    if (!isRecord(candidate)) return candidate;
    const { defaultHeight: legacyHeight, ...template } = candidate;
    return { ...template, defaultDepth: typeof template.defaultDepth === 'number' ? template.defaultDepth : legacyHeight };
  }) : document.resourceTemplates;
  return { ...document, applicationVersion: '0.3.0', resources, resourceTemplates };
}

function migrateClearance(value: unknown): Record<string, unknown> {
  const source = isRecord(value) ? value : {};
  return {
    enabled: typeof source.enabled === 'boolean' ? source.enabled : false,
    left: nonNegative(source.left),
    right: nonNegative(source.right),
    top: nonNegative(source.top),
    bottom: nonNegative(source.bottom),
    category: typeof source.category === 'string' ? source.category.toLowerCase() : 'general',
    note: typeof source.note === 'string' ? source.note : '',
  };
}

const nonNegative = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
const normalizeAngle = (value: number): number => ((value % 360) + 360) % 360;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function versionParts(value: string): readonly [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}
