export const STANDARD_WORK_OPERATOR_LIMITS = { perStudy: 10_000, total: 100_000, name: 200, role: 500, notes: 10_000 } as const;

export interface StandardWorkOperator {
  readonly id: string;
  readonly studyId: string;
  name: string;
  role: string;
  displayOrder: number;
  active: boolean;
  linkedResourceId: string | null;
  availabilityCalendarId: string | null;
  notes: string;
}

export type StandardWorkOperatorPatch = Partial<Pick<StandardWorkOperator, 'name' | 'role' | 'displayOrder' | 'active' | 'linkedResourceId' | 'availabilityCalendarId' | 'notes'>>;
export const cloneStandardWorkOperator = (value: StandardWorkOperator): StandardWorkOperator => ({ ...value });

export function isValidStandardWorkOperator(value: StandardWorkOperator): boolean {
  return /^SWO-\d+$/.test(value.id) && /^SW-\d+$/.test(value.studyId)
    && value.name.trim().length > 0 && value.name.length <= STANDARD_WORK_OPERATOR_LIMITS.name
    && value.role.length <= STANDARD_WORK_OPERATOR_LIMITS.role
    && Number.isInteger(value.displayOrder) && value.displayOrder > 0
    && typeof value.active === 'boolean'
    && (value.linkedResourceId === null || value.linkedResourceId.trim().length > 0)
    && (value.availabilityCalendarId === null || /^CAL-\d+$/.test(value.availabilityCalendarId))
    && value.notes.length <= STANDARD_WORK_OPERATOR_LIMITS.notes;
}
