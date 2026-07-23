export const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
export type Weekday = typeof WEEKDAYS[number];
export type CalendarExceptionType = 'closed' | 'replaceShifts';

export const AVAILABILITY_LIMITS = {
  shifts: 100_000,
  breaksPerShift: 1_000,
  totalBreaks: 500_000,
  calendars: 100_000,
  exceptionsPerCalendar: 1_000_000,
  totalExceptions: 2_000_000,
  shiftsPerWeekday: 1_000,
  name: 200,
  notes: 10_000,
  evaluationDays: 3_653,
} as const;

export interface ShiftDefinition {
  readonly id: string;
  name: string;
  startMinuteOfDay: number;
  endMinuteOfDay: number;
  active: boolean;
  notes: string;
}

export interface ShiftBreak {
  readonly id: string;
  readonly shiftId: string;
  name: string;
  startOffsetMinutes: number;
  durationMinutes: number;
  reducesAvailableTime: boolean;
  notes: string;
}

export type WeeklyPattern = Record<Weekday, string[]>;

export interface AvailabilityCalendar {
  readonly id: string;
  name: string;
  active: boolean;
  weeklyPattern: WeeklyPattern;
  notes: string;
}

export interface CalendarException {
  readonly id: string;
  readonly calendarId: string;
  date: string;
  exceptionType: CalendarExceptionType;
  replacementShiftIds: string[];
  note: string;
}

export type ShiftDefinitionPatch = Partial<Omit<ShiftDefinition, 'id'>>;
export type ShiftBreakPatch = Partial<Omit<ShiftBreak, 'id' | 'shiftId'>>;
export type AvailabilityCalendarPatch = Partial<Omit<AvailabilityCalendar, 'id'>>;
export type CalendarExceptionPatch = Partial<Omit<CalendarException, 'id' | 'calendarId'>>;

export function emptyWeeklyPattern(): WeeklyPattern {
  return { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [] };
}

export function cloneShift(value: ShiftDefinition): ShiftDefinition { return { ...value }; }
export function cloneShiftBreak(value: ShiftBreak): ShiftBreak { return { ...value }; }
export function cloneCalendar(value: AvailabilityCalendar): AvailabilityCalendar {
  return { ...value, weeklyPattern: Object.fromEntries(WEEKDAYS.map((day) => [day, [...value.weeklyPattern[day]]])) as WeeklyPattern };
}
export function cloneCalendarException(value: CalendarException): CalendarException {
  return { ...value, replacementShiftIds: [...value.replacementShiftIds] };
}

export function shiftDurationMinutes(shift: Pick<ShiftDefinition, 'startMinuteOfDay' | 'endMinuteOfDay'>): number {
  const difference = shift.endMinuteOfDay - shift.startMinuteOfDay;
  return difference > 0 ? difference : difference + 1_440;
}

export function shiftIsOvernight(shift: Pick<ShiftDefinition, 'startMinuteOfDay' | 'endMinuteOfDay'>): boolean {
  return shift.endMinuteOfDay <= shift.startMinuteOfDay;
}

export function reducingBreakMinutes(breaks: readonly ShiftBreak[]): number {
  return breaks.reduce((total, item) => total + (item.reducesAvailableTime ? item.durationMinutes : 0), 0);
}

export function isValidShift(value: ShiftDefinition): boolean {
  return /^SHF-\d+$/.test(value.id)
    && value.name.trim().length > 0 && value.name.length <= AVAILABILITY_LIMITS.name
    && Number.isInteger(value.startMinuteOfDay) && value.startMinuteOfDay >= 0 && value.startMinuteOfDay <= 1_439
    && Number.isInteger(value.endMinuteOfDay) && value.endMinuteOfDay >= 0 && value.endMinuteOfDay <= 1_439
    && value.startMinuteOfDay !== value.endMinuteOfDay
    && typeof value.active === 'boolean'
    && typeof value.notes === 'string' && value.notes.length <= AVAILABILITY_LIMITS.notes;
}

export function isValidShiftBreak(value: ShiftBreak, shift?: ShiftDefinition): boolean {
  return /^SHB-\d+$/.test(value.id) && /^SHF-\d+$/.test(value.shiftId)
    && value.name.trim().length > 0 && value.name.length <= AVAILABILITY_LIMITS.name
    && Number.isInteger(value.startOffsetMinutes) && value.startOffsetMinutes >= 0
    && Number.isInteger(value.durationMinutes) && value.durationMinutes > 0
    && (!shift || value.startOffsetMinutes + value.durationMinutes <= shiftDurationMinutes(shift))
    && typeof value.reducesAvailableTime === 'boolean'
    && typeof value.notes === 'string' && value.notes.length <= AVAILABILITY_LIMITS.notes;
}

export function isValidWeeklyPattern(value: unknown): value is WeeklyPattern {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== WEEKDAYS.length || Object.keys(record).some((key) => !WEEKDAYS.includes(key as Weekday))) return false;
  return WEEKDAYS.every((day) => Array.isArray(record[day])
    && record[day].length <= AVAILABILITY_LIMITS.shiftsPerWeekday
    && record[day].every((id) => typeof id === 'string' && /^SHF-\d+$/.test(id))
    && new Set(record[day] as string[]).size === record[day].length);
}

export function isValidCalendar(value: AvailabilityCalendar): boolean {
  return /^CAL-\d+$/.test(value.id)
    && value.name.trim().length > 0 && value.name.length <= AVAILABILITY_LIMITS.name
    && typeof value.active === 'boolean' && isValidWeeklyPattern(value.weeklyPattern)
    && typeof value.notes === 'string' && value.notes.length <= AVAILABILITY_LIMITS.notes;
}

export function isValidCalendarException(value: CalendarException): boolean {
  return /^CEX-\d+$/.test(value.id) && /^CAL-\d+$/.test(value.calendarId)
    && /^\d{4}-\d{2}-\d{2}$/.test(value.date)
    && (value.exceptionType === 'closed' || value.exceptionType === 'replaceShifts')
    && Array.isArray(value.replacementShiftIds)
    && value.replacementShiftIds.length <= AVAILABILITY_LIMITS.shiftsPerWeekday
    && value.replacementShiftIds.every((id) => /^SHF-\d+$/.test(id))
    && new Set(value.replacementShiftIds).size === value.replacementShiftIds.length
    && (value.exceptionType === 'closed' ? value.replacementShiftIds.length === 0 : value.replacementShiftIds.length > 0)
    && typeof value.note === 'string' && value.note.length <= AVAILABILITY_LIMITS.notes;
}
