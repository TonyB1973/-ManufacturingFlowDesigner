import { PROJECT_SCHEMA_VERSION } from '../../models/project/ProjectDocument';

export type ProjectMigration = (document: Record<string, unknown>) => Record<string, unknown>;

export class ProjectMigrationService {
  private readonly migrations = new Map<string, { readonly to: string; readonly migrate: ProjectMigration }>();

  public constructor() {
    this.register('1.0.0', '1.1.0', migrateFactoryLayoutEngineering);
    this.register('1.1.0', '1.2.0', migrateFactoryStructure);
    this.register('1.2.0', '1.3.0', migrateFactoryRoutes);
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
