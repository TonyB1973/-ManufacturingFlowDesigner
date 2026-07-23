export const STANDARD_WORK_PLANNING_LIMITS = {
  scheduledProductionTimeSeconds: 31_536_000,
  requiredOutputUnits: 1_000_000_000,
  periodName: 200,
  notes: 10_000,
} as const;

export interface StandardWorkPlanningParameters {
  readonly studyId: string;
  periodName: string;
  scheduledProductionTimeSeconds: number;
  plannedBreakTimeSeconds: number;
  plannedDowntimeSeconds: number;
  requiredOutputUnits: number;
  active: boolean;
  notes: string;
}

export type StandardWorkPlanningPatch = Partial<Omit<StandardWorkPlanningParameters, 'studyId'>>;

export const createDefaultStandardWorkPlanning = (studyId: string): StandardWorkPlanningParameters => ({
  studyId,
  periodName: 'Shift',
  scheduledProductionTimeSeconds: 28_800,
  plannedBreakTimeSeconds: 0,
  plannedDowntimeSeconds: 0,
  requiredOutputUnits: 1,
  active: false,
  notes: '',
});

export const cloneStandardWorkPlanning = (value: StandardWorkPlanningParameters): StandardWorkPlanningParameters => ({ ...value });

export function isValidStandardWorkPlanning(value: StandardWorkPlanningParameters): boolean {
  return /^SW-\d+$/.test(value.studyId)
    && typeof value.periodName === 'string' && value.periodName.length <= STANDARD_WORK_PLANNING_LIMITS.periodName
    && Number.isFinite(value.scheduledProductionTimeSeconds) && value.scheduledProductionTimeSeconds > 0
    && value.scheduledProductionTimeSeconds <= STANDARD_WORK_PLANNING_LIMITS.scheduledProductionTimeSeconds
    && Number.isFinite(value.plannedBreakTimeSeconds) && value.plannedBreakTimeSeconds >= 0
    && value.plannedBreakTimeSeconds <= value.scheduledProductionTimeSeconds
    && Number.isFinite(value.plannedDowntimeSeconds) && value.plannedDowntimeSeconds >= 0
    && value.plannedDowntimeSeconds <= value.scheduledProductionTimeSeconds
    && value.plannedBreakTimeSeconds + value.plannedDowntimeSeconds < value.scheduledProductionTimeSeconds
    && Number.isFinite(value.requiredOutputUnits) && value.requiredOutputUnits > 0
    && value.requiredOutputUnits <= STANDARD_WORK_PLANNING_LIMITS.requiredOutputUnits
    && typeof value.active === 'boolean'
    && typeof value.notes === 'string' && value.notes.length <= STANDARD_WORK_PLANNING_LIMITS.notes;
}
