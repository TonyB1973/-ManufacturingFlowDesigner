import { loadTypeScriptModule as loadModule } from './load-typescript-module.mjs';

const load = (path) => loadModule(path, import.meta.url);
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const { AvailabilityStore } = await load('../src/services/availability/AvailabilityStore.ts');
const { AvailabilityCalendarEvaluationService } = await load('../src/services/availability/AvailabilityCalendarEvaluationService.ts');
const { AvailabilityAssignmentResolver } = await load('../src/services/availability/AvailabilityAssignmentResolver.ts');
const { StandardWorkCalendarPlanningService } = await load('../src/services/availability/StandardWorkCalendarPlanningService.ts');
const { AvailabilityCoverageService } = await load('../src/services/availability/AvailabilityCoverageService.ts');
const { validateAvailability } = await load('../src/services/availability/AvailabilityValidationService.ts');
const { parseDateOnly, dateOnlyToDayNumber, dayNumberToDateOnly, weekdayForDateOnly, inclusiveDateCount } = await load('../src/services/availability/DateOnlyService.ts');
const { mergeIntervals, subtractIntervals, intervalDuration } = await load('../src/services/availability/IntervalService.ts');
const { createDefaultStandardWorkPlanning } = await load('../src/models/standardWork/StandardWorkPlanning.ts');
const { DEFAULT_PROJECT_SETTINGS } = await load('../src/models/project/ProjectDocument.ts');
const { AvailabilitySelectionStore } = await load('../src/services/availability/AvailabilitySelectionStore.ts');
const { AvailabilityCommandFactory } = await load('../src/services/history/AvailabilityCommandFactory.ts');
const { CommandHistoryService } = await load('../src/services/history/CommandHistoryService.ts');

assert(parseDateOnly('2024-02-29') && !parseDateOnly('2023-02-29') && !parseDateOnly('2024-13-01'), 'Date-only parsing validates Gregorian leap days and impossible dates');
for (const date of ['0001-01-01', '1970-01-01', '2026-12-25', '9999-12-31']) assert(dayNumberToDateOnly(dateOnlyToDayNumber(date)) === date, `Date-only round trip preserves ${date}`);
assert(weekdayForDateOnly('2026-12-25') === 'friday' && inclusiveDateCount('2026-12-25', '2026-12-25') === 1, 'Weekday and inclusive one-day ranges are deterministic');

const merged = mergeIntervals([{ start: 0, end: 10 }, { start: 5, end: 15 }, { start: 20, end: 25 }]);
assert(merged.length === 2 && intervalDuration(merged) === 20, 'Interval union removes overlap without double counting');
const net = subtractIntervals([{ start: 0, end: 20 }], [{ start: -5, end: 5 }, { start: 10, end: 12 }, { start: 18, end: 30 }]);
assert(net.length === 2 && intervalDuration(net) === 11, 'Interval subtraction clips deductions to scheduled availability');

const store = new AvailabilityStore();
const early = store.createShift('Early Shift'); assert(early?.id === 'SHF-0001', 'Shift IDs are stable and prefixed');
const firstBreak = store.createBreak(early.id); assert(firstBreak?.id === 'SHB-0001' && store.updateBreak(firstBreak.id, { name: 'Morning break', startOffsetMinutes: 120, durationMinutes: 15 }), 'Shift break creation and editing use stable IDs');
const lunch = store.createBreak(early.id); assert(lunch && store.updateBreak(lunch.id, { name: 'Lunch', startOffsetMinutes: 240, durationMinutes: 30 }), 'A second non-overlapping break is accepted');
assert(!store.updateBreak(lunch.id, { startOffsetMinutes: 125 }), 'Overlapping breaks are rejected without corrupting the model');
assert(!store.updateBreak(lunch.id, { startOffsetMinutes: 470, durationMinutes: 30 }), 'Breaks extending beyond the shift are rejected');
const night = store.createShift('Night Shift'); assert(night && store.updateShift(night.id, { startMinuteOfDay: 1_320, endMinuteOfDay: 360 }), 'Overnight shift wall-clock times are accepted');
const nightBreak = store.createBreak(night.id); assert(nightBreak && store.updateBreak(nightBreak.id, { startOffsetMinutes: 180, durationMinutes: 20 }), 'Overnight breaks use shift-start offsets and may resolve after midnight');

