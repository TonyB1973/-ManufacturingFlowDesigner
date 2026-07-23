import { loadTypeScriptModule as loadModule } from './load-typescript-module.mjs';
const load = (path) => loadModule(path, import.meta.url);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const close = (actual, expected, message) => assert(Math.abs(actual - expected) < 1e-9, `${message}: expected ${expected}, received ${actual}`);

const { StandardWorkChartScheduler } = await load('../src/services/standardWork/StandardWorkChartScheduler.ts');
const { chooseStandardWorkMajorInterval, resolveStandardWorkMajorInterval, buildStandardWorkTicks, fitStandardWorkPixelsPerSecond } = await load('../src/services/standardWork/StandardWorkChartScale.ts');
const { DEFAULT_STANDARD_WORK_CHART_SETTINGS, isValidStandardWorkChartSettings } = await load('../src/models/standardWork/StandardWorkChartSettings.ts');
const { createDemoProject } = await load('../src/services/project/DemoProjectFactory.ts');
const { deserializeProject } = await load('../src/services/project/ProjectDeserializer.ts');
const { CommandFactory } = await load('../src/services/history/CommandFactory.ts');
const { CommandHistoryService } = await load('../src/services/history/CommandHistoryService.ts');
const { StandardWorkSelectionStore } = await load('../src/services/standardWork/StandardWorkSelectionStore.ts');

const operations = new Map(); const resources = new Map();
const operation = (id, timingCategory, cycleTimeSeconds, assignedResourceId = null, name = id) => { const value = { id, name, timingCategory, cycleTimeSeconds, assignedResourceId }; operations.set(id, value); return value; };
const resource = (id, name, active = true, visible = true) => { const value = { id, name, active, visible }; resources.set(id, value); return value; };
const scheduler = new StandardWorkChartScheduler({ getOperation: (id) => operations.get(id) }, { getResource: (id) => resources.get(id) });
const study = { id: 'SW-0001', name: 'Chart Test' };
const entry = (id, operationId, order, occurrences = 1, enabled = true) => ({ id, studyId: study.id, operationId, order, occurrences, enabled, notes: '' });

let schedule = scheduler.calculate(study, []);
assert(schedule.chartCycleSpanSeconds === 0 && schedule.diagnostics.some((item) => item.code === 'no-enabled-entries'), 'Empty study is safe and diagnosed');

resource('RES-0001', 'Machine A'); resource('RES-0002', 'Machine B');
operation('OP-M1', 'manual', 10); operation('OP-A1', 'automatic', 40, 'RES-0001'); operation('OP-W1', 'walking', 5); operation('OP-M2', 'manual', 15);
schedule = scheduler.calculate(study, [entry('SWE-1', 'OP-M1', 10), entry('SWE-2', 'OP-A1', 20), entry('SWE-3', 'OP-W1', 30), entry('SWE-4', 'OP-M2', 40)]);
const block = (id) => [...schedule.operatorBlocks, ...schedule.automaticBlocks].find((item) => item.entryId === id);
assert(block('SWE-1').startSeconds === 0 && block('SWE-1').endSeconds === 10, 'Manual entry advances from zero');
assert(block('SWE-2').startSeconds === 10 && block('SWE-2').endSeconds === 50, 'Automatic entry starts at cursor and runs independently');
assert(block('SWE-3').startSeconds === 10 && block('SWE-3').endSeconds === 15, 'Walking follows unchanged cursor and advances it');
assert(block('SWE-4').startSeconds === 15 && block('SWE-4').endSeconds === 30, 'Following Manual entry uses advanced cursor');
assert(schedule.operatorEndSeconds === 30 && schedule.latestAutomaticEndSeconds === 50 && schedule.chartCycleSpanSeconds === 50 && schedule.automaticOverrunSeconds === 20, 'Chart span and automatic overrun use independent extents');
assert(schedule.summary.operatorOccupiedSeconds === 30 && schedule.summary.operatorProductiveSeconds === 30 && schedule.summary.automaticSeconds === 40, 'Operator and automatic summaries remain distinct');

operation('OP-WAIT', 'waiting', 7); schedule = scheduler.calculate(study, [entry('SWE-1', 'OP-M1', 10), entry('SWE-W', 'OP-WAIT', 20), entry('SWE-4', 'OP-M2', 30)]);
assert(schedule.operatorBlocks[2].startSeconds === 17 && schedule.operatorEndSeconds === 32 && schedule.summary.waitingSeconds === 7, 'Explicit Waiting advances the operator cursor');

