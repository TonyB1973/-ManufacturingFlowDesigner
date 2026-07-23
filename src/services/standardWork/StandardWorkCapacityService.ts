import type { StandardWorkTaktResult } from './StandardWorkTaktService';

export type StandardWorkCapacityStatus = 'meetsNominalDemand' | 'nominalShortfall' | 'analysisUnavailable' | 'invalidPlanningInputs';
export interface StandardWorkCapacityResult {
  readonly status: StandardWorkCapacityStatus;
  readonly chartCycleSpanSeconds: number;
  readonly cycleSpanDeltaSeconds: number | null;
  readonly cycleSpanRatio: number | null;
  readonly nominalUnitsPerPeriod: number | null;
  readonly wholeNominalUnitsPerPeriod: number | null;
  readonly capacityDeltaUnits: number | null;
  readonly capacityRatio: number | null;
}
const epsilon = 1e-9;
export function calculateStandardWorkCapacity(takt: StandardWorkTaktResult, chartCycleSpanSeconds: number, requiredOutputUnits: number): StandardWorkCapacityResult {
  const unavailable = (status: StandardWorkCapacityStatus): StandardWorkCapacityResult => ({ status, chartCycleSpanSeconds, cycleSpanDeltaSeconds: null, cycleSpanRatio: null, nominalUnitsPerPeriod: null, wholeNominalUnitsPerPeriod: null, capacityDeltaUnits: null, capacityRatio: null });
  if (!takt.valid || takt.taktTimeSeconds === null || takt.netAvailableProductionSeconds === null) return unavailable('invalidPlanningInputs');
  if (!takt.active || !Number.isFinite(chartCycleSpanSeconds) || chartCycleSpanSeconds <= 0) return unavailable('analysisUnavailable');
  const nominal = takt.netAvailableProductionSeconds / chartCycleSpanSeconds;
  const delta = nominal - requiredOutputUnits;
  return { status: delta < -epsilon ? 'nominalShortfall' : 'meetsNominalDemand', chartCycleSpanSeconds, cycleSpanDeltaSeconds: chartCycleSpanSeconds - takt.taktTimeSeconds, cycleSpanRatio: chartCycleSpanSeconds / takt.taktTimeSeconds, nominalUnitsPerPeriod: nominal, wholeNominalUnitsPerPeriod: Math.floor(nominal), capacityDeltaUnits: delta, capacityRatio: nominal / requiredOutputUnits };
}
