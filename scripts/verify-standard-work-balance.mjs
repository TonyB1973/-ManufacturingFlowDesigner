import { loadTypeScriptModule as loadModule } from './load-typescript-module.mjs';

const load = (path) => loadModule(path, import.meta.url);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const close = (left, right, tolerance = 1e-9) => Math.abs(left - right) <= tolerance;

const { calculateStandardWorkTakt } = await load('../src/services/standardWork/StandardWorkTaktService.ts');
const { calculateStandardWorkCapacity } = await load('../src/services/standardWork/StandardWorkCapacityService.ts');
const { calculateStandardWorkBalance } = await load('../src/services/standardWork/StandardWorkBalanceService.ts');
const { createStandardWorkYamazumiModel } = await load('../src/models/standardWork/StandardWorkYamazumiModels.ts');
const { validateStandardWorkAnalysis } = await load('../src/services/standardWork/StandardWorkAnalysisValidation.ts');
const { createDefaultStandardWorkPlanning } = await load('../src/models/standardWork/StandardWorkPlanning.ts');
const { StandardWorkPlanningStore } = await load('../src/services/standardWork/StandardWorkPlanningStore.ts');
const { StandardWorkPlanningCommandFactory } = await load('../src/services/history/StandardWorkPlanningCommandFactory.ts');
const { CommandHistoryService } = await load('../src/services/history/CommandHistoryService.ts');

const planning = { ...createDefaultStandardWorkPlanning('SW-0001'), scheduledProductionTimeSeconds: 28_800, plannedBreakTimeSeconds: 1_800, requiredOutputUnits: 300, active: true };
const takt = calculateStandardWorkTakt(planning);
assert(takt.valid && takt.active && takt.netAvailableProductionSeconds === 27_000 && takt.taktTimeSeconds === 90, 'Takt subtracts planned breaks and derives the 90-second example exactly');
const decimalTakt = calculateStandardWorkTakt({ ...planning, plannedBreakTimeSeconds: 0.5, plannedDowntimeSeconds: 0.25, requiredOutputUnits: 2.5 });
assert(decimalTakt.valid && close(decimalTakt.netAvailableProductionSeconds, 28_799.25) && close(decimalTakt.taktTimeSeconds, 11_519.7), 'Fractional planning inputs retain decimal precision');
for (const [patch, label] of [
  [{ scheduledProductionTimeSeconds: 0 }, 'zero scheduled time'],
  [{ scheduledProductionTimeSeconds: Number.POSITIVE_INFINITY }, 'non-finite scheduled time'],
  [{ plannedBreakTimeSeconds: -1 }, 'negative break'],
  [{ plannedDowntimeSeconds: -1 }, 'negative downtime'],
  [{ plannedBreakTimeSeconds: 28_800 }, 'break equal to scheduled time'],
  [{ plannedBreakTimeSeconds: 20_000, plannedDowntimeSeconds: 9_000 }, 'break plus downtime above scheduled time'],
  [{ requiredOutputUnits: 0 }, 'zero output'],
  [{ requiredOutputUnits: -1 }, 'negative output'],
  [{ requiredOutputUnits: Number.NaN }, 'non-finite output'],
]) assert(!calculateStandardWorkTakt({ ...planning, ...patch }).valid, `Takt rejects ${label}`);
const inactiveTakt = calculateStandardWorkTakt({ ...planning, active: false });
assert(inactiveTakt.valid && !inactiveTakt.active && inactiveTakt.taktTimeSeconds === 90, 'Inactive analysis preserves valid derived planning values without activating analysis');