const calendar = store.createCalendar('Production Calendar'); assert(calendar?.id === 'CAL-0001', 'Calendar IDs are stable and prefixed');
for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']) assert(store.setDayShifts(calendar.id, day, [early.id]), `${day} accepts the Early Shift`);
assert(store.setDayShifts(calendar.id, 'monday', [early.id, night.id]), 'Multiple ordered shifts may be assigned to one weekday');
const closed = store.createException(calendar.id, '2026-12-25'); assert(closed?.id === 'CEX-0001', 'Exception IDs are stable and prefixed');
const replacement = store.createException(calendar.id, '2026-12-24', 'replaceShifts'); assert(replacement && store.updateException(replacement.id, { replacementShiftIds: [night.id] }), 'Replacement exceptions replace normal shifts by stable ID');
assert(!store.createException(calendar.id, '2026-12-25'), 'One exception per calendar and date is enforced');

const evaluator = new AvailabilityCalendarEvaluationService(store);
const monday = evaluator.evaluate(calendar.id, '2026-12-21', '2026-12-21');
assert(monday.valid && monday.grossScheduledSeconds === 57_600 && monday.plannedBreakSeconds === 3_900 && monday.netAvailableSeconds === 53_700, 'Early plus Night shifts derive exact gross, reducing-break, and net seconds');
assert(monday.resolvedShiftInstances.some((item) => item.shiftId === night.id && item.scheduledInterval.end > (dateOnlyToDayNumber('2026-12-21') + 1) * 1_440), 'The complete overnight shift assigned on the final selected date is counted');
const holidayRange = evaluator.evaluate(calendar.id, '2026-12-21', '2026-12-25');
assert(holidayRange.valid && holidayRange.closedDates.includes('2026-12-25') && holidayRange.exceptionCount === 2, 'Closed and replacement exceptions deterministically replace weekly schedules');
assert(holidayRange.dailySummaries.find((item) => item.date === '2026-12-24').shiftIds.join() === night.id, 'Replacement shifts are used instead of normal Thursday shifts');
assert(!evaluator.evaluate(calendar.id, '2026-12-25', '2026-12-24').valid, 'Reversed date ranges are rejected');
assert(!evaluator.evaluate(calendar.id, '2020-01-01', '2031-01-01').valid, 'Date ranges beyond the ten-year safety limit are rejected');

const overlapShift = store.createShift('Overlap Shift'); assert(overlapShift && store.updateShift(overlapShift.id, { startMinuteOfDay: 720, endMinuteOfDay: 960 }) && store.setDayShifts(calendar.id, 'tuesday', [early.id, overlapShift.id]), 'Calendar overlap fixture is accepted for multi-crew modelling');
const overlap = evaluator.evaluate(calendar.id, '2026-12-22', '2026-12-22');
assert(overlap.overlapDiagnostics.length === 1 && overlap.grossScheduledSeconds === 36_000, 'Overlapping calendar shifts warn and union to ten gross hours without double counting');

const planningService = new StandardWorkCalendarPlanningService(evaluator);
const manual = { ...createDefaultStandardWorkPlanning('SW-0001'), scheduledProductionTimeSeconds: 28_800, plannedBreakTimeSeconds: 1_800, plannedDowntimeSeconds: 300, requiredOutputUnits: 300, active: true };
const manualResult = planningService.resolve(manual); assert(manualResult.takt.taktTimeSeconds === 89 && manual.scheduledProductionTimeSeconds === 28_800, 'Manual mode preserves and uses stored Sprint 3.2 values');
const calendarPlanning = { ...manual, availabilityMode: 'calendar', planningCalendarId: calendar.id, periodStartDate: '2026-12-21', periodEndDate: '2026-12-21' };
const calendarResult = planningService.resolve(calendarPlanning); assert(calendarResult.scheduledProductionTimeSeconds === monday.grossScheduledSeconds && calendarResult.plannedBreakTimeSeconds === monday.plannedBreakSeconds && calendarResult.netAvailableProductionSeconds === monday.netAvailableSeconds - 300, 'Calendar mode derives scheduled and break time, then subtracts planned downtime once');
assert(calendarPlanning.scheduledProductionTimeSeconds === 28_800 && calendarPlanning.plannedBreakTimeSeconds === 1_800, 'Calendar derivation does not overwrite stored manual values');

