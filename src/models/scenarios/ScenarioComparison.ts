export type ScenarioEntityType =
  | 'resources' | 'operations' | 'connections' | 'layoutBoundaries' | 'walls' | 'areas' | 'aisles'
  | 'factoryRoutes' | 'factoryAnnotations' | 'standardWorkStudies' | 'standardWorkEntries'
  | 'standardWorkOperators' | 'standardWorkHandovers' | 'standardWorkPlanning';

export interface ScenarioEntityChange {
  readonly key: string;
  readonly entityType: ScenarioEntityType;
  readonly entityId: string;
  readonly status: 'added' | 'removed' | 'modified';
  readonly changedFields: readonly string[];
}

export interface ScenarioMetricDelta {
  readonly key: string;
  readonly label: string;
  readonly unit: string;
  readonly baseline: number | null;
  readonly alternative: number | null;
  readonly delta: number | null;
  readonly percentageDelta: number | null;
  readonly status: 'equal' | 'increased' | 'decreased' | 'notAvailable';
}

export interface ScenarioComparison {
  readonly baselineScenarioId: string;
  readonly comparisonScenarioId: string;
  readonly baselineRevision: number;
  readonly comparisonRevision: number;
  readonly changes: readonly ScenarioEntityChange[];
  readonly addedCount: number;
  readonly removedCount: number;
  readonly modifiedCount: number;
  readonly unchangedCount: number;
  readonly metrics: readonly ScenarioMetricDelta[];
  readonly diagnostics: readonly string[];
}
