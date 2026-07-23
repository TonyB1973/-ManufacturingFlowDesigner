import type { StandardWorkPlanningParameters } from '../../models/standardWork/StandardWorkPlanning';
import type { StandardWorkChartSchedule } from '../../models/standardWork/StandardWorkChartModels';
import type { StandardWorkBalanceResult } from './StandardWorkBalanceService';
import type { StandardWorkCapacityResult } from './StandardWorkCapacityService';
import type { StandardWorkTaktResult } from './StandardWorkTaktService';

export interface StandardWorkAnalysisIssue { readonly severity: 'error' | 'warning' | 'information'; readonly code: string; readonly message: string; readonly studyId: string; readonly operatorId?: string; }

export function validateStandardWorkAnalysis(parameters: StandardWorkPlanningParameters, takt: StandardWorkTaktResult, schedule: StandardWorkChartSchedule, balance: StandardWorkBalanceResult, capacity: StandardWorkCapacityResult): readonly StandardWorkAnalysisIssue[] {
  const issues: StandardWorkAnalysisIssue[] = takt.errors.map((message, index) => ({ severity: 'error', code: `invalid-planning-${index + 1}`, message, studyId: parameters.studyId }));
  if (!parameters.periodName.trim()) issues.push({ severity: 'warning', code: 'empty-planning-period', message: 'Planning period name is empty.', studyId: parameters.studyId });
  if (!parameters.active) { issues.push({ severity: 'information', code: 'analysis-disabled', message: 'Takt analysis is disabled.', studyId: parameters.studyId }); return issues; }
  if (!takt.valid || takt.taktTimeSeconds === null) return issues;
  if (!schedule.summary.enabledEntryCount) issues.push({ severity: 'warning', code: 'analysis-no-enabled-entries', message: 'Takt analysis is active but the study has no enabled entries.', studyId: parameters.studyId });
  if (!balance.operators.some((operator) => operator.entryCount > 0)) issues.push({ severity: 'warning', code: 'analysis-no-operator-work', message: 'Takt analysis is active but no operators have enabled entries.', studyId: parameters.studyId });
  for (const operator of balance.operators) {
    if ((operator.overloadSeconds ?? 0) > 1e-9) issues.push({ severity: 'warning', code: 'operator-over-takt', message: `${operator.name} exceeds takt by ${operator.overloadSeconds} seconds.`, studyId: parameters.studyId, operatorId: operator.operatorId });
    else issues.push({ severity: 'information', code: 'operator-spare-to-takt', message: `${operator.name} has ${operator.spareTimeSeconds ?? 0} seconds spare to takt.`, studyId: parameters.studyId, operatorId: operator.operatorId });
    if ((operator.laneDeltaSeconds ?? 0) > 1e-9) issues.push({ severity: 'warning', code: 'operator-lane-over-takt', message: `${operator.name} lane completion exceeds takt by ${operator.laneDeltaSeconds} seconds.`, studyId: parameters.studyId, operatorId: operator.operatorId });
    if (operator.dependencyIdleSeconds > 1e-9) issues.push({ severity: 'information', code: 'operator-dependency-idle', message: `${operator.name} has ${operator.dependencyIdleSeconds} seconds dependency idle.`, studyId: parameters.studyId, operatorId: operator.operatorId });
  }
  if ((capacity.cycleSpanDeltaSeconds ?? 0) > 1e-9) issues.push({ severity: 'warning', code: 'cycle-span-over-takt', message: `Chart cycle span exceeds takt by ${capacity.cycleSpanDeltaSeconds} seconds.`, studyId: parameters.studyId });
  if (capacity.status === 'nominalShortfall') issues.push({ severity: 'warning', code: 'nominal-capacity-shortfall', message: `Chart-based nominal capacity is below required demand by ${Math.abs(capacity.capacityDeltaUnits ?? 0)} units.`, studyId: parameters.studyId });
  else if (capacity.status === 'meetsNominalDemand' && (capacity.capacityDeltaUnits ?? 0) > 1e-9) issues.push({ severity: 'information', code: 'nominal-capacity-surplus', message: `Chart-based nominal capacity exceeds demand by ${capacity.capacityDeltaUnits} units.`, studyId: parameters.studyId });
  if (balance.theoreticalMinimumOperators !== null && balance.includedOperatorCount < balance.theoreticalMinimumOperators) issues.push({ severity: 'warning', code: 'operator-count-below-theoretical', message: `Included operator count is below the theoretical minimum of ${balance.theoreticalMinimumOperators}.`, studyId: parameters.studyId });
  else if (balance.theoreticalMinimumOperators !== null && balance.includedOperatorCount > balance.theoreticalMinimumOperators) issues.push({ severity: 'information', code: 'operator-count-above-theoretical', message: `Included operator count exceeds the theoretical minimum by ${balance.includedOperatorCount - balance.theoreticalMinimumOperators}.`, studyId: parameters.studyId });
  for (const diagnostic of schedule.diagnostics.filter((item) => item.code === 'unassigned-automatic' || item.code === 'potential-resource-overlap')) issues.push({ severity: 'warning', code: diagnostic.code, message: diagnostic.message, studyId: parameters.studyId, operatorId: diagnostic.operatorId });
  return issues.sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || a.code.localeCompare(b.code) || (a.operatorId ?? '').localeCompare(b.operatorId ?? ''));
}
const severityRank = (severity: StandardWorkAnalysisIssue['severity']): number => severity === 'error' ? 0 : severity === 'warning' ? 1 : 2;
