import {
  AVAILABILITY_LIMITS, cloneCalendar, cloneCalendarException, cloneShift, cloneShiftBreak, emptyWeeklyPattern,
  isValidCalendar, isValidCalendarException, isValidShift, isValidShiftBreak, type AvailabilityCalendar,
  shiftDurationMinutes,
  type AvailabilityCalendarPatch, type CalendarException, type CalendarExceptionPatch, type ShiftBreak,
  type ShiftBreakPatch, type ShiftDefinition, type ShiftDefinitionPatch, type Weekday, type WeeklyPattern,
} from '../../models/availability/AvailabilityModels';
import {
  AvailabilityCalendarIdGenerator, CalendarExceptionIdGenerator, ShiftBreakIdGenerator, ShiftIdGenerator,
} from '../../utilities/AvailabilityIdGenerator';
import { isValidDateOnly } from './DateOnlyService';

export type AvailabilityChange = { readonly kind: 'shift' | 'break' | 'calendar' | 'exception' | 'reset'; readonly id?: string };
export interface AvailabilitySnapshot {
  readonly shifts: readonly ShiftDefinition[];
  readonly breaks: readonly ShiftBreak[];
  readonly calendars: readonly AvailabilityCalendar[];
  readonly exceptions: readonly CalendarException[];
}

export class AvailabilityStore {
  private readonly shifts = new Map<string, ShiftDefinition>();
  private readonly breaks = new Map<string, ShiftBreak>();
  private readonly calendars = new Map<string, AvailabilityCalendar>();
  private readonly exceptions = new Map<string, CalendarException>();
  private readonly breakIdsByShift = new Map<string, Set<string>>();
  private readonly exceptionIdByCalendarDate = new Map<string, string>();
  private readonly listeners = new Set<(change: AvailabilityChange) => void>();
  private revision = 0;

  public constructor(
    private readonly shiftIds = new ShiftIdGenerator(),
    private readonly breakIds = new ShiftBreakIdGenerator(),
    private readonly calendarIds = new AvailabilityCalendarIdGenerator(),
    private readonly exceptionIds = new CalendarExceptionIdGenerator(),
  ) {}

