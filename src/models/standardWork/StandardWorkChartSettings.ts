export const STANDARD_WORK_CHART_INTERVAL_MODES = ['automatic', 'fixed'] as const;
export type StandardWorkChartIntervalMode = typeof STANDARD_WORK_CHART_INTERVAL_MODES[number];

export const STANDARD_WORK_CHART_LANE_DENSITIES = ['compact', 'comfortable'] as const;
export type StandardWorkChartLaneDensity = typeof STANDARD_WORK_CHART_LANE_DENSITIES[number];
export const STANDARD_WORK_HANDOVER_ROUTING_STYLES = ['orthogonal', 'curved'] as const;
export type StandardWorkHandoverRoutingStyle = typeof STANDARD_WORK_HANDOVER_ROUTING_STYLES[number];
export const STANDARD_WORK_BALANCE_VIEW_MODES = ['occupied', 'productive', 'categoryStack'] as const;
export type StandardWorkBalanceViewMode = typeof STANDARD_WORK_BALANCE_VIEW_MODES[number];

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
  showOperatorIds: boolean;
  showOperatorRoles: boolean;
  showOperatorTotals: boolean;
  showHandoverLinks: boolean;
  showDisabledHandovers: boolean;
  showDependencyIdle: boolean;
  operatorLaneDensity: StandardWorkChartLaneDensity;
  handoverRoutingStyle: StandardWorkHandoverRoutingStyle;
  showTaktLine: boolean;
  showTaktValue: boolean;
  shadeBeyondTakt: boolean;
  includeTaktInFit: boolean;
  workBalanceViewMode: StandardWorkBalanceViewMode;
  showWorkBalanceValues: boolean;
  showWorkBalancePercentages: boolean;
  workBalanceDensity: StandardWorkChartLaneDensity;
  showCapacitySummary: boolean;
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
  showOperatorIds: true,
  showOperatorRoles: true,
  showOperatorTotals: true,
  showHandoverLinks: true,
  showDisabledHandovers: false,
  showDependencyIdle: true,
  operatorLaneDensity: 'comfortable',
  handoverRoutingStyle: 'orthogonal',
  showTaktLine: true,
  showTaktValue: true,
  shadeBeyondTakt: true,
  includeTaktInFit: true,
  workBalanceViewMode: 'categoryStack',
  showWorkBalanceValues: true,
  showWorkBalancePercentages: true,
  workBalanceDensity: 'comfortable',
  showCapacitySummary: true,
};

export function isValidStandardWorkChartSettings(value: unknown): value is StandardWorkChartSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return STANDARD_WORK_CHART_INTERVAL_MODES.includes(item.intervalMode as StandardWorkChartIntervalMode)
    && typeof item.fixedMajorIntervalSeconds === 'number' && Number.isFinite(item.fixedMajorIntervalSeconds) && item.fixedMajorIntervalSeconds > 0
    && Number.isInteger(item.minorSubdivisions) && Number(item.minorSubdivisions) >= 1 && Number(item.minorSubdivisions) <= 10
    && ['showMinorGrid', 'showOperationIds', 'showOperationNames', 'showDurations', 'showStartEndValues', 'showAutomaticLaunchMarkers', 'showLaneIds', 'showAutomaticLanes', 'showDisabledEntries', 'showOperatorIds', 'showOperatorRoles', 'showOperatorTotals', 'showHandoverLinks', 'showDisabledHandovers', 'showDependencyIdle', 'showTaktLine', 'showTaktValue', 'shadeBeyondTakt', 'includeTaktInFit', 'showWorkBalanceValues', 'showWorkBalancePercentages', 'showCapacitySummary'].every((key) => typeof item[key] === 'boolean')
    && STANDARD_WORK_CHART_LANE_DENSITIES.includes(item.laneDensity as StandardWorkChartLaneDensity)
    && STANDARD_WORK_CHART_LANE_DENSITIES.includes(item.operatorLaneDensity as StandardWorkChartLaneDensity)
    && STANDARD_WORK_CHART_LANE_DENSITIES.includes(item.workBalanceDensity as StandardWorkChartLaneDensity)
    && STANDARD_WORK_BALANCE_VIEW_MODES.includes(item.workBalanceViewMode as StandardWorkBalanceViewMode)
    && STANDARD_WORK_HANDOVER_ROUTING_STYLES.includes(item.handoverRoutingStyle as StandardWorkHandoverRoutingStyle);
}

export const cloneStandardWorkChartSettings = (value: StandardWorkChartSettings): StandardWorkChartSettings => ({ ...value });
