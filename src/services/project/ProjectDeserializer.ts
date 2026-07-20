import type { ProjectDocument } from '../../models/project/ProjectDocument';
import { ProjectMigrationService } from './ProjectMigrationService';
import { ProjectValidationError, validateProjectDocument } from './ProjectSchemaValidator';

export interface DeserializedProject {
  readonly document: ProjectDocument;
  readonly migratedFrom: string | null;
}

export function deserializeProject(text: string, migrations = new ProjectMigrationService()): DeserializedProject {
  let parsed: unknown;
  try { parsed = JSON.parse(text) as unknown; }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown JSON parsing error.';
    throw new ProjectValidationError([`The file is not valid JSON: ${message}`]);
  }
  const migrated = migrations.migrate(parsed);
  return { document: validateProjectDocument(migrated.value), migratedFrom: migrated.migratedFrom };
}
