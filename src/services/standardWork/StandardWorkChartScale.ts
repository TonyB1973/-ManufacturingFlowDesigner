import type { StandardWorkChartSettings } from '../../models/standardWork/StandardWorkChartSettings';

const engineeringIntervals = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 20, 30, 60, 120, 300, 600] as const;

export interface StandardWorkChartTick { readonly seconds: number; readonly major: boolean; }

export function chooseStandardWorkMajorInterval(visibleSeconds: number, chartWidthPixels: number): number {
  if (!Number.isFinite(visibleSeconds) || visibleSeconds <= 0 || !Number.isFinite(chartWidthPixels) || chartWidthPixels <= 0) return 1;
  const targetCount = Math.min(14, Math.max(6, chartWidthPixels / 110)); const target = visibleSeconds / targetCount;
  return engineeringIntervals.find((value) => value >= target) ?? Math.pow(10, Math.ceil(Math.log10(target)));
}

export function resolveStandardWorkMajorInterval(settings: StandardWorkChartSettings, visibleSeconds: number, chartWidthPixels: number): number {
  return settings.intervalMode === 'fixed' && Number.isFinite(settings.fixedMajorIntervalSeconds) && settings.fixedMajorIntervalSeconds > 0
    ? settings.fixedMajorIntervalSeconds
    : chooseStandardWorkMajorInterval(visibleSeconds, chartWidthPixels);
}

export function buildStandardWorkTicks(startSeconds: number, endSeconds: number, majorInterval: number, minorSubdivisions: number, includeMinor: boolean, maximum = 500): readonly StandardWorkChartTick[] {
  if (![startSeconds, endSeconds, majorInterval].every(Number.isFinite) || endSeconds < startSeconds || majorInterval <= 0) return [];
  const subdivisions = Number.isInteger(minorSubdivisions) ? Math.min(10, Math.max(1, minorSubdivisions)) : 1;
  const step = includeMinor ? majorInterval / subdivisions : majorInterval; const first = Math.max(0, Math.ceil((startSeconds - 1e-9) / step) * step); const ticks: StandardWorkChartTick[] = [];
  for (let value = first; value <= endSeconds + 1e-9 && ticks.length < maximum; value += step) {
    const normalized = Math.round(value * 1e9) / 1e9; const ratio = normalized / majorInterval;
    ticks.push({ seconds: normalized, major: Math.abs(ratio - Math.round(ratio)) < 1e-7 });
  }
  return ticks;
}

export function fitStandardWorkPixelsPerSecond(spanSeconds: number, widthPixels: number, paddingPixels = 40): number {
  if (!Number.isFinite(spanSeconds) || spanSeconds <= 0 || !Number.isFinite(widthPixels) || widthPixels <= paddingPixels) return 10;
  return Math.max(0.05, (widthPixels - paddingPixels) / spanSeconds);
}
