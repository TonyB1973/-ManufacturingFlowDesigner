import type { StandardWorkTimeFormat } from '../../models/standardWork/StandardWork';

export function formatDuration(seconds: number, format: StandardWorkTimeFormat): string {
  if (!Number.isFinite(seconds) || seconds < 0) return 'Invalid';
  if (format === 'seconds') return `${Number.isInteger(seconds) ? seconds : Number(seconds.toFixed(3))} s`;
  const rounded = Math.round(seconds); const hours = Math.floor(rounded / 3600); const minutes = Math.floor(rounded % 3600 / 60); const remaining = rounded % 60;
  if (format === 'hoursMinutesSeconds') return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
  return `${String(Math.floor(rounded / 60)).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
}
