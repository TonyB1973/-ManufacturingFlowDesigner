import { AVAILABILITY_LIMITS, type CalendarException } from '../../models/availability/AvailabilityModels';
import type { AvailabilityStore } from './AvailabilityStore';
import { dateOnlyToDayNumber, dayNumberToDateOnly, inclusiveDateCount, isValidDateOnly, weekdayForDateOnly } from './DateOnlyService';
import { intersectIntervals, intervalDuration, mergeIntervals, subtractIntervals, type MinuteInterval } from './IntervalService';
import { resolveShiftIntervals } from './ShiftIntervalService';

export interface ResolvedShiftInstance {
  readonly assignedDate: string;
  readonly shiftId: string;
  readonly shiftName: string;
  readonly active: boolean;
  readonly scheduledInterval: MinuteInterval;
  readonly reducingBreakIntervals: readonly MinuteInterval[];
}
export interface AvailabilityDailySummary {
  readonly date: string;
  readonly shiftIds: readonly string[];
  readonly grossScheduledSeconds: number;
  readonly plannedBreakSeconds: number;
  readonly netAvailableSeconds: number;
  readonly exceptionId: string | null;
  readonly closed: boolean;
}
export interface AvailabilityOverlapDiagnostic { readonly date: string; readonly shiftIds: readonly string[]; }
export interface AvailabilityEvaluationResult {
  readonly valid: boolean;
  readonly calendarId: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly calendarDayCount: number;
  readonly resolvedShiftInstances: readonly ResolvedShiftInstance[];
  readonly grossScheduledIntervals: readonly MinuteInterval[];
  readonly reducingBreakIntervals: readonly MinuteInterval[];
  readonly netAvailableIntervals: readonly MinuteInterval[];
  readonly grossScheduledSeconds: number;
  readonly plannedBreakSeconds: number;
  readonly netAvailableSeconds: number;
  readonly datesWithAvailability: number;
  readonly closedDates: readonly string[];
  readonly exceptionCount: number;
  readonly overlapDiagnostics: readonly AvailabilityOverlapDiagnostic[];
  readonly longestContinuousNetAvailabilitySeconds: number;
  readonly dailySummaries: readonly AvailabilityDailySummary[];
  readonly errors: readonly string[];
}

export class AvailabilityCalendarEvaluationService {
  private readonly cache = new Map<string, AvailabilityEvaluationResult>();
  public constructor(private readonly store: AvailabilityStore) {}

