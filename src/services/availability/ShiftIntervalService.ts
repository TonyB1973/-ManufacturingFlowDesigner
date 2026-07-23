import type { ShiftBreak, ShiftDefinition } from '../../models/availability/AvailabilityModels';
import { shiftDurationMinutes } from '../../models/availability/AvailabilityModels';
import type { MinuteInterval } from './IntervalService';

export interface ResolvedShiftIntervals {
  readonly scheduled: MinuteInterval;
  readonly reducingBreaks: readonly MinuteInterval[];
}

export function resolveShiftIntervals(shift: ShiftDefinition, breaks: readonly ShiftBreak[], assignedDayNumber: number): ResolvedShiftIntervals {
  const start = assignedDayNumber * 1_440 + shift.startMinuteOfDay;
  const scheduled = { start, end: start + shiftDurationMinutes(shift) };
  const reducingBreaks = breaks.filter((item) => item.reducesAvailableTime)
    .map((item) => ({ start: start + item.startOffsetMinutes, end: start + item.startOffsetMinutes + item.durationMinutes }));
  return { scheduled, reducingBreaks };
}

export function resolvedBreakWallClockMinutes(shift: ShiftDefinition, item: ShiftBreak): { readonly startMinute: number; readonly endMinute: number; readonly startDayOffset: number; readonly endDayOffset: number } {
  const absoluteStart = shift.startMinuteOfDay + item.startOffsetMinutes;
  const absoluteEnd = absoluteStart + item.durationMinutes;
  return {
    startMinute: absoluteStart % 1_440,
    endMinute: absoluteEnd % 1_440,
    startDayOffset: Math.floor(absoluteStart / 1_440),
    endDayOffset: Math.floor(absoluteEnd / 1_440),
  };
}
