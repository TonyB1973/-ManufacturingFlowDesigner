import { WEEKDAYS, reducingBreakMinutes, shiftDurationMinutes, shiftIsOvernight } from '../../../models/availability/AvailabilityModels';
import type { ProjectSessionService } from '../../../services/project/ProjectSessionService';
import type { AvailabilitySelectionStore } from '../../../services/availability/AvailabilitySelectionStore';
import type { AvailabilityCommandFactory } from '../../../services/history/AvailabilityCommandFactory';
import type { CommandFactory } from '../../../services/history/CommandFactory';
import { AvailabilityCalendarEvaluationService } from '../../../services/availability/AvailabilityCalendarEvaluationService';
import { resolvedBreakWallClockMinutes } from '../../../services/availability/ShiftIntervalService';
import { isValidDateOnly, weekdayForDateOnly } from '../../../services/availability/DateOnlyService';
import { validateAvailability } from '../../../services/availability/AvailabilityValidationService';
import type { ResourceStore } from '../../../services/ResourceStore';
import type { StandardWorkOperatorStore } from '../../../services/standardWork/StandardWorkOperatorStore';
import { actionButton, element } from '../../../ui/dom';

export interface AvailabilityWorkspaceController { readonly element: HTMLElement; dispose(): void; }

export function createAvailabilityWorkspace(
  project: ProjectSessionService,
  selection: AvailabilitySelectionStore,
  commands: AvailabilityCommandFactory,
  projectCommands: CommandFactory,
  resources: ResourceStore,
  operators: StandardWorkOperatorStore,
  report: (message: string) => void,
): AvailabilityWorkspaceController {
  const root = element('section', 'availability-workspace'); root.hidden = true; root.tabIndex = 0; root.setAttribute('aria-label', 'Availability workspace');
  const navigator = element('aside', 'availability-navigator'); const centre = element('main', 'availability-centre'); const properties = element('aside', 'availability-properties');
  const toolbar = element('div', 'availability-toolbar'); const list = element('div', 'availability-list'); navigator.append(element('h2', undefined, 'Availability'), toolbar, list);
  const weekly = element('section', 'availability-card'); const preview = element('section', 'availability-card availability-preview'); centre.append(weekly, preview);
  root.append(navigator, centre, properties);
  const evaluation = new AvailabilityCalendarEvaluationService(project.availability);
  let previewStart = `${new Date().getFullYear()}-01-01`; let previewEnd = `${new Date().getFullYear()}-01-07`;
  let copiedDayShifts: readonly string[] | null = null;

  const run = (message: string, action: () => boolean | string | null): void => {
    const result = action(); report(result ? message.replace('{id}', String(result === true ? '' : result)).trim() : 'Availability change was rejected'); render();
  };
  const newShift = actionButton('New Shift'); newShift.title = 'Create a reusable working-period definition';
  const newCalendar = actionButton('New Calendar'); newCalendar.title = 'Create an empty weekly availability calendar';
  const duplicate = actionButton('Duplicate'); const remove = actionButton('Delete');
  newShift.addEventListener('click', () => run('Shift created: {id}', () => commands.createShift()));
  newCalendar.addEventListener('click', () => run('Calendar created: {id}', () => commands.createCalendar()));
  duplicate.addEventListener('click', () => { const item = selection.get(); if (item.kind === 'shift') run('Shift duplicated: {id}', () => commands.duplicateShift(item.id)); else if (item.kind === 'shiftBreak') run('Break duplicated: {id}', () => commands.duplicateBreak(item.id)); else if (item.kind === 'availabilityCalendar') run('Calendar duplicated: {id}', () => commands.duplicateCalendar(item.id)); });
  remove.addEventListener('click', () => deleteSelected());
  toolbar.append(newShift, newCalendar, duplicate, remove);

  const deleteSelected = (): void => {
    const item = selection.get();
    if (item.kind === 'shift') {
      const weeklyRefs = project.availability.getCalendars().reduce((count, calendar) => count + Object.values(calendar.weeklyPattern).flat().filter((id) => id === item.id).length, 0);
      const exceptionRefs = project.availability.getExceptions().reduce((count, entry) => count + entry.replacementShiftIds.filter((id) => id === item.id).length, 0);
      if (confirm(`Remove ${weeklyRefs} weekly and ${exceptionRefs} exception reference(s), then delete ${item.id} and its breaks?`)) run('Shift references removed and shift deleted', () => commands.deleteShift(item.id));
    } else if (item.kind === 'shiftBreak' && confirm(`Delete break ${item.id}?`)) run('Break deleted', () => commands.deleteBreak(item.id));
    else if (item.kind === 'availabilityCalendar') {
      const impact = project.getCalendarReferences(item.id);
      const scenarioImpact = impact.scenarios.map((entry) => `${entry.scenarioName} (${entry.scenarioId}): ${entry.total}`).join('\n');
      if (!confirm(`Delete ${item.id}, which has ${impact.total} assignment(s) across ${impact.scenarios.length} scenario(s)?${scenarioImpact ? `\n${scenarioImpact}` : ''}`)) return;
      const alternatives = project.availability.getCalendars().filter((calendar) => calendar.id !== item.id);
      let replacementId: string | null = null;
      if (impact.total && alternatives.length && confirm('Reassign references in every scenario to another calendar? Select Cancel to clear them.')) {
        const entered = prompt(`Replacement calendar ID:\n${alternatives.map((calendar) => `${calendar.id} — ${calendar.name}`).join('\n')}`, alternatives[0]?.id ?? '');
        if (entered === null) return;
        replacementId = entered.trim();
        if (!alternatives.some((calendar) => calendar.id === replacementId)) { report('Choose a valid replacement calendar ID'); return; }
      }
      run(replacementId ? `Calendar references reassigned to ${replacementId} and calendar deleted` : 'Calendar references cleared and calendar deleted', () => commands.deleteCalendar(item.id, replacementId));
    } else if (item.kind === 'calendarException' && confirm(`Delete exception ${item.id}?`)) run('Calendar exception deleted', () => commands.deleteException(item.id));
  };

  const render = (): void => {
    renderList(); renderWeekly(); renderPreview(); renderProperties();
    const selected = selection.get(); duplicate.disabled = !['shift', 'shiftBreak', 'availabilityCalendar'].includes(selected.kind); remove.disabled = selected.kind === 'none';
  };
  const select = (kind: 'shift' | 'shiftBreak' | 'availabilityCalendar' | 'calendarException', id: string): void => { selection.select({ kind, id }); render(); };

  const renderList = (): void => {
    list.replaceChildren();
    const shiftHeading = element('h3', undefined, `Shifts (${project.availability.getShifts().length})`); list.append(shiftHeading);
    for (const shift of project.availability.getShifts()) {
      const button = actionButton(`${shift.id} — ${shift.name} · ${formatTime(shift.startMinuteOfDay)}–${formatTime(shift.endMinuteOfDay)}${shiftIsOvernight(shift) ? ' · overnight' : ''} · ${formatMinutes(shiftDurationMinutes(shift) - reducingBreakMinutes(project.availability.getBreaks(shift.id)))}`, 'availability-list-item');
      button.classList.toggle('availability-list-item--selected', selection.get().kind === 'shift' && selection.get().id === shift.id); button.addEventListener('click', () => select('shift', shift.id)); list.append(button);
      for (const item of project.availability.getBreaks(shift.id)) { const entry = actionButton(`↳ ${item.id} — ${item.name} · +${item.startOffsetMinutes} min · ${item.durationMinutes} min`, 'availability-list-item availability-list-item--nested'); entry.classList.toggle('availability-list-item--selected', selection.get().kind === 'shiftBreak' && selection.get().id === item.id); entry.addEventListener('click', () => select('shiftBreak', item.id)); list.append(entry); }
    }
    list.append(element('h3', undefined, `Calendars (${project.availability.getCalendars().length})`));
    for (const calendar of project.availability.getCalendars()) {
      const marker = project.getSettings().defaultAvailabilityCalendarId === calendar.id ? ' · default' : ''; const button = actionButton(`${calendar.id} — ${calendar.name}${marker}`, 'availability-list-item'); button.classList.toggle('availability-list-item--selected', selection.get().kind === 'availabilityCalendar' && selection.get().id === calendar.id); button.addEventListener('click', () => select('availabilityCalendar', calendar.id)); list.append(button);
      for (const item of project.availability.getExceptions(calendar.id)) { const entry = actionButton(`↳ ${item.id} — ${item.date} · ${item.exceptionType === 'closed' ? 'Closed' : 'Replacement'}`, 'availability-list-item availability-list-item--nested'); entry.classList.toggle('availability-list-item--selected', selection.get().kind === 'calendarException' && selection.get().id === item.id); entry.addEventListener('click', () => select('calendarException', item.id)); list.append(entry); }
    }
  };

  const selectedCalendarId = (): string | null => {
    const item = selection.get(); if (item.kind === 'availabilityCalendar') return item.id; if (item.kind === 'calendarException') return project.availability.getException(item.id)?.calendarId ?? null; return project.availability.getCalendars()[0]?.id ?? null;
  };
  const renderWeekly = (): void => {
    weekly.replaceChildren(element('h2', undefined, 'Weekly Calendar Editor'));
    const calendarId = selectedCalendarId(); const calendar = calendarId ? project.availability.getCalendar(calendarId) : undefined;
    if (!calendar) { weekly.append(element('p', 'availability-empty', 'Create or select an availability calendar to edit its weekly pattern.')); return; }
    weekly.append(element('p', 'availability-help', `${calendar.name} (${calendar.id}) — choose the shifts that apply on each assigned date. Overlap is allowed and unioned without double-counting.`));
    const table = element('table', 'availability-week-table'); const head = element('tr'); head.append(element('th', undefined, 'Day'), ...project.availability.getShifts().map((shift) => element('th', undefined, `${shift.name}\n${formatTime(shift.startMinuteOfDay)}–${formatTime(shift.endMinuteOfDay)}${shiftIsOvernight(shift) ? ' overnight' : ''}\n${formatMinutes(shiftDurationMinutes(shift) - reducingBreakMinutes(project.availability.getBreaks(shift.id)))} net${shift.active ? '' : ' · inactive'}`)), element('th', undefined, 'Day actions')); const thead = element('thead'); thead.append(head); table.append(thead); const body = element('tbody');
    for (const day of WEEKDAYS) {
      const row = element('tr'); row.append(element('th', undefined, title(day)));
      for (const shift of project.availability.getShifts()) { const cell = element('td'); const input = element('input'); input.type = 'checkbox'; input.checked = calendar.weeklyPattern[day].includes(shift.id); input.setAttribute('aria-label', `${title(day)} uses ${shift.name}`); input.addEventListener('change', () => { const values = input.checked ? [...calendar.weeklyPattern[day], shift.id] : calendar.weeklyPattern[day].filter((id) => id !== shift.id); run(`${title(day)} updated`, () => commands.setDayShifts(calendar.id, day, values)); }); cell.append(input); row.append(cell); }
      const dayActions = element('td', 'availability-day-actions');
      const copyDay = actionButton('Copy'); copyDay.title = `Copy ${title(day)} shift assignments`; copyDay.addEventListener('click', () => { copiedDayShifts = [...calendar.weeklyPattern[day]]; report(`${title(day)} shift assignments copied`); renderWeekly(); });
      const pasteDay = actionButton('Paste'); pasteDay.title = `Paste copied shift assignments to ${title(day)}`; pasteDay.disabled = copiedDayShifts === null; pasteDay.addEventListener('click', () => { if (copiedDayShifts) run(`Copied shifts pasted to ${title(day)}`, () => commands.setDayShifts(calendar.id, day, copiedDayShifts ?? [])); });
      const clearDay = actionButton('Clear'); clearDay.title = `Clear ${title(day)} shift assignments`; clearDay.disabled = calendar.weeklyPattern[day].length === 0; clearDay.addEventListener('click', () => run(`${title(day)} cleared`, () => commands.setDayShifts(calendar.id, day, [])));
      dayActions.append(copyDay, pasteDay, clearDay); row.append(dayActions);
      body.append(row);
    }
    table.append(body); weekly.append(table);
    const actions = element('div', 'availability-actions'); const copy = actionButton('Copy Monday to Weekdays'); copy.disabled = !calendar.weeklyPattern.monday.length; copy.addEventListener('click', () => run('Monday copied to weekdays', () => commands.copyMondayToWeekdays(calendar.id))); const addException = actionButton('Add Exception'); addException.addEventListener('click', () => { const date = prompt('Exception date (YYYY-MM-DD)', previewStart); if (date && isValidDateOnly(date)) run(`Calendar exception created for ${date}: {id}`, () => commands.createException(calendar.id, date)); else if (date) report('Enter a valid Gregorian date in YYYY-MM-DD format'); }); actions.append(copy, addException); weekly.append(actions);
  };

  const renderPreview = (): void => {
    preview.replaceChildren(element('h2', undefined, 'Date-range Availability Preview'));
    const controls = element('div', 'availability-preview-controls'); const start = dateInput('Preview start date', previewStart, (value) => { previewStart = value; renderPreview(); }); const end = dateInput('Preview end date', previewEnd, (value) => { previewEnd = value; renderPreview(); }); controls.append(start, end); preview.append(controls);
    const calendarId = selectedCalendarId(); if (!calendarId) { preview.append(element('p', 'availability-empty', 'Select a calendar to calculate availability.')); return; }
    const result = evaluation.evaluate(calendarId, previewStart, previewEnd);
    if (!result.valid) { preview.append(element('p', 'availability-error', result.errors.join(' '))); return; }
    const metrics = element('div', 'availability-metrics'); metric(metrics, 'Calendar days', String(result.calendarDayCount)); metric(metrics, 'Available days', String(result.datesWithAvailability)); metric(metrics, 'Gross scheduled', formatSeconds(result.grossScheduledSeconds)); metric(metrics, 'Planned breaks', formatSeconds(result.plannedBreakSeconds)); metric(metrics, 'Net availability', formatSeconds(result.netAvailableSeconds)); metric(metrics, 'Exceptions', String(result.exceptionCount)); preview.append(metrics);
    if (result.overlapDiagnostics.length) preview.append(element('p', 'availability-warning', `${result.overlapDiagnostics.length} overlapping shift pair(s) detected; totals use interval union.`));
    const days = element('div', 'availability-day-preview'); for (const day of result.dailySummaries) days.append(element('div', `availability-day${day.closed ? ' availability-day--closed' : ''}`, `${day.date} · ${day.closed ? 'Closed' : day.shiftIds.length ? `${day.shiftIds.join(', ')} · ${formatSeconds(day.netAvailableSeconds)} net` : 'No shifts'}`)); preview.append(days);
  };

  const renderProperties = (): void => {
    properties.replaceChildren(element('h2', undefined, 'Properties')); const selected = selection.get();
    if (selected.kind === 'none') { properties.append(element('p', 'availability-empty', 'Select a shift, break, calendar or exception.')); appendValidation(); return; }
    if (selected.kind === 'shift') {
      const shift = project.availability.getShift(selected.id); if (!shift) return;
      properties.append(readonlyField('Shift ID', shift.id), textField('Name', shift.name, (value) => commands.updateShift(shift.id, { name: value }, `Rename shift ${shift.id}`)), timeField('Start time', shift.startMinuteOfDay, (value) => commands.updateShift(shift.id, { startMinuteOfDay: value }, `Change start time for ${shift.id}`)), timeField('End time', shift.endMinuteOfDay, (value) => commands.updateShift(shift.id, { endMinuteOfDay: value }, `Change end time for ${shift.id}`)), readonlyField('Overnight', shiftIsOvernight(shift) ? 'Yes' : 'No'), readonlyField('Gross duration', formatMinutes(shiftDurationMinutes(shift))), readonlyField('Planned reducing breaks', formatMinutes(reducingBreakMinutes(project.availability.getBreaks(shift.id)))), readonlyField('Net availability', formatMinutes(shiftDurationMinutes(shift) - reducingBreakMinutes(project.availability.getBreaks(shift.id)))), checkboxField('Active', shift.active, (value) => commands.updateShift(shift.id, { active: value }, `${value ? 'Activate' : 'Deactivate'} shift ${shift.id}`)), textField('Notes', shift.notes, (value) => commands.updateShift(shift.id, { notes: value }, `Edit notes for ${shift.id}`), true));
      const add = actionButton('Add Break'); add.addEventListener('click', () => run('Break added: {id}', () => commands.createBreak(shift.id))); properties.append(add);
    } else if (selected.kind === 'shiftBreak') {
      const item = project.availability.getBreak(selected.id); const shift = item && project.availability.getShift(item.shiftId); if (!item || !shift) return; const resolved = resolvedBreakWallClockMinutes(shift, item);
      properties.append(readonlyField('Break ID', item.id), readonlyField('Shift ID', item.shiftId), textField('Name', item.name, (value) => commands.updateBreak(item.id, { name: value })), numberField('Start offset (minutes)', item.startOffsetMinutes, 0, (value) => commands.updateBreak(item.id, { startOffsetMinutes: value })), readonlyField('Resolved start', `${resolved.startDayOffset ? `+${resolved.startDayOffset} day ` : ''}${formatTime(resolved.startMinute)}`), numberField('Duration (minutes)', item.durationMinutes, 1, (value) => commands.updateBreak(item.id, { durationMinutes: value })), readonlyField('Resolved end', `${resolved.endDayOffset ? `+${resolved.endDayOffset} day ` : ''}${formatTime(resolved.endMinute)}`), checkboxField('Reduces available time', item.reducesAvailableTime, (value) => commands.updateBreak(item.id, { reducesAvailableTime: value })), textField('Notes', item.notes, (value) => commands.updateBreak(item.id, { notes: value }), true));
    } else if (selected.kind === 'availabilityCalendar') {
      const calendar = project.availability.getCalendar(selected.id); if (!calendar) return; const defaultCalendar = project.getSettings().defaultAvailabilityCalendarId === calendar.id;
      properties.append(readonlyField('Calendar ID', calendar.id), textField('Name', calendar.name, (value) => commands.updateCalendar(calendar.id, { name: value }, `Rename calendar ${calendar.id}`)), checkboxField('Active', calendar.active, (value) => commands.updateCalendar(calendar.id, { active: value })), readonlyField('Project default', defaultCalendar ? 'Yes' : 'No'), readonlyField('Assigned operators', String(operators.getOperators().filter((item) => item.availabilityCalendarId === calendar.id).length)), readonlyField('Assigned resources', String(resources.getPlacedResources().filter((item) => item.availabilityCalendarId === calendar.id).length)), readonlyField('Planning studies', String(project.standardWorkPlanning.getAll().filter((item) => item.planningCalendarId === calendar.id).length)), readonlyField('Exceptions', String(project.availability.getExceptions(calendar.id).length)), textField('Notes', calendar.notes, (value) => commands.updateCalendar(calendar.id, { notes: value }), true));
      const setDefault = actionButton('Set as Project Default'); setDefault.disabled = defaultCalendar; setDefault.addEventListener('click', () => run(`${calendar.id} set as project default`, () => projectCommands.updateProjectSettings({ defaultAvailabilityCalendarId: calendar.id }))); properties.append(setDefault);
    } else {
      const item = project.availability.getException(selected.id); if (!item) return;
      properties.append(readonlyField('Exception ID', item.id), readonlyField('Calendar ID', item.calendarId), dateField('Date', item.date, (value) => commands.updateException(item.id, { date: value })), readonlyField('Weekday', isValidDateOnly(item.date) ? title(weekdayForDateOnly(item.date)) : 'Invalid'), selectField('Exception type', item.exceptionType, [['closed', 'Closed'], ['replaceShifts', 'Replace shifts']], (value) => commands.updateException(item.id, { exceptionType: value as 'closed' | 'replaceShifts', replacementShiftIds: value === 'closed' ? [] : item.replacementShiftIds.length ? item.replacementShiftIds : project.availability.getShifts().slice(0, 1).map((shift) => shift.id) })), textField('Note', item.note, (value) => commands.updateException(item.id, { note: value }), true));
      if (item.exceptionType === 'replaceShifts') for (const shift of project.availability.getShifts()) properties.append(checkboxField(`Use ${shift.name}`, item.replacementShiftIds.includes(shift.id), (checked) => commands.updateException(item.id, { replacementShiftIds: checked ? [...item.replacementShiftIds, shift.id] : item.replacementShiftIds.filter((id) => id !== shift.id) })));
    }
    appendValidation();
  };
  const appendValidation = (): void => {
    const summary = validateAvailability(project.availability, project.getSettings(), operators.getOperators(), resources.getPlacedResources(), project.standardWorkPlanning.getAll()); properties.append(element('h3', undefined, `Validation — ${summary.errors} errors, ${summary.warnings} warnings`)); const selected = selection.get(); for (const item of summary.issues.filter((entry) => selected.kind === 'none' || entry.entityId === selected.id).slice(0, 12)) properties.append(element('p', `availability-${item.severity}`, `${item.severity.toUpperCase()}: ${item.message}`)); if (!summary.issues.length) properties.append(element('p', 'availability-ok', 'Availability definitions are structurally valid.'));
  };

  const handleKey = (event: KeyboardEvent): void => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement || (event.target as HTMLElement)?.isContentEditable) return;
    if (event.key === 'Escape') { selection.clear(); render(); } else if (event.key === 'Delete') deleteSelected(); else if (event.key === 'Insert') { const item = selection.get(); if (item.kind === 'shift') run('Break added: {id}', () => commands.createBreak(item.id)); else if (item.kind === 'availabilityCalendar') { const date = prompt('Exception date (YYYY-MM-DD)', previewStart); if (date) run(`Calendar exception created for ${date}: {id}`, () => commands.createException(item.id, date)); } else run('Shift created: {id}', () => commands.createShift()); }
    else if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'c') { event.preventDefault(); run('Calendar created: {id}', () => commands.createCalendar()); }
  };
  root.addEventListener('keydown', handleKey);
  const unsubscribers = [project.availability.subscribe(render), selection.subscribe(render), project.subscribe(render), resources.subscribe(render), operators.subscribe(render), project.standardWorkPlanning.subscribe(render)];
  render();
  return { element: root, dispose: () => { root.removeEventListener('keydown', handleKey); unsubscribers.forEach((unsubscribe) => unsubscribe()); } };
}

