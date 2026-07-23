import {
  cloneCalendar, cloneCalendarException, type AvailabilityCalendarPatch,
  type CalendarExceptionPatch, type ShiftBreakPatch, type ShiftDefinitionPatch, type Weekday,
} from '../../models/availability/AvailabilityModels';
import { cloneStandardWorkOperator } from '../../models/standardWork/StandardWorkOperator';
import type { AvailabilitySnapshot } from '../availability/AvailabilityStore';
import type { CommandExecutionContext } from './ApplicationCommand';
import { ReversibleCommand } from './ApplicationCommand';
import type { CommandHistoryService } from './CommandHistoryService';

export class AvailabilityCommandFactory {
  public constructor(private readonly history: CommandHistoryService, private readonly context: CommandExecutionContext) {}

  public createShift(): string | null {
    let id: string | null = null;
    return this.snapshotCommand('Create shift', () => { const value = this.context.availability.createShift(); if (!value) return false; id = value.id; this.context.availabilitySelection.select({ kind: 'shift', id }); return true; }) ? id : null;
  }
  public duplicateShift(id: string): string | null {
    const source = this.context.availability.getShift(id); if (!source) return null; let createdId: string | null = null;
    return this.snapshotCommand(`Duplicate shift ${id}`, () => {
      const created = this.context.availability.createShift(`${source.name} Copy`); if (!created) return false; createdId = created.id;
      if (!this.context.availability.replaceShift({ ...source, id: created.id, name: `${source.name} Copy` })) return false;
      for (const item of this.context.availability.getBreaks(id)) { const next = this.context.availability.createBreak(created.id); if (!next || !this.context.availability.replaceBreak({ ...item, id: next.id, shiftId: created.id })) return false; }
      this.context.availabilitySelection.select({ kind: 'shift', id: created.id }); return true;
    }) ? createdId : null;
  }
  public updateShift(id: string, patch: ShiftDefinitionPatch, description = `Update shift ${id}`): boolean {
    return this.snapshotCommand(description, () => this.context.availability.updateShift(id, patch), [id]);
  }
  public deleteShift(id: string): boolean {
    return this.snapshotCommand(`Remove references and delete shift ${id}`, () => {
      const result = this.context.availability.removeShift(id); if (result) this.context.availabilitySelection.clear(); return result;
    }, [id]);
  }
  public createBreak(shiftId: string): string | null {
    let id: string | null = null;
    return this.snapshotCommand(`Add break to ${shiftId}`, () => { const value = this.context.availability.createBreak(shiftId); if (!value) return false; id = value.id; this.context.availabilitySelection.select({ kind: 'shiftBreak', id }); return true; }, [shiftId]) ? id : null;
  }
  public duplicateBreak(id: string): string | null {
    const source = this.context.availability.getBreak(id); if (!source) return null; let createdId: string | null = null;
    return this.snapshotCommand(`Duplicate break ${id}`, () => {
      const existing = this.context.availability.getBreaks(source.shiftId); const shift = this.context.availability.getShift(source.shiftId); if (!shift) return false;
      let offset = source.startOffsetMinutes + source.durationMinutes;
      while (existing.some((item) => offset < item.startOffsetMinutes + item.durationMinutes && item.startOffsetMinutes < offset + source.durationMinutes)) offset += source.durationMinutes;
      const created = this.context.availability.createBreak(source.shiftId); if (!created) return false; createdId = created.id;
      if (!this.context.availability.replaceBreak({ ...source, id: created.id, name: `${source.name} Copy`, startOffsetMinutes: offset })) return false;
      this.context.availabilitySelection.select({ kind: 'shiftBreak', id: created.id }); return true;
    }, [id, source.shiftId]) ? createdId : null;
  }
  public updateBreak(id: string, patch: ShiftBreakPatch, description = `Update break ${id}`): boolean {
    return this.snapshotCommand(description, () => this.context.availability.updateBreak(id, patch), [id]);
  }
  public deleteBreak(id: string): boolean {
    return this.snapshotCommand(`Delete break ${id}`, () => { const result = this.context.availability.removeBreak(id); if (result) this.context.availabilitySelection.clear(); return result; }, [id]);
  }