const settings = { ...DEFAULT_PROJECT_SETTINGS, defaultAvailabilityCalendarId: calendar.id };
const assignment = new AvailabilityAssignmentResolver(store, () => settings);
const inheritedOperator = { id: 'SWO-0001', studyId: 'SW-0001', name: 'Operator 1', role: '', displayOrder: 10, active: true, linkedResourceId: null, availabilityCalendarId: null, notes: '' };
assert(assignment.forOperator(inheritedOperator).calendarId === calendar.id && assignment.forOperator(inheritedOperator).source === 'projectDefault', 'Null operator assignment inherits the project default calendar');
assert(assignment.resolve(null).source === 'projectDefault' && assignment.resolve(calendar.id).source === 'explicit', 'Explicit calendar assignment has precedence over the project default');

const resource = { id: 'RES-0001', name: 'Machine', availabilityCalendarId: null };
const operations = { getOperation: () => ({ id: 'OP-1', assignedResourceId: resource.id }) };
const resources = { getResource: () => resource };
const coverageService = new AvailabilityCoverageService(assignment, evaluator, operations, resources);
const coverage = coverageService.calculate(calendarResult, [{ id: 'SWE-1', studyId: 'SW-0001', operationId: 'OP-1', assignedOperatorId: inheritedOperator.id, order: 10, occurrences: 1, enabled: true, notes: '' }], [inheritedOperator]);
assert(coverage.available && coverage.operators[0].status === 'covered' && coverage.resources[0].status === 'covered', 'Coverage evaluates included operators and required physical resources over the planning period');

const health = validateAvailability(store, settings, [inheritedOperator], [resource], [calendarPlanning]);
assert(health.errors === 0 && health.issues.some((item) => item.code === 'overlapping-calendar-shifts'), 'Availability validation separates structural errors from calendar-overlap warnings');

const snapshot = store.getSnapshot(); const restored = new AvailabilityStore(); assert(restored.replaceAll(snapshot) && JSON.stringify(restored.getSnapshot()) === JSON.stringify(snapshot), 'Availability persistence snapshot restores exact IDs, references, breaks, patterns, and exceptions');
const lastReplacement = restored.createException(calendar.id, '2027-01-04', 'replaceShifts'); assert(lastReplacement?.replacementShiftIds.join(',') === early.id, 'Replacement exception may initially reference one shift');
assert(restored.removeShift(early.id) && restored.getCalendars().every((item) => Object.values(item.weeklyPattern).flat().every((id) => id !== early.id)) && restored.getExceptions().every((item) => !item.replacementShiftIds.includes(early.id)) && restored.getException(lastReplacement.id)?.exceptionType === 'closed', 'Shift deletion clears weekly and exception references atomically and closes an otherwise empty replacement exception');
assert(restored.replaceAll(snapshot) && restored.getShift(early.id) && restored.getBreak(firstBreak.id), 'Undo-style snapshot restoration recovers original IDs and references');

const historyStore = new AvailabilityStore(); const historySelection = new AvailabilitySelectionStore(); const historyContext = { availability: historyStore, availabilitySelection: historySelection };
const history = new CommandHistoryService(historyContext, 20); const availabilityCommands = new AvailabilityCommandFactory(history, historyContext); history.markSaved();
const historyShiftId = availabilityCommands.createShift(); assert(historyShiftId === 'SHF-0001' && history.getState().undoCount === 1 && !history.isAtSavedCheckpoint(), 'Create Shift is one dirty history entry');
const historyBreakId = availabilityCommands.createBreak(historyShiftId); assert(historyBreakId === 'SHB-0001' && history.getState().undoCount === 2, 'Add Break is one history entry with a stable ID');
assert(history.undo() && !historyStore.getBreak(historyBreakId) && history.undo() && !historyStore.getShift(historyShiftId) && history.isAtSavedCheckpoint(), 'Undo restores the saved checkpoint without residual availability entities');
assert(history.redo() && historyStore.getShift(historyShiftId) && history.redo() && historyStore.getBreak(historyBreakId), 'Redo reuses the exact SHF and SHB IDs');
const duplicateId = availabilityCommands.duplicateShift(historyShiftId); assert(duplicateId === 'SHF-0002' && historyStore.getBreaks(duplicateId).length === 1 && historyStore.getBreaks(duplicateId)[0].id === 'SHB-0002', 'Duplicate Shift remaps copied breaks to new stable IDs in one command');
assert(history.undo() && !historyStore.getShift(duplicateId) && history.redo() && historyStore.getShift(duplicateId) && historyStore.getBreak('SHB-0002'), 'Duplicate Shift undo and redo restore the exact compound graph');

console.log('Availability shifts, breaks, calendars, exceptions, date arithmetic, interval evaluation, planning, assignments, coverage, validation, and persistence checks passed.');