operation('OP-A2', 'automatic', 30, 'RES-0001'); operation('OP-A3', 'automatic', 12, 'RES-0002');
schedule = scheduler.calculate(study, [entry('SWE-1', 'OP-M1', 10), entry('SWE-2', 'OP-A1', 20), entry('SWE-A2', 'OP-A2', 30), entry('SWE-A3', 'OP-A3', 40), entry('SWE-4', 'OP-M2', 50)]);
assert(schedule.automaticBlocks.every((item) => item.startSeconds === 10), 'Consecutive Automatic entries begin at the unchanged cursor');
assert(schedule.resourceLanes.length === 2 && schedule.resourceLanes.find((lane) => lane.assignedResourceId === 'RES-0001').stackCount === 2, 'Automatic resources create lanes and same-lane overlaps stack');
assert(schedule.summary.potentialOverlapCount === 1 && schedule.diagnostics.some((item) => item.code === 'potential-resource-overlap'), 'Potential same-resource overlap is deterministic and visible');
resources.get('RES-0001').name = 'Renamed Machine'; assert(scheduler.calculate(study, [entry('SWE-2', 'OP-A1', 10)]).resourceLanes[0].label.includes('Renamed Machine'), 'Resource lane name resolves dynamically');
resources.get('RES-0001').active = false; assert(scheduler.calculate(study, [entry('SWE-2', 'OP-A1', 10)]).diagnostics.some((item) => item.code === 'inactive-resource'), 'Inactive resource produces chart warning'); resources.get('RES-0001').active = true;
resources.get('RES-0001').visible = false; assert(scheduler.calculate(study, [entry('SWE-2', 'OP-A1', 10)]).resourceLanes.length === 1, 'Hidden Factory Layout resource still resolves to a chart lane');

operation('OP-UA', 'automatic', 8, null); schedule = scheduler.calculate(study, [entry('SWE-UA', 'OP-UA', 10)]); assert(schedule.resourceLanes[0].id === 'automatic:unassigned' && schedule.diagnostics.some((item) => item.code === 'unassigned-automatic'), 'Unassigned Automatic lane and warning are produced');
operation('OP-Z', 'manual', 0); schedule = scheduler.calculate(study, [entry('SWE-Z', 'OP-Z', 10)]); assert(schedule.chartCycleSpanSeconds === 0 && schedule.summary.zeroTimeEntryCount === 1 && schedule.diagnostics.some((item) => item.code === 'zero-duration'), 'Zero-duration entry remains a marker without fabricated time');
operation('OP-D', 'manual', 1.25); schedule = scheduler.calculate(study, [entry('SWE-D', 'OP-D', 10, 3)]); close(schedule.chartCycleSpanSeconds, 3.75, 'Decimal duration and occurrences retain precision');
schedule = scheduler.calculate(study, [entry('SWE-OFF', 'OP-M1', 10, 1, false), entry('SWE-D', 'OP-D', 20)]); assert(schedule.disabledEntryIds.includes('SWE-OFF') && schedule.summary.enabledEntryCount === 1 && schedule.chartCycleSpanSeconds === 1.25, 'Disabled entry is excluded from scheduling and span');

operation('OP-BAD-CATEGORY', 'invalid', 1); operation('OP-BAD-NEGATIVE', 'manual', -1); operation('OP-BAD-NAN', 'manual', Number.NaN);
schedule = scheduler.calculate(study, [entry('SWE-MISSING', 'OP-MISSING', 10), entry('SWE-CAT', 'OP-BAD-CATEGORY', 20), entry('SWE-NEG', 'OP-BAD-NEGATIVE', 30), entry('SWE-NAN', 'OP-BAD-NAN', 40)]);
assert(schedule.diagnostics.filter((item) => item.severity === 'error').map((item) => item.code).join(',') === 'invalid-duration,invalid-duration,invalid-timing-category,missing-operation', 'Invalid inputs are rejected with deterministic diagnostics ordering');

const deterministicEntries = [entry('SWE-20', 'OP-M1', 10), entry('SWE-10', 'OP-D', 10)]; const first = scheduler.calculate(study, deterministicEntries); const second = scheduler.calculate(study, [...deterministicEntries].reverse()); assert(first.operatorBlocks.map((item) => item.entryId).join(',') === 'SWE-10,SWE-20' && JSON.stringify(first) === JSON.stringify(second), 'Equal order uses stable ID sorting independent of insertion order');
operation('OP-LARGE', 'manual', .001); const largeEntries = Array.from({ length: 100_000 }, (_, index) => entry(`SWE-L${String(index).padStart(6, '0')}`, 'OP-LARGE', index + 1)); schedule = scheduler.calculate(study, largeEntries); close(schedule.chartCycleSpanSeconds, 100, 'A 100,000-entry study schedules without dropping blocks'); assert(schedule.operatorBlocks.length === 100_000, 'Large-study schedule retains every timing block');
operation('OP-SHARED', 'automatic', 1, 'RES-0001'); const overlappingEntries = Array.from({ length: 5_000 }, (_, index) => entry(`SWE-A${String(index).padStart(5, '0')}`, 'OP-SHARED', index + 1)); schedule = scheduler.calculate(study, overlappingEntries); assert(schedule.resourceLanes[0].stackCount === 5_000 && schedule.summary.potentialOverlapCount === 12_497_500, 'Dense same-resource overlap uses deterministic bounded interval tracking');