function title(value: string): string { return value.charAt(0).toUpperCase() + value.slice(1); }
function formatTime(minutes: number): string { return `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`; }
function parseTime(value: string): number | null { const match = /^(\d{2}):(\d{2})$/.exec(value); if (!match) return null; const result = Number(match[1]) * 60 + Number(match[2]); return Number(match[1]) <= 23 && Number(match[2]) <= 59 ? result : null; }
function formatMinutes(minutes: number): string { return `${Math.floor(minutes / 60)}h ${minutes % 60}m`; }
function formatSeconds(seconds: number): string { return formatMinutes(Math.round(seconds / 60)); }
function metric(parent: HTMLElement, label: string, value: string): void { const node = element('div', 'availability-metric'); node.append(element('small', undefined, label), element('strong', undefined, value)); parent.append(node); }
function wrapper(label: string): { readonly label: HTMLLabelElement; readonly title: HTMLSpanElement } { const node = element('label', 'availability-field'); const titleNode = element('span', undefined, label); node.append(titleNode); return { label: node, title: titleNode }; }
function readonlyField(label: string, value: string): HTMLElement { const field = wrapper(label); const output = element('output', undefined, value); field.label.append(output); return field.label; }
function textField(label: string, value: string, change: (value: string) => boolean, multiline = false): HTMLElement { const field = wrapper(label); const input = multiline ? element('textarea') : element('input'); input.value = value; input.addEventListener('change', () => { if (!change(input.value)) input.value = value; }); field.label.append(input); return field.label; }
function numberField(label: string, value: number, minimum: number, change: (value: number) => boolean): HTMLElement { const field = wrapper(label); const input = element('input'); input.type = 'number'; input.min = String(minimum); input.step = '1'; input.value = String(value); input.addEventListener('change', () => { const next = Number(input.value); if (!Number.isInteger(next) || next < minimum || !change(next)) input.value = String(value); }); field.label.append(input); return field.label; }
function timeField(label: string, value: number, change: (value: number) => boolean): HTMLElement { const field = wrapper(label); const input = element('input'); input.type = 'time'; input.value = formatTime(value); input.addEventListener('change', () => { const next = parseTime(input.value); if (next === null || !change(next)) input.value = formatTime(value); }); field.label.append(input); return field.label; }
function dateField(label: string, value: string, change: (value: string) => boolean): HTMLElement { const field = wrapper(label); const input = element('input'); input.type = 'date'; input.value = value; input.addEventListener('change', () => { if (!isValidDateOnly(input.value) || !change(input.value)) input.value = value; }); field.label.append(input); return field.label; }
function dateInput(label: string, value: string, change: (value: string) => void): HTMLElement { const field = wrapper(label); const input = element('input'); input.type = 'date'; input.value = value; input.addEventListener('change', () => { if (isValidDateOnly(input.value)) change(input.value); }); field.label.append(input); return field.label; }
function checkboxField(label: string, value: boolean, change: (value: boolean) => boolean): HTMLElement { const field = wrapper(label); field.label.classList.add('availability-field--checkbox'); const input = element('input'); input.type = 'checkbox'; input.checked = value; input.addEventListener('change', () => { if (!change(input.checked)) input.checked = value; }); field.label.append(input); return field.label; }
function selectField(label: string, value: string, options: readonly (readonly [string, string])[], change: (value: string) => boolean): HTMLElement { const field = wrapper(label); const select = element('select'); for (const [id, text] of options) { const option = element('option', undefined, text); option.value = id; select.append(option); } select.value = value; select.addEventListener('change', () => { if (!change(select.value)) select.value = value; }); field.label.append(select); return field.label; }
