import type { StandardWorkChartSchedule, StandardWorkOperatorWorkload } from '../../models/standardWork/StandardWorkChartModels';
import type { StandardWorkOperator } from '../../models/standardWork/StandardWorkOperator';

export interface StandardWorkOperatorBalance extends StandardWorkOperatorWorkload {
  readonly name: string; readonly role: string; readonly displayOrder: number; readonly active: boolean;
  readonly workloadDeltaSeconds: number | null; readonly workloadRatio: number | null; readonly workloadPercent: number | null;
  readonly spareTimeSeconds: number | null; readonly overloadSeconds: number | null; readonly laneDeltaSeconds: number | null;
}
export interface StandardWorkBalanceResult {
  readonly available: boolean; readonly operators: readonly StandardWorkOperatorBalance[]; readonly includedOperatorCount: number;
  readonly totalOperatorOccupiedSeconds: number; readonly availableOperatorCapacitySeconds: number | null;
  readonly balanceEfficiencyPercent: number | null; readonly balanceLossPercent: number | null; readonly workloadSpreadSeconds: number;
  readonly minimumWorkloadSeconds: number; readonly maximumWorkloadSeconds: number; readonly meanWorkloadSeconds: number; readonly medianWorkloadSeconds: number; readonly standardDeviationSeconds: number;
  readonly theoreticalMinimumOperators: number | null; readonly operatorCountDifference: number | null; readonly highestAssignedWorkload: StandardWorkOperatorBalance | null;
}
export function calculateStandardWorkBalance(schedule: StandardWorkChartSchedule, operators: readonly StandardWorkOperator[], taktTimeSeconds: number | null): StandardWorkBalanceResult {
  const workloadById = new Map(schedule.operatorSummaries.map((item) => [item.operatorId, item]));
  const relevant = [...operators].filter((operator) => operator.active || (workloadById.get(operator.id)?.entryCount ?? 0) > 0).sort((a, b) => a.displayOrder - b.displayOrder || a.id.localeCompare(b.id));
  const validTakt = taktTimeSeconds !== null && Number.isFinite(taktTimeSeconds) && taktTimeSeconds > 0;
  const rows: StandardWorkOperatorBalance[] = relevant.map((operator) => {
    const work = workloadById.get(operator.id) ?? { operatorId: operator.id, manualSeconds: 0, walkingSeconds: 0, waitingSeconds: 0, automaticLaunchCount: 0, automaticLaunchedSeconds: 0, occupiedSeconds: 0, productiveSeconds: 0, dependencyIdleSeconds: 0, entryCount: 0, endSeconds: 0, occupiedShareOfChartSpan: 0 };
    return { ...work, name: operator.name, role: operator.role, displayOrder: operator.displayOrder, active: operator.active, workloadDeltaSeconds: validTakt ? work.occupiedSeconds - taktTimeSeconds! : null, workloadRatio: validTakt ? work.occupiedSeconds / taktTimeSeconds! : null, workloadPercent: validTakt ? work.occupiedSeconds / taktTimeSeconds! * 100 : null, spareTimeSeconds: validTakt ? Math.max(0, taktTimeSeconds! - work.occupiedSeconds) : null, overloadSeconds: validTakt ? Math.max(0, work.occupiedSeconds - taktTimeSeconds!) : null, laneDeltaSeconds: validTakt ? work.endSeconds - taktTimeSeconds! : null };
  });
  const values = rows.map((row) => row.occupiedSeconds).sort((a, b) => a - b); const count = rows.length; const total = values.reduce((sum, value) => sum + value, 0); const mean = count ? total / count : 0; const median = count ? count % 2 ? values[Math.floor(count / 2)] : (values[count / 2 - 1] + values[count / 2]) / 2 : 0; const deviation = count ? Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / count) : 0;
  const availableCapacity = validTakt ? count * taktTimeSeconds! : null; const efficiency = availableCapacity && availableCapacity > 0 ? total / availableCapacity * 100 : null; const theoretical = validTakt ? Math.ceil(total / taktTimeSeconds!) : null;
  const highest = [...rows].sort((a, b) => b.occupiedSeconds - a.occupiedSeconds || a.displayOrder - b.displayOrder || a.operatorId.localeCompare(b.operatorId))[0] ?? null;
  return { available: validTakt, operators: rows, includedOperatorCount: count, totalOperatorOccupiedSeconds: total, availableOperatorCapacitySeconds: availableCapacity, balanceEfficiencyPercent: efficiency, balanceLossPercent: efficiency === null ? null : Math.max(0, 100 - efficiency), workloadSpreadSeconds: count ? values[count - 1] - values[0] : 0, minimumWorkloadSeconds: values[0] ?? 0, maximumWorkloadSeconds: values.at(-1) ?? 0, meanWorkloadSeconds: mean, medianWorkloadSeconds: median, standardDeviationSeconds: deviation, theoreticalMinimumOperators: theoretical, operatorCountDifference: theoretical === null ? null : count - theoretical, highestAssignedWorkload: highest };
}
