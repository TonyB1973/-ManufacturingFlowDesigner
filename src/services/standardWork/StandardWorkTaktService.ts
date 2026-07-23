import type { StandardWorkPlanningParameters } from '../../models/standardWork/StandardWorkPlanning';

export interface StandardWorkTaktResult {
  readonly valid: boolean;
  readonly active: boolean;
  readonly netAvailableProductionSeconds: number | null;
  readonly taktTimeSeconds: number | null;
  readonly errors: readonly string[];
}

export function calculateStandardWorkTakt(parameters: StandardWorkPlanningParameters): StandardWorkTaktResult {
  const errors: string[] = [];
  if (!Number.isFinite(parameters.scheduledProductionTimeSeconds) || parameters.scheduledProductionTimeSeconds <= 0) errors.push('Scheduled production time must be finite and greater than zero.');
  if (!Number.isFinite(parameters.plannedBreakTimeSeconds) || parameters.plannedBreakTimeSeconds < 0) errors.push('Planned break time must be finite and non-negative.');
  if (!Number.isFinite(parameters.plannedDowntimeSeconds) || parameters.plannedDowntimeSeconds < 0) errors.push('Planned downtime must be finite and non-negative.');
  if (Number.isFinite(parameters.scheduledProductionTimeSeconds) && Number.isFinite(parameters.plannedBreakTimeSeconds) && Number.isFinite(parameters.plannedDowntimeSeconds) && parameters.plannedBreakTimeSeconds + parameters.plannedDowntimeSeconds >= parameters.scheduledProductionTimeSeconds) errors.push('Planned break and downtime must be less than scheduled production time.');
  if (!Number.isFinite(parameters.requiredOutputUnits) || parameters.requiredOutputUnits <= 0) errors.push('Required output must be finite and greater than zero.');
  if (errors.length) return { valid: false, active: parameters.active, netAvailableProductionSeconds: null, taktTimeSeconds: null, errors };
  const net = parameters.scheduledProductionTimeSeconds - parameters.plannedBreakTimeSeconds - parameters.plannedDowntimeSeconds;
  if (!(net > 0)) return { valid: false, active: parameters.active, netAvailableProductionSeconds: null, taktTimeSeconds: null, errors: ['Net available production time must be greater than zero.'] };
  return { valid: true, active: parameters.active, netAvailableProductionSeconds: net, taktTimeSeconds: net / parameters.requiredOutputUnits, errors: [] };
}
