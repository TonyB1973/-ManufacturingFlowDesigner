export const STANDARD_WORK_HANDOVER_LIMITS = { perStudy: 500_000, total: 1_000_000, note: 10_000 } as const;

export interface StandardWorkHandover {
  readonly id: string;
  readonly studyId: string;
  readonly fromEntryId: string;
  readonly toEntryId: string;
  enabled: boolean;
  note: string;
}

export type StandardWorkHandoverPatch = Partial<Pick<StandardWorkHandover, 'enabled' | 'note'>>;
export const cloneStandardWorkHandover = (value: StandardWorkHandover): StandardWorkHandover => ({ ...value });

export function isValidStandardWorkHandover(value: StandardWorkHandover): boolean {
  return /^SWH-\d+$/.test(value.id) && /^SW-\d+$/.test(value.studyId)
    && /^SWE-\d+$/.test(value.fromEntryId) && /^SWE-\d+$/.test(value.toEntryId)
    && value.fromEntryId !== value.toEntryId && typeof value.enabled === 'boolean'
    && value.note.length <= STANDARD_WORK_HANDOVER_LIMITS.note;
}