assert(chooseStandardWorkMajorInterval(.8, 800) <= .2 && chooseStandardWorkMajorInterval(7200, 800) >= 600, 'Automatic grid interval handles sub-second and multi-hour spans');
assert(resolveStandardWorkMajorInterval({ ...DEFAULT_STANDARD_WORK_CHART_SETTINGS, intervalMode: 'fixed', fixedMajorIntervalSeconds: 7 }, 100, 800) === 7, 'Fixed grid interval is honoured');
const ticks = buildStandardWorkTicks(0, 10, 5, 5, true); assert(ticks.length === 11 && ticks.filter((item) => item.major).map((item) => item.seconds).join(',') === '0,5,10', 'Major and minor ticks are aligned without duplicates');
assert(fitStandardWorkPixelsPerSecond(0, 800) > 0 && fitStandardWorkPixelsPerSecond(100, 1040) === 10, 'Fit Chart is safe for zero and normal spans');
assert(isValidStandardWorkChartSettings(DEFAULT_STANDARD_WORK_CHART_SETTINGS) && !isValidStandardWorkChartSettings({ ...DEFAULT_STANDARD_WORK_CHART_SETTINGS, fixedMajorIntervalSeconds: 0 }) && !isValidStandardWorkChartSettings({ ...DEFAULT_STANDARD_WORK_CHART_SETTINGS, minorSubdivisions: 99 }), 'Chart settings have typed validation');

let projectSettings = { standardWork: { timeFormat: 'seconds', chart: { ...DEFAULT_STANDARD_WORK_CHART_SETTINGS } } }; const selection = new StandardWorkSelectionStore(); const project = { getMetadata: () => ({ id: 'PRJ-CHART' }), getSettings: () => structuredClone(projectSettings), applySettings: (patch) => { const next = { ...projectSettings, ...patch, standardWork: { ...projectSettings.standardWork, ...patch.standardWork, chart: { ...projectSettings.standardWork.chart, ...patch.standardWork?.chart } } }; if (!isValidStandardWorkChartSettings(next.standardWork.chart)) return false; projectSettings = next; return true; } }; const commandContext = { project, standardWorkSelection: selection }; const history = new CommandHistoryService(commandContext, 20); const projectCommands = new CommandFactory(history, commandContext); history.markSaved();
const changed = { ...projectSettings.standardWork.chart, showOperationNames: false, laneDensity: 'compact' }; assert(projectCommands.updateProjectSettings({ standardWork: { ...projectSettings.standardWork, chart: changed } }) && !history.getState().atSavedCheckpoint && projectSettings.standardWork.chart.laneDensity === 'compact', 'Persistent chart setting creates one dirty history command');
history.undo(); assert(history.getState().atSavedCheckpoint && projectSettings.standardWork.chart.showOperationNames && projectSettings.standardWork.chart.laneDensity === 'comfortable', 'Undo restores chart settings and saved checkpoint'); history.redo(); assert(!history.getState().atSavedCheckpoint && !projectSettings.standardWork.chart.showOperationNames, 'Redo reapplies chart settings');
const position = history.getState().currentPosition; selection.select({ kind: 'standardWorkEntry', id: 'SWE-D' }); assert(history.getState().currentPosition === position, 'Chart selection creates no history and no independent dirty action');

const current = createDemoProject(); const { activeScenarioId: _activeScenarioId, scenarios: _scenarios, ...currentShared } = current; const schema15 = { ...currentShared, ...current.scenarios[0].state, schemaVersion: '1.5.0', applicationVersion: '0.7.0', settings: { ...current.settings, standardWork: { timeFormat: 'minutesSeconds' } } }; const migrated = deserializeProject(JSON.stringify(schema15));
assert(migrated.migratedFrom === '1.5.0' && migrated.document.schemaVersion === '2.0.0' && migrated.document.settings.standardWork.timeFormat === 'minutesSeconds' && migrated.document.settings.standardWork.chart.showAutomaticLanes && migrated.document.scenarios[0].state.standardWorkStudies.length === current.scenarios[0].state.standardWorkStudies.length, 'Schema 1.5 migrates explicitly to availability-capable chart settings and the scenario envelope while preserving Standard Work data');
const serialized = JSON.stringify(current); assert(!serialized.includes('chartCycleSpanSeconds') && !serialized.includes('operatorBlocks') && !serialized.includes('resourceLanes') && !serialized.includes('diagnostics'), 'Derived chart schedule, lanes, span, and diagnostics are excluded from persistence');

console.log('Standard Work Combination Chart scheduler, scale, settings, and migration checks passed.');
