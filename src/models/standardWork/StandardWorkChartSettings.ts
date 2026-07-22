export const STANDARD_WORK_CHART_INTERVAL_MODES = ['automatic', 'fixed'] as const;
export type StandardWorkChartIntervalMode = typeof STANDARD_WORK_CHART_INTERVAL_MODES[number];

export const STANDARD_WORK_CHART_LANE_DENSITIES = ['compact', 'comfortable'] as const;
export type StandardWorkChartLaneDensity = typeof STANDARD_WORK_CHART_LANE_DENSITIES[number];

export interface StandardWorkChartSettings {
  intervalMode: StandardWorkChartIntervalMode;
  fixedMajorIntervalSeconds: number;
  minorSubdivisions: number;
  showMinorGrid: boolean;
  showOperationIds: boolean;
  showOperationNames: boolean;
  showDurations: boolean;
  showStartEndValues: boolean;
  showAutomaticLaunchMarkers: boolean;
  showLaneIds: boolean;
  showAutomaticLanes: boolean;
  showDisabledEntries: boolean;
  laneDensity: StandardWorkChartLaneDensity;
}

export const DEFAULT_STANDARD_WORK_CHART_SETTINGS: Readonly<StandardWorkChartSettings> = {
  intervalMode: 'automatic',
  fixedMajorIntervalSeconds: 10,
  minorSubdivisions: 5,
  showMinorGrid: true,
  showOperationIds: true,
  showOperationNames: true,
  showDurations: true,
  showStartEndValues: false,
  showAutomaticLaunchMarkers: true,
  showLaneIds: true,
  showAutomaticLanes: true,
  showDisabledEntries: false,
  laneDensity: 'comfortable',
};

export function isValidStandardWorkChartSettings(value: unknown): value is StandardWorkChartSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return STANDARD_WORK_CHART_INTERVAL_MODES.includes(item.intervalMode as StandardWorkChartIntervalMode)
    && typeof item.fixedMajorIntervalSeconds === 'number' && Number.isFinite(item.fixedMajorIntervalSeconds) && item.fixedMajorIntervalSeconds > 0
    && Number.isInteger(item.minorSubdivisions) && Number(item.minorSubdivisions) >= 1 && Number(item.minorSubdivisions) <= 10
    && ['showMinorGrid', 'showOperationIds', 'showOperationNames', 'showDurations', 'showStartEndValues', 'showAutomaticLaunchMarkers', 'showLaneIds', 'showAutomaticLanes', 'showDisabledEntries'].every((key) => typeof item[key] === 'boolean')
    && STANDARD_WORK_CHART_LANE_DENSITIES.includes(item.laneDensity as StandardWorkChartLaneDensity);
}

export const cloneStandardWorkChartSettings = (value: StandardWorkChartSettings): StandardWorkChartSettings => ({ ...value });
