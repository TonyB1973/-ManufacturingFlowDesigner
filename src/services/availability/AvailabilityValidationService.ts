import { WEEKDAYS, shiftDurationMinutes, type AvailabilityCalendar, type CalendarException, type ShiftBreak, type ShiftDefinition } from '../../models/availability/AvailabilityModels';
import type { ProjectSettings } from '../../models/project/ProjectDocument';
import type { ResourceInstance } from '../../models/resources/ResourceInstance';
import type { StandardWorkOperator } from '../../models/standardWork/StandardWorkOperator';
import type { StandardWorkPlanningParameters } from '../../models/standardWork/StandardWorkPlanning';
import { AvailabilityCalendarEvaluationService } from './AvailabilityCalendarEvaluationService';
import type { AvailabilityStore } from './AvailabilityStore';
import { isValidDateOnly } from './DateOnlyService';

export interface AvailabilityValidationIssue {
  readonly severity: 'error' | 'warning' | 'information';
  readonly code: string;
  readonly entityId: string;
  readonly message: string;
}
export interface AvailabilityValidationSummary {
  readonly issues: readonly AvailabilityValidationIssue[];
  readonly errors: number;
  readonly warnings: number;
}

export function validateAvailability(
  store: AvailabilityStore,
  settings: ProjectSettings,
  operators: readonly StandardWorkOperator[] = [],
  resources: readonly ResourceInstance[] = [],
  planning: readonly StandardWorkPlanningParameters[] = [],
): AvailabilityValidationSummary {
  const issues: AvailabilityValidationIssue[] = []; const shifts = store.getShifts(); const calendars = store.getCalendars();
  const calendarIds = new Set(calendars.map((item) => item.id));
  const calendarById = new Map(calendars.map((item) => [item.id, item]));
  const referencedShiftIds = new Set<string>();
  for (const calendar of calendars) for (const id of Object.values(calendar.weeklyPattern).flat()) referencedShiftIds.add(id);
  for (const exception of store.getExceptions()) for (const id of exception.replacementShiftIds) referencedShiftIds.add(id);
  for (const shift of shifts) validateShift(shift, store.getBreaks(shift.id), referencedShiftIds, issues);
  for (const calendar of calendars) validateCalendar(calendar, store.getExceptions(calendar.id), store, issues);
  if (settings.defaultAvailabilityCalendarId && !calendarIds.has(settings.defaultAvailabilityCalendarId)) issues.push(issue('error', 'missing-default-calendar', settings.defaultAvailabilityCalendarId, 'Project default availability calendar is missing.'));
  else if (settings.defaultAvailabilityCalendarId && calendarById.get(settings.defaultAvailabilityCalendarId)?.active === false) issues.push(issue('warning', 'inactive-default-calendar', settings.defaultAvailabilityCalendarId, 'Project default availability calendar is inactive.'));
  for (const operator of operators) if (operator.availabilityCalendarId && !calendarIds.has(operator.availabilityCalendarId)) issues.push(issue('error', 'missing-operator-calendar', operator.id, 'Explicit operator availability calendar is missing.'));
  else if (operator.availabilityCalendarId && calendarById.get(operator.availabilityCalendarId)?.active === false) issues.push(issue('warning', 'inactive-operator-calendar', operator.id, 'Explicit operator availability calendar is inactive.'));
  for (const resource of resources) if (resource.availabilityCalendarId && !calendarIds.has(resource.availabilityCalendarId)) issues.push(issue('error', 'missing-resource-calendar', resource.id, 'Explicit resource availability calendar is missing.'));
  else if (resource.availabilityCalendarId && calendarById.get(resource.availabilityCalendarId)?.active === false) issues.push(issue('warning', 'inactive-resource-calendar', resource.id, 'Explicit resource availability calendar is inactive.'));
  const evaluation = new AvailabilityCalendarEvaluationService(store);
  for (const value of planning) if (value.availabilityMode === 'calendar') {
    if (!value.planningCalendarId || !calendarIds.has(value.planningCalendarId)) issues.push(issue('error', 'missing-planning-calendar', value.studyId, 'Calendar planning requires a valid availability calendar.'));
    else if (calendarById.get(value.planningCalendarId)?.active === false) issues.push(issue('warning', 'inactive-planning-calendar', value.studyId, 'Planning uses an inactive availability calendar.'));
    else if (!value.periodStartDate || !value.periodEndDate || !isValidDateOnly(value.periodStartDate) || !isValidDateOnly(value.periodEndDate)) issues.push(issue('error', 'invalid-planning-range', value.studyId, 'Calendar planning requires valid period dates.'));
    else { const result = evaluation.evaluate(value.planningCalendarId, value.periodStartDate, value.periodEndDate); for (const message of result.errors) issues.push(issue('error', 'invalid-planning-range', value.studyId, message)); if (result.valid && result.netAvailableSeconds <= 0) issues.push(issue('error', 'no-planning-availability', value.studyId, 'Calendar planning period produces no net available time.')); if (result.valid && value.plannedDowntimeSeconds >= result.netAvailableSeconds) issues.push(issue('error', 'invalid-planned-downtime', value.studyId, 'Planned downtime must be less than calendar net availability.')); }
  }
  return { issues, errors: issues.filter((item) => item.severity === 'error').length, warnings: issues.filter((item) => item.severity === 'warning').length };
}