  public evaluate(calendarId: string, startDate: string, endDate: string): AvailabilityEvaluationResult {
    const key = `${this.store.getRevision()}\0${calendarId}\0${startDate}\0${endDate}`;
    const cached = this.cache.get(key); if (cached) return cached;
    const errors: string[] = [];
    const calendar = this.store.getCalendar(calendarId);
    if (!calendar) errors.push(`Availability calendar ${calendarId} does not exist.`);
    if (!isValidDateOnly(startDate)) errors.push('Period start date is invalid.');
    if (!isValidDateOnly(endDate)) errors.push('Period end date is invalid.');
    let count = 0;
    if (!errors.length) {
      count = inclusiveDateCount(startDate, endDate);
      if (count <= 0) errors.push('Period start date must not be after period end date.');
      if (count > AVAILABILITY_LIMITS.evaluationDays) errors.push(`Date range exceeds the ${AVAILABILITY_LIMITS.evaluationDays}-day safety limit.`);
    }
    if (errors.length || !calendar) return this.invalid(calendarId, startDate, endDate, count, errors);

    const instances: ResolvedShiftInstance[] = [];
    const dailySummaries: AvailabilityDailySummary[] = [];
    const closedDates: string[] = [];
    const overlaps: AvailabilityOverlapDiagnostic[] = [];
    let exceptionCount = 0;
    for (let dayOffset = 0; dayOffset < count; dayOffset += 1) {
      const date = dayNumberToDateOnly(dateOnlyToDayNumber(startDate) + dayOffset);
      const exception = this.store.getExceptionForDate(calendarId, date);
      if (exception) exceptionCount += 1;
      const shiftIds = this.shiftIdsForDate(calendar.weeklyPattern[weekdayForDateOnly(date)], exception);
      if (exception?.exceptionType === 'closed') closedDates.push(date);
      const dayInstances = shiftIds.flatMap((shiftId) => {
        const shift = this.store.getShift(shiftId);
        if (!shift) return [];
        const resolved = resolveShiftIntervals(shift, this.store.getBreaks(shift.id), dateOnlyToDayNumber(date));
        return [{ assignedDate: date, shiftId: shift.id, shiftName: shift.name, active: shift.active, scheduledInterval: resolved.scheduled, reducingBreakIntervals: resolved.reducingBreaks }];
      });
      this.detectOverlaps(date, dayInstances, overlaps);
      instances.push(...dayInstances);
      const dayScheduled = mergeIntervals(dayInstances.map((item) => item.scheduledInterval));
      const dayBreaks = intersectIntervals(dayScheduled, mergeIntervals(dayInstances.flatMap((item) => item.reducingBreakIntervals)));
      const dayNet = subtractIntervals(dayScheduled, dayBreaks);
      dailySummaries.push({
        date, shiftIds, grossScheduledSeconds: intervalDuration(dayScheduled) * 60,
        plannedBreakSeconds: intervalDuration(dayBreaks) * 60, netAvailableSeconds: intervalDuration(dayNet) * 60,
        exceptionId: exception?.id ?? null, closed: exception?.exceptionType === 'closed',
      });
    }

    // Intervals are unioned over the complete range, so overlapping overnight portions are never counted twice.
    const scheduled = mergeIntervals(instances.map((item) => item.scheduledInterval));
    const breaks = intersectIntervals(scheduled, mergeIntervals(instances.flatMap((item) => item.reducingBreakIntervals)));
    const net = subtractIntervals(scheduled, breaks);
    const result: AvailabilityEvaluationResult = {
      valid: true, calendarId, startDate, endDate, calendarDayCount: count, resolvedShiftInstances: instances,
      grossScheduledIntervals: scheduled, reducingBreakIntervals: breaks, netAvailableIntervals: net,
      grossScheduledSeconds: intervalDuration(scheduled) * 60, plannedBreakSeconds: intervalDuration(breaks) * 60,
      netAvailableSeconds: intervalDuration(net) * 60, datesWithAvailability: dailySummaries.filter((item) => item.netAvailableSeconds > 0).length,
      closedDates, exceptionCount, overlapDiagnostics: overlaps,
      longestContinuousNetAvailabilitySeconds: net.reduce((longest, item) => Math.max(longest, (item.end - item.start) * 60), 0),
      dailySummaries, errors: [],
    };
    this.cache.set(key, result);
    if (this.cache.size > 100) this.cache.delete(this.cache.keys().next().value!);
    return result;
  }

  private shiftIdsForDate(normal: readonly string[], exception?: CalendarException): string[] {
    return exception ? exception.exceptionType === 'closed' ? [] : [...exception.replacementShiftIds] : [...normal];
  }
  private detectOverlaps(date: string, instances: readonly ResolvedShiftInstance[], output: AvailabilityOverlapDiagnostic[]): void {
    for (let left = 0; left < instances.length; left += 1) for (let right = left + 1; right < instances.length; right += 1) {
      if (instances[left].scheduledInterval.start < instances[right].scheduledInterval.end && instances[right].scheduledInterval.start < instances[left].scheduledInterval.end) output.push({ date, shiftIds: [instances[left].shiftId, instances[right].shiftId] });
    }
  }
  private invalid(calendarId: string, startDate: string, endDate: string, count: number, errors: readonly string[]): AvailabilityEvaluationResult {
    return { valid: false, calendarId, startDate, endDate, calendarDayCount: Math.max(0, count), resolvedShiftInstances: [], grossScheduledIntervals: [], reducingBreakIntervals: [], netAvailableIntervals: [], grossScheduledSeconds: 0, plannedBreakSeconds: 0, netAvailableSeconds: 0, datesWithAvailability: 0, closedDates: [], exceptionCount: 0, overlapDiagnostics: [], longestContinuousNetAvailabilitySeconds: 0, dailySummaries: [], errors };
  }
}