  public getRevision(): number { return this.revision; }
  public getShift(id: string): ShiftDefinition | undefined { const value = this.shifts.get(id); return value && cloneShift(value); }
  public getBreak(id: string): ShiftBreak | undefined { const value = this.breaks.get(id); return value && cloneShiftBreak(value); }
  public getCalendar(id: string): AvailabilityCalendar | undefined { const value = this.calendars.get(id); return value && cloneCalendar(value); }
  public getException(id: string): CalendarException | undefined { const value = this.exceptions.get(id); return value && cloneCalendarException(value); }
  public getShifts(): readonly ShiftDefinition[] { return [...this.shifts.values()].sort((a, b) => a.id.localeCompare(b.id)).map(cloneShift); }
  public getBreaks(shiftId?: string): readonly ShiftBreak[] {
    const values = shiftId ? [...(this.breakIdsByShift.get(shiftId) ?? [])].map((id) => this.breaks.get(id)!).filter(Boolean) : [...this.breaks.values()];
    return values.sort((a, b) => a.startOffsetMinutes - b.startOffsetMinutes || a.id.localeCompare(b.id)).map(cloneShiftBreak);
  }
  public getCalendars(): readonly AvailabilityCalendar[] { return [...this.calendars.values()].sort((a, b) => a.id.localeCompare(b.id)).map(cloneCalendar); }
  public getExceptions(calendarId?: string): readonly CalendarException[] {
    return [...this.exceptions.values()].filter((item) => !calendarId || item.calendarId === calendarId)
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)).map(cloneCalendarException);
  }
  public getExceptionForDate(calendarId: string, date: string): CalendarException | undefined {
    const id = this.exceptionIdByCalendarDate.get(`${calendarId}\0${date}`); return id ? this.getException(id) : undefined;
  }
  public getSnapshot(): AvailabilitySnapshot {
    return { shifts: this.getShifts(), breaks: this.getBreaks(), calendars: this.getCalendars(), exceptions: this.getExceptions() };
  }

  public createShift(name = `Shift ${this.shifts.size + 1}`): ShiftDefinition | null {
    if (this.shifts.size >= AVAILABILITY_LIMITS.shifts) return null;
    const value: ShiftDefinition = { id: this.shiftIds.next(), name, startMinuteOfDay: 360, endMinuteOfDay: 840, active: true, notes: '' };
    return this.restoreShift(value) ? cloneShift(value) : null;
  }
  public restoreShift(value: ShiftDefinition): boolean {
    const item = cloneShift(value);
    if (this.shifts.has(item.id) || this.shifts.size >= AVAILABILITY_LIMITS.shifts || !isValidShift(item)) return false;
    this.shifts.set(item.id, item); this.shiftIds.ensureAfter([item.id]); this.changed({ kind: 'shift', id: item.id }); return true;
  }
  public replaceShift(value: ShiftDefinition): boolean {
    const item = cloneShift(value); if (!this.shifts.has(item.id) || !isValidShift(item) || this.getBreaks(item.id).some((entry) => !isValidShiftBreak(entry, item))) return false;
    this.shifts.set(item.id, item); this.changed({ kind: 'shift', id: item.id }); return true;
  }
  public updateShift(id: string, patch: ShiftDefinitionPatch): boolean { const item = this.shifts.get(id); return Boolean(item && this.replaceShift({ ...item!, ...patch })); }
  public removeShift(id: string): boolean {
    if (!this.shifts.delete(id)) return false;
    for (const breakId of this.breakIdsByShift.get(id) ?? []) this.breaks.delete(breakId);
    this.breakIdsByShift.delete(id);
    for (const calendar of this.calendars.values()) {
      let changed = false; const weeklyPattern = cloneCalendar(calendar).weeklyPattern;
      for (const day of Object.keys(weeklyPattern) as Weekday[]) { const next = weeklyPattern[day].filter((shiftId) => shiftId !== id); changed ||= next.length !== weeklyPattern[day].length; weeklyPattern[day] = next; }
      if (changed) this.calendars.set(calendar.id, { ...calendar, weeklyPattern });
    }
    for (const exception of this.exceptions.values()) {
      const replacementShiftIds = exception.replacementShiftIds.filter((shiftId) => shiftId !== id);
      if (replacementShiftIds.length !== exception.replacementShiftIds.length) {
        this.exceptions.set(exception.id, replacementShiftIds.length
          ? { ...exception, replacementShiftIds }
          : { ...exception, exceptionType: 'closed', replacementShiftIds: [] });
      }
    }
    this.changed({ kind: 'shift', id }); return true;
  }

  public createBreak(shiftId: string): ShiftBreak | null {
    const shift = this.shifts.get(shiftId); if (!shift || this.breaks.size >= AVAILABILITY_LIMITS.totalBreaks || this.getBreaks(shiftId).length >= AVAILABILITY_LIMITS.breaksPerShift) return null;
    const existing = this.getBreaks(shiftId); const maximum = shiftDurationMinutes(shift); let offset = Math.min(120, Math.max(0, maximum - 15));
    while (offset + 15 <= maximum && existing.some((item) => offset < item.startOffsetMinutes + item.durationMinutes && item.startOffsetMinutes < offset + 15)) offset += 15;
    if (offset + 15 > maximum) { offset = 0; while (offset + 15 <= maximum && existing.some((item) => offset < item.startOffsetMinutes + item.durationMinutes && item.startOffsetMinutes < offset + 15)) offset += 15; }
    if (offset + 15 > maximum) return null;
    const value: ShiftBreak = { id: this.breakIds.next(), shiftId, name: 'Break', startOffsetMinutes: offset, durationMinutes: 15, reducesAvailableTime: true, notes: '' };
    return this.restoreBreak(value) ? cloneShiftBreak(value) : null;
  }
  public restoreBreak(value: ShiftBreak): boolean {
    const item = cloneShiftBreak(value); const shift = this.shifts.get(item.shiftId);
    if (this.breaks.has(item.id) || !shift || !isValidShiftBreak(item, shift) || this.breaksOverlap(item, item.id)) return false;
    if (this.breaks.size >= AVAILABILITY_LIMITS.totalBreaks || this.getBreaks(item.shiftId).length >= AVAILABILITY_LIMITS.breaksPerShift) return false;
    this.breaks.set(item.id, item); this.indexBreak(item); this.breakIds.ensureAfter([item.id]); this.changed({ kind: 'break', id: item.id }); return true;
  }
  public replaceBreak(value: ShiftBreak): boolean {
    const item = cloneShiftBreak(value); const shift = this.shifts.get(item.shiftId);
    if (!this.breaks.has(item.id) || !shift || !isValidShiftBreak(item, shift) || this.breaksOverlap(item, item.id)) return false;
    this.breaks.set(item.id, item); this.changed({ kind: 'break', id: item.id }); return true;
  }
  public updateBreak(id: string, patch: ShiftBreakPatch): boolean { const item = this.breaks.get(id); return Boolean(item && this.replaceBreak({ ...item!, ...patch })); }
  public removeBreak(id: string): boolean {
    const item = this.breaks.get(id); if (!item || !this.breaks.delete(id)) return false;
    this.breakIdsByShift.get(item.shiftId)?.delete(id); this.changed({ kind: 'break', id }); return true;
  }

  public createCalendar(name = `Availability Calendar ${this.calendars.size + 1}`): AvailabilityCalendar | null {
    if (this.calendars.size >= AVAILABILITY_LIMITS.calendars) return null;
    const value: AvailabilityCalendar = { id: this.calendarIds.next(), name, active: true, weeklyPattern: emptyWeeklyPattern(), notes: '' };
    return this.restoreCalendar(value) ? cloneCalendar(value) : null;
  }
  public restoreCalendar(value: AvailabilityCalendar): boolean {
    const item = cloneCalendar(value);
    if (this.calendars.has(item.id) || this.calendars.size >= AVAILABILITY_LIMITS.calendars || !isValidCalendar(item) || !this.patternReferencesExist(item.weeklyPattern)) return false;
    this.calendars.set(item.id, item); this.calendarIds.ensureAfter([item.id]); this.changed({ kind: 'calendar', id: item.id }); return true;
  }
  public replaceCalendar(value: AvailabilityCalendar): boolean {
    const item = cloneCalendar(value); if (!this.calendars.has(item.id) || !isValidCalendar(item) || !this.patternReferencesExist(item.weeklyPattern)) return false;
    this.calendars.set(item.id, item); this.changed({ kind: 'calendar', id: item.id }); return true;
  }
  public updateCalendar(id: string, patch: AvailabilityCalendarPatch): boolean { const item = this.calendars.get(id); return Boolean(item && this.replaceCalendar({ ...item!, ...patch })); }
  public setDayShifts(calendarId: string, day: Weekday, shiftIds: readonly string[]): boolean {
    const calendar = this.calendars.get(calendarId); if (!calendar) return false;
    const weeklyPattern = cloneCalendar(calendar).weeklyPattern; weeklyPattern[day] = [...shiftIds];
    return this.replaceCalendar({ ...calendar, weeklyPattern });
  }
  public removeCalendar(id: string): boolean {
    if (!this.calendars.delete(id)) return false;
    for (const item of this.getExceptions(id)) this.removeExceptionInternal(item.id);
    this.changed({ kind: 'calendar', id }); return true;
  }

  public createException(calendarId: string, date: string, exceptionType: CalendarException['exceptionType'] = 'closed'): CalendarException | null {
    if (!this.calendars.has(calendarId) || !isValidDateOnly(date) || this.getExceptionForDate(calendarId, date)
      || this.exceptions.size >= AVAILABILITY_LIMITS.totalExceptions || this.getExceptions(calendarId).length >= AVAILABILITY_LIMITS.exceptionsPerCalendar) return null;
    const value: CalendarException = { id: this.exceptionIds.next(), calendarId, date, exceptionType, replacementShiftIds: exceptionType === 'replaceShifts' ? this.getShifts().slice(0, 1).map((item) => item.id) : [], note: '' };
    return this.restoreException(value) ? cloneCalendarException(value) : null;
  }
  public restoreException(value: CalendarException): boolean {
    const item = cloneCalendarException(value); const key = `${item.calendarId}\0${item.date}`;
    if (this.exceptions.has(item.id) || this.exceptionIdByCalendarDate.has(key) || !this.calendars.has(item.calendarId)
      || !isValidDateOnly(item.date) || !isValidCalendarException(item) || !item.replacementShiftIds.every((id) => this.shifts.has(id))) return false;
    this.exceptions.set(item.id, item); this.exceptionIdByCalendarDate.set(key, item.id); this.exceptionIds.ensureAfter([item.id]); this.changed({ kind: 'exception', id: item.id }); return true;
  }
  public replaceException(value: CalendarException): boolean {
    const item = cloneCalendarException(value); const current = this.exceptions.get(item.id); if (!current) return false;
    const key = `${item.calendarId}\0${item.date}`; const occupant = this.exceptionIdByCalendarDate.get(key);
    if ((occupant && occupant !== item.id) || !this.calendars.has(item.calendarId) || !isValidDateOnly(item.date)
      || !isValidCalendarException(item) || !item.replacementShiftIds.every((id) => this.shifts.has(id))) return false;
    this.exceptionIdByCalendarDate.delete(`${current.calendarId}\0${current.date}`);
    this.exceptions.set(item.id, item); this.exceptionIdByCalendarDate.set(key, item.id); this.changed({ kind: 'exception', id: item.id }); return true;
  }
  public updateException(id: string, patch: CalendarExceptionPatch): boolean { const item = this.exceptions.get(id); return Boolean(item && this.replaceException({ ...item!, ...patch })); }
  public removeException(id: string): boolean { if (!this.removeExceptionInternal(id)) return false; this.changed({ kind: 'exception', id }); return true; }

  public replaceAll(snapshot: AvailabilitySnapshot, notify = true): boolean {
    const next = new AvailabilityStore();
    for (const item of snapshot.shifts) if (!next.restoreShift(item)) return false;
    for (const item of snapshot.breaks) if (!next.restoreBreak(item)) return false;
    for (const item of snapshot.calendars) if (!next.restoreCalendar(item)) return false;
    for (const item of snapshot.exceptions) if (!next.restoreException(item)) return false;
    this.shifts.clear(); this.breaks.clear(); this.calendars.clear(); this.exceptions.clear(); this.breakIdsByShift.clear(); this.exceptionIdByCalendarDate.clear();
    for (const item of next.shifts.values()) this.shifts.set(item.id, cloneShift(item));
    for (const item of next.breaks.values()) { this.breaks.set(item.id, cloneShiftBreak(item)); this.indexBreak(item); }
    for (const item of next.calendars.values()) this.calendars.set(item.id, cloneCalendar(item));
    for (const item of next.exceptions.values()) { this.exceptions.set(item.id, cloneCalendarException(item)); this.exceptionIdByCalendarDate.set(`${item.calendarId}\0${item.date}`, item.id); }
    this.shiftIds.ensureAfter([...this.shifts.keys()]); this.breakIds.ensureAfter([...this.breaks.keys()]); this.calendarIds.ensureAfter([...this.calendars.keys()]); this.exceptionIds.ensureAfter([...this.exceptions.keys()]);
    this.revision += 1; if (notify) this.publishReset(); return true;
  }
  public publishReset(): void { for (const listener of this.listeners) listener({ kind: 'reset' }); }
  public subscribe(listener: (change: AvailabilityChange) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }

  private patternReferencesExist(pattern: WeeklyPattern): boolean { return Object.values(pattern).every((ids) => ids.every((id) => this.shifts.has(id))); }
  private breaksOverlap(item: ShiftBreak, ignoreId: string): boolean {
    return this.getBreaks(item.shiftId).some((other) => other.id !== ignoreId && item.startOffsetMinutes < other.startOffsetMinutes + other.durationMinutes && other.startOffsetMinutes < item.startOffsetMinutes + item.durationMinutes);
  }
  private indexBreak(item: ShiftBreak): void { const values = this.breakIdsByShift.get(item.shiftId) ?? new Set<string>(); values.add(item.id); this.breakIdsByShift.set(item.shiftId, values); }
  private removeExceptionInternal(id: string): boolean {
    const item = this.exceptions.get(id); if (!item || !this.exceptions.delete(id)) return false;
    this.exceptionIdByCalendarDate.delete(`${item.calendarId}\0${item.date}`); return true;
  }
  private changed(change: AvailabilityChange): void { this.revision += 1; for (const listener of this.listeners) listener(change); }
}