const workload = (operatorId, occupied, dependencyIdle = 0, entryCount = 1, endSeconds = occupied) => ({ operatorId, manualSeconds: occupied - 20, walkingSeconds: 10, waitingSeconds: 10, automaticLaunchCount: 1, automaticLaunchedSeconds: 30, occupiedSeconds: occupied, productiveSeconds: occupied - 10, dependencyIdleSeconds: dependencyIdle, entryCount, endSeconds, occupiedShareOfChartSpan: occupied / 105 });
const summary = { enabledEntryCount: 4, manualSeconds: 130, walkingSeconds: 20, waitingSeconds: 20, automaticSeconds: 60, operatorOccupiedSeconds: 170, operatorProductiveSeconds: 150, operatorEndSeconds: 105, latestAutomaticEndSeconds: 105, automaticOverrunSeconds: 0, chartCycleSpanSeconds: 105, automaticLaneCount: 1, potentialOverlapCount: 0, zeroTimeEntryCount: 0, errorCount: 0, warningCount: 0 };
const schedule = { studyId: 'SW-0001', operatorBlocks: [], operatorLanes: [], handoverLinks: [], operatorCursors: {}, operatorSummaries: [workload('SWO-0001', 100, 5, 2, 105), workload('SWO-0002', 70, 0, 2, 70)], automaticBlocks: [], resourceLanes: [], disabledEntryIds: [], operatorEndSeconds: 105, overallOperatorEndSeconds: 105, latestAutomaticEndSeconds: 105, chartCycleSpanSeconds: 105, automaticOverrunSeconds: 0, dependencyIdleSeconds: 5, summary, diagnostics: [] };
const operators = [
  { id: 'SWO-0001', studyId: 'SW-0001', name: 'Operator 1', role: 'Build', displayOrder: 10, active: true, linkedResourceId: null, notes: '' },
  { id: 'SWO-0002', studyId: 'SW-0001', name: 'Operator 2', role: 'Pack', displayOrder: 20, active: true, linkedResourceId: null, notes: '' },
  { id: 'SWO-0003', studyId: 'SW-0001', name: 'Inactive unused', role: '', displayOrder: 30, active: false, linkedResourceId: null, notes: '' },
];
const balance = calculateStandardWorkBalance(schedule, operators, takt.taktTimeSeconds);
assert(balance.includedOperatorCount === 2 && balance.totalOperatorOccupiedSeconds === 170 && balance.availableOperatorCapacitySeconds === 180, 'Balance includes active or entry-owning operators and calculates available capacity');
assert(close(balance.balanceEfficiencyPercent, 94.44444444444444) && close(balance.balanceLossPercent, 5.555555555555557), 'Balance efficiency and loss use occupied work against operator takt capacity');
assert(balance.workloadSpreadSeconds === 30 && balance.minimumWorkloadSeconds === 70 && balance.maximumWorkloadSeconds === 100 && balance.meanWorkloadSeconds === 85 && balance.medianWorkloadSeconds === 85 && balance.standardDeviationSeconds === 15, 'Balance distribution metrics are deterministic');
assert(balance.theoreticalMinimumOperators === 2 && balance.operatorCountDifference === 0 && balance.highestAssignedWorkload.operatorId === 'SWO-0001', 'Theoretical minimum and highest assigned workload match the worked example');
assert(balance.operators[0].overloadSeconds === 10 && balance.operators[1].spareTimeSeconds === 20 && close(balance.operators[0].workloadPercent, 111.11111111111111), 'Per-operator overload, spare time, and workload percentage compare against takt');
assert(balance.operators[0].occupiedSeconds === 100 && balance.operators[0].automaticLaunchedSeconds === 30 && balance.operators[0].dependencyIdleSeconds === 5, 'Automatic and dependency-idle values remain separate from occupied work');
const noTakt = calculateStandardWorkBalance(schedule, operators, 0);
assert(!noTakt.available && noTakt.operators.every((row) => row.workloadPercent === null && row.spareTimeSeconds === null), 'Zero or invalid takt produces unavailable ratios safely');
const emptyBalance = calculateStandardWorkBalance({ ...schedule, operatorSummaries: [], summary: { ...summary, enabledEntryCount: 0 } }, [], 90);
assert(emptyBalance.includedOperatorCount === 0 && emptyBalance.totalOperatorOccupiedSeconds === 0 && emptyBalance.balanceEfficiencyPercent === null && emptyBalance.theoreticalMinimumOperators === 0, 'Zero-operator and zero-work balance is handled safely');
const tieSchedule = { ...schedule, operatorSummaries: [workload('SWO-0002', 80), workload('SWO-0001', 80)] };
assert(calculateStandardWorkBalance(tieSchedule, operators.slice(0, 2), 90).highestAssignedWorkload.operatorId === 'SWO-0001', 'Highest workload ties break by display order then stable ID');
const inactiveOwner = calculateStandardWorkBalance({ ...schedule, operatorSummaries: [workload('SWO-0003', 10)] }, operators, 90);
assert(inactiveOwner.operators.some((row) => row.operatorId === 'SWO-0003'), 'Inactive operators with enabled entries remain visible');