  public createCalendar(): string | null {
    let id: string | null = null;
    return this.snapshotCommand('Create availability calendar', () => { const value = this.context.availability.createCalendar(); if (!value) return false; id = value.id; this.context.availabilitySelection.select({ kind: 'availabilityCalendar', id }); return true; }) ? id : null;
  }
  public duplicateCalendar(id: string): string | null {
    const source = this.context.availability.getCalendar(id); if (!source) return null; let createdId: string | null = null;
    return this.snapshotCommand(`Duplicate calendar ${id}`, () => {
      const created = this.context.availability.createCalendar(`${source.name} Copy`); if (!created) return false; createdId = created.id;
      if (!this.context.availability.replaceCalendar({ ...cloneCalendar(source), id: created.id, name: `${source.name} Copy` })) return false;
      for (const item of this.context.availability.getExceptions(id)) {
        const next = this.context.availability.createException(created.id, item.date, item.exceptionType); if (!next || !this.context.availability.replaceException({ ...cloneCalendarException(item), id: next.id, calendarId: created.id })) return false;
      }
      this.context.availabilitySelection.select({ kind: 'availabilityCalendar', id: created.id }); return true;
    }, [id]) ? createdId : null;
  }
  public updateCalendar(id: string, patch: AvailabilityCalendarPatch, description = `Update calendar ${id}`): boolean {
    return this.snapshotCommand(description, () => this.context.availability.updateCalendar(id, patch), [id]);
  }
  public setDayShifts(calendarId: string, day: Weekday, shiftIds: readonly string[]): boolean {
    return this.snapshotCommand(`Update ${day} in ${calendarId}`, () => this.context.availability.setDayShifts(calendarId, day, shiftIds), [calendarId, ...shiftIds]);
  }
  public copyMondayToWeekdays(calendarId: string): boolean {
    const calendar = this.context.availability.getCalendar(calendarId); if (!calendar) return false;
    return this.snapshotCommand(`Copy Monday to weekdays in ${calendarId}`, () => {
      for (const day of ['tuesday', 'wednesday', 'thursday', 'friday'] as const) if (!this.context.availability.setDayShifts(calendarId, day, calendar.weeklyPattern.monday)) return false;
      return true;
    }, [calendarId, ...calendar.weeklyPattern.monday]);
  }
  public deleteCalendar(id: string, replacementId: string | null = null): boolean {
    const calendar = this.context.availability.getCalendar(id); if (!calendar || replacementId === id || (replacementId && !this.context.availability.getCalendar(replacementId))) return false;
    const beforeSettings = this.context.project.getSettings();
    const resources = this.context.resources.getPlacedResources().filter((item) => item.availabilityCalendarId === id).map((item) => ({ id: item.id, before: id as string | null }));
    const operators = this.context.standardWorkOperators.getOperators().filter((item) => item.availabilityCalendarId === id).map(cloneStandardWorkOperator);
    const planning = this.context.standardWorkPlanning.getAll().filter((item) => item.planningCalendarId === id).map((item) => ({ ...item }));
    const availabilityBefore = this.context.availability.getSnapshot(); let availabilityAfter: AvailabilitySnapshot | null = null;
    const command = new ReversibleCommand(`Delete calendar ${id}${replacementId ? ` and reassign to ${replacementId}` : ' and clear references'}`, [id, ...(replacementId ? [replacementId] : [])], 'availability',
      (context) => {
        if (availabilityAfter) context.availability.replaceAll(availabilityAfter);
        else { if (!context.availability.removeCalendar(id)) throw new Error('Calendar deletion failed.'); availabilityAfter = context.availability.getSnapshot(); }
        if (beforeSettings.defaultAvailabilityCalendarId === id && !context.project.applySettings({ defaultAvailabilityCalendarId: replacementId })) throw new Error('Default calendar update failed.');
        for (const item of resources) if (!context.resources.updateResource(item.id, { availabilityCalendarId: replacementId })) throw new Error('Resource calendar reassignment failed.');
        for (const item of operators) if (!context.standardWorkOperators.updateOperator(item.id, { availabilityCalendarId: replacementId })) throw new Error('Operator calendar reassignment failed.');
        for (const item of planning) if (!context.standardWorkPlanning.update(item.studyId, { planningCalendarId: replacementId })) throw new Error('Planning calendar reassignment failed.');
        context.availabilitySelection.clear();
      },
      (context) => {
        context.availability.replaceAll(availabilityBefore);
        context.project.applySettings({ defaultAvailabilityCalendarId: beforeSettings.defaultAvailabilityCalendarId });
        for (const item of resources) context.resources.updateResource(item.id, { availabilityCalendarId: item.before });
        for (const item of operators) context.standardWorkOperators.updateOperator(item.id, { availabilityCalendarId: item.availabilityCalendarId });
        for (const item of planning) context.standardWorkPlanning.replace(item);
        context.availabilitySelection.select({ kind: 'availabilityCalendar', id });
      });
    return this.run(command);
  }

  public createException(calendarId: string, date: string): string | null {
    let id: string | null = null;
    return this.snapshotCommand(`Create exception for ${date}`, () => { const value = this.context.availability.createException(calendarId, date); if (!value) return false; id = value.id; this.context.availabilitySelection.select({ kind: 'calendarException', id }); return true; }, [calendarId]) ? id : null;
  }
  public updateException(id: string, patch: CalendarExceptionPatch, description = `Update exception ${id}`): boolean {
    return this.snapshotCommand(description, () => this.context.availability.updateException(id, patch), [id]);
  }
  public deleteException(id: string): boolean {
    return this.snapshotCommand(`Delete exception ${id}`, () => { const result = this.context.availability.removeException(id); if (result) this.context.availabilitySelection.clear(); return result; }, [id]);
  }

  private snapshotCommand(description: string, apply: () => boolean, ids: readonly string[] = []): boolean {
    const before = this.context.availability.getSnapshot(); let after: AvailabilitySnapshot | null = null;
    const selectionBefore = this.context.availabilitySelection.get();
    return this.run(new ReversibleCommand(description, ids, 'availability',
      (context) => {
        if (after) { if (!context.availability.replaceAll(after)) throw new Error(`${description} could not be redone.`); }
        else { if (!apply()) { context.availability.replaceAll(before); throw new Error(`${description} was rejected.`); } after = context.availability.getSnapshot(); }
      },
      (context) => {
        if (!context.availability.replaceAll(before)) throw new Error(`${description} could not be undone.`);
        if (selectionBefore.kind === 'none') context.availabilitySelection.clear(); else context.availabilitySelection.select(selectionBefore);
      }));
  }
  private run(command: ReversibleCommand): boolean { try { return this.history.execute(command); } catch { return false; } }
}
