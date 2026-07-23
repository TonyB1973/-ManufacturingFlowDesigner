import type { Weekday } from '../../models/availability/AvailabilityModels';

export interface DateOnly { readonly year: number; readonly month: number; readonly day: number; }
const WEEKDAYS: readonly Weekday[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export function isLeapYear(year: number): boolean { return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0); }
export function daysInMonth(year: number, month: number): number {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
}
export function parseDateOnly(value: string): DateOnly | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const result = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  return result.year >= 1 && result.year <= 9_999 && result.month >= 1 && result.month <= 12
    && result.day >= 1 && result.day <= daysInMonth(result.year, result.month) ? result : null;
}
export function isValidDateOnly(value: string): boolean { return parseDateOnly(value) !== null; }
export function formatDateOnly(value: DateOnly): string {
  return `${String(value.year).padStart(4, '0')}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')}`;
}

// Howard Hinnant's proleptic-Gregorian civil-date algorithm, using 1970-01-01 as day zero.
export function dateOnlyToDayNumber(value: string | DateOnly): number {
  const parsed = typeof value === 'string' ? parseDateOnly(value) : value;
  if (!parsed) throw new Error(`Invalid date-only value: ${value}`);
  let year = parsed.year;
  const month = parsed.month;
  year -= month <= 2 ? 1 : 0;
  const era = Math.floor(year / 400);
  const yearOfEra = year - era * 400;
  const shiftedMonth = month + (month > 2 ? -3 : 9);
  const dayOfYear = Math.floor((153 * shiftedMonth + 2) / 5) + parsed.day - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146_097 + dayOfEra - 719_468;
}

export function dayNumberToDateOnly(dayNumber: number): string {
  let value = dayNumber + 719_468;
  const era = Math.floor(value / 146_097);
  const dayOfEra = value - era * 146_097;
  const yearOfEra = Math.floor((dayOfEra - Math.floor(dayOfEra / 1_460) + Math.floor(dayOfEra / 36_524) - Math.floor(dayOfEra / 146_096)) / 365);
  let year = yearOfEra + era * 400;
  const dayOfYear = dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const shiftedMonth = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * shiftedMonth + 2) / 5) + 1;
  const month = shiftedMonth + (shiftedMonth < 10 ? 3 : -9);
  year += month <= 2 ? 1 : 0;
  return formatDateOnly({ year, month, day });
}

export function compareDateOnly(left: string, right: string): number { return dateOnlyToDayNumber(left) - dateOnlyToDayNumber(right); }
export function addDateOnlyDays(value: string, days: number): string { return dayNumberToDateOnly(dateOnlyToDayNumber(value) + days); }
export function inclusiveDateCount(startDate: string, endDate: string): number { return dateOnlyToDayNumber(endDate) - dateOnlyToDayNumber(startDate) + 1; }
export function weekdayForDateOnly(value: string): Weekday {
  const mondayIndex = ((dateOnlyToDayNumber(value) + 3) % 7 + 7) % 7;
  return WEEKDAYS[mondayIndex];
}
