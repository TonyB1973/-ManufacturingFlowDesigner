export const STANDARD_WORK_TIME_FORMATS = ['seconds', 'minutesSeconds', 'hoursMinutesSeconds'] as const;
export type StandardWorkTimeFormat = typeof STANDARD_WORK_TIME_FORMATS[number];

export const STANDARD_WORK_LIMITS = {
  studies: 10_000,
  entriesPerStudy: 100_000,
  totalEntries: 500_000,
  occurrences: 1_000_000,
  name: 200,
  description: 10_000,
  productOrProcessName: 500,
  revision: 100,
  notes: 10_000,
} as const;

export interface StandardWorkStudy {
  readonly id: string;
  name: string;
  description: string;
  productOrProcessName: string;
  revision: string;
  active: boolean;
  notes: string;
  readonly createdUtc: string;
  modifiedUtc: string;
}

export interface StandardWorkEntry {
  readonly id: string;
  readonly studyId: string;
  readonly operationId: string;
  assignedOperatorId: string;
  order: number;
  occurrences: number;
  enabled: boolean;
  notes: string;
}

export type StandardWorkStudyPatch = Partial<Pick<StandardWorkStudy, 'name' | 'description' | 'productOrProcessName' | 'revision' | 'active' | 'notes' | 'modifiedUtc'>>;
export type StandardWorkEntryPatch = Partial<Pick<StandardWorkEntry, 'assignedOperatorId' | 'order' | 'occurrences' | 'enabled' | 'notes'>>;

export const cloneStandardWorkStudy = (study: StandardWorkStudy): StandardWorkStudy => ({ ...study });
export const cloneStandardWorkEntry = (entry: StandardWorkEntry): StandardWorkEntry => ({ ...entry });

export function isValidStandardWorkStudy(study: StandardWorkStudy): boolean {
  return /^SW-\d+$/.test(study.id)
    && study.name.trim().length > 0 && study.name.length <= STANDARD_WORK_LIMITS.name
    && study.description.length <= STANDARD_WORK_LIMITS.description
    && study.productOrProcessName.length <= STANDARD_WORK_LIMITS.productOrProcessName
    && study.revision.length <= STANDARD_WORK_LIMITS.revision
    && study.notes.length <= STANDARD_WORK_LIMITS.notes
    && typeof study.active === 'boolean'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(study.createdUtc) && Number.isFinite(Date.parse(study.createdUtc))
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(study.modifiedUtc) && Number.isFinite(Date.parse(study.modifiedUtc));
}

export function isValidStandardWorkEntry(entry: StandardWorkEntry): boolean {
  return /^SWE-\d+$/.test(entry.id) && /^SW-\d+$/.test(entry.studyId)
    && entry.operationId.trim().length > 0
    && /^SWO-\d+$/.test(entry.assignedOperatorId)
    && Number.isInteger(entry.order) && entry.order > 0
    && Number.isInteger(entry.occurrences) && entry.occurrences > 0 && entry.occurrences <= STANDARD_WORK_LIMITS.occurrences
    && typeof entry.enabled === 'boolean' && entry.notes.length <= STANDARD_WORK_LIMITS.notes;
}