const capacity = calculateStandardWorkCapacity(takt, 105, planning.requiredOutputUnits);
assert(capacity.status === 'nominalShortfall' && close(capacity.nominalUnitsPerPeriod, 257.14285714285717) && capacity.wholeNominalUnitsPerPeriod === 257 && close(capacity.capacityDeltaUnits, -42.85714285714283), 'Chart-based nominal capacity and shortfall match the worked example');
assert(calculateStandardWorkCapacity(takt, 90, 300).status === 'meetsNominalDemand', 'A chart span equal to takt meets nominal demand');
assert(calculateStandardWorkCapacity(takt, 80, 300).capacityDeltaUnits > 0 && calculateStandardWorkCapacity(takt, 100, 300).capacityDeltaUnits < 0, 'Chart spans below and above takt produce surplus and shortfall respectively');
assert(calculateStandardWorkCapacity(takt, 0, 300).status === 'analysisUnavailable' && calculateStandardWorkCapacity(inactiveTakt, 90, 300).status === 'analysisUnavailable', 'Zero span and disabled analysis return unavailable capacity');
const nearEqual = calculateStandardWorkCapacity(takt, 90 + 1e-12, 300);
assert(nearEqual.status === 'meetsNominalDemand', 'Floating-point tolerance prevents a false nominal shortfall');

const yamazumi = createStandardWorkYamazumiModel(balance, 90, true);
assert(yamazumi.bars.length === 2 && yamazumi.taktTimeSeconds === 90 && yamazumi.maximumSeconds === 105, 'Yamazumi model provides one deterministic bar per included operator and retains takt');
assert(yamazumi.bars[0].segments.map((item) => item.category).join(',') === 'manual,walking,waiting,dependencyIdle' && yamazumi.bars[0].segments.at(-1).stackEndSeconds === 105, 'Yamazumi segments stack Manual, Walking, Waiting, then optional dependency idle');
assert(!yamazumi.bars[0].segments.some((item) => item.category === 'automatic') && createStandardWorkYamazumiModel(balance, 90, false).bars[0].segments.length === 3, 'Automatic is excluded and dependency idle is optional');

const issues = validateStandardWorkAnalysis(planning, takt, schedule, balance, capacity);
assert(issues.some((issue) => issue.code === 'operator-over-takt') && issues.some((issue) => issue.code === 'cycle-span-over-takt') && issues.some((issue) => issue.code === 'nominal-capacity-shortfall'), 'Active analysis emits deterministic over-takt, span, and shortfall warnings');
const disabledIssues = validateStandardWorkAnalysis({ ...planning, active: false }, inactiveTakt, schedule, balance, calculateStandardWorkCapacity(inactiveTakt, 105, 300));
assert(disabledIssues.some((issue) => issue.code === 'analysis-disabled') && !disabledIssues.some((issue) => issue.severity === 'warning' && ['operator-over-takt', 'cycle-span-over-takt', 'nominal-capacity-shortfall'].includes(issue.code)), 'Disabled analysis suppresses operational warnings while preserving an informational diagnostic');

const planningStore = new StandardWorkPlanningStore((id) => id === 'SW-0001');
assert(planningStore.restore(createDefaultStandardWorkPlanning('SW-0001')), 'Planning store accepts one valid study-specific record');
const history = new CommandHistoryService({ standardWorkPlanning: planningStore }, 20);
const commands = new StandardWorkPlanningCommandFactory(history, { standardWorkPlanning: planningStore });
history.markSaved();
assert(commands.update('SW-0001', { active: true, scheduledProductionTimeSeconds: 28_800, plannedBreakTimeSeconds: 1_800, plannedDowntimeSeconds: 300, requiredOutputUnits: 300, periodName: 'Day', notes: 'Demand plan' }, 'Update planning inputs'), 'A committed planning change creates one command');
assert(history.getState().undoCount === 1 && !history.isAtSavedCheckpoint() && planningStore.get('SW-0001').plannedDowntimeSeconds === 300, 'Planning edit marks history dirty and preserves exact values');
assert(history.undo() && history.isAtSavedCheckpoint() && planningStore.get('SW-0001').active === false, 'Undo restores the saved planning checkpoint exactly');
assert(history.redo() && !history.isAtSavedCheckpoint() && planningStore.get('SW-0001').periodName === 'Day', 'Redo restores planning values and dirty state');

console.log('Standard Work takt, capacity, work-balance, Yamazumi, validation, and planning-history checks passed.');
