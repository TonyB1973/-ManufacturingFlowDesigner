import { PROJECT_SCHEMA_VERSION } from '../../models/project/ProjectDocument';

export type ProjectMigration = (document: Record<string, unknown>) => Record<string, unknown>;

export class ProjectMigrationService {
  private readonly migrations = new Map<string, { readonly to: string; readonly migrate: ProjectMigration }>();

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function versionParts(value: string): readonly [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}