function validateShift(shift: ShiftDefinition, breaks: readonly ShiftBreak[], referenced: ReadonlySet<string>, issues: AvailabilityValidationIssue[]): void {
  if (!referenced.has(shift.id)) issues.push(issue('warning', 'unreferenced-shift', shift.id, 'Shift is not referenced by any availability calendar.'));
  if (!shift.active && referenced.has(shift.id)) issues.push(issue('warning', 'inactive-shift-referenced', shift.id, 'Inactive shift is referenced by an availability calendar.'));
  const duration = shiftDurationMinutes(shift);
  for (const item of breaks) if (item.startOffsetMinutes + item.durationMinutes > duration) issues.push(issue('error', 'break-outside-shift', item.id, 'Break extends beyond the shift.'));
  const ordered = [...breaks].sort((a, b) => a.startOffsetMinutes - b.startOffsetMinutes);
  for (let index = 1; index < ordered.length; index += 1) if (ordered[index].startOffsetMinutes < ordered[index - 1].startOffsetMinutes + ordered[index - 1].durationMinutes) issues.push(issue('error', 'overlapping-breaks', ordered[index].id, 'Break overlaps another break in the shift.'));
}
function validateCalendar(calendar: AvailabilityCalendar, exceptions: readonly CalendarException[], store: AvailabilityStore, issues: AvailabilityValidationIssue[]): void {
  const assigned = WEEKDAYS.flatMap((day) => calendar.weeklyPattern[day]);
  if (!assigned.length) issues.push(issue('warning', 'empty-calendar', calendar.id, 'Calendar has no working shifts.'));
  for (const id of assigned) { const shift = store.getShift(id); if (!shift) issues.push(issue('error', 'missing-shift', calendar.id, `Calendar references missing shift ${id}.`)); else if (!shift.active) issues.push(issue('warning', 'inactive-shift', calendar.id, `Calendar references inactive shift ${id}.`)); }
  for (const day of WEEKDAYS) { const shifts = calendar.weeklyPattern[day].map((id) => store.getShift(id)).filter((item): item is ShiftDefinition => Boolean(item)); for (let left = 0; left < shifts.length; left += 1) for (let right = left + 1; right < shifts.length; right += 1) { const leftEnd = shifts[left].startMinuteOfDay + shiftDurationMinutes(shifts[left]); const rightEnd = shifts[right].startMinuteOfDay + shiftDurationMinutes(shifts[right]); if (shifts[left].startMinuteOfDay < rightEnd && shifts[right].startMinuteOfDay < leftEnd) issues.push(issue('warning', 'overlapping-calendar-shifts', calendar.id, `${title(day)} shifts ${shifts[left].id} and ${shifts[right].id} overlap; availability totals use interval union.`)); } }
  const seen = new Set<string>(); for (const item of exceptions) { if (seen.has(item.date)) issues.push(issue('error', 'duplicate-exception-date', item.id, `More than one exception exists for ${item.date}.`)); seen.add(item.date); if (!isValidDateOnly(item.date)) issues.push(issue('error', 'invalid-exception-date', item.id, 'Exception date is invalid.')); for (const id of item.replacementShiftIds) if (store.getShift(id)?.active === false) issues.push(issue('warning', 'inactive-exception-shift', item.id, `Exception references inactive shift ${id}.`)); }
}
function issue(severity: AvailabilityValidationIssue['severity'], code: string, entityId: string, message: string): AvailabilityValidationIssue { return { severity, code, entityId, message }; }
function title(value: string): string { return value.charAt(0).toUpperCase() + value.slice(1); }
