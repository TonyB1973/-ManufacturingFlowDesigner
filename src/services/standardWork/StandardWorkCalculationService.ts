import type { TimingCategory } from '../../models/operations/OperationTemplate';
import type { StandardWorkEntry } from '../../models/standardWork/StandardWork';
import type { StandardWorkOperationResolver } from './StandardWorkOperationResolver';

export interface StandardWorkCategorySummary { readonly category: TimingCategory; readonly seconds: number; readonly entryCount: number; readonly percentage: number; }
export interface StandardWorkSummary {
  readonly entryCount: number; readonly enabledEntryCount: number; readonly disabledEntryCount: number; readonly uniqueOperationCount: number; readonly totalOccurrences: number;
  readonly manualSeconds: number; readonly automaticSeconds: number; readonly walkingSeconds: number; readonly waitingSeconds: number; readonly sumOfIncludedDurations: number;
  readonly zeroDurationCount: number; readonly assignedResourceCount: number; readonly unassignedOperationCount: number; readonly categories: readonly StandardWorkCategorySummary[];
}

const categories: readonly TimingCategory[] = ['manual', 'automatic', 'walking', 'waiting'];
export function calculateStandardWorkSummary(entries: readonly StandardWorkEntry[], resolver: StandardWorkOperationResolver): StandardWorkSummary {
  const resolved = entries.map((entry) => resolver.resolve(entry)); const included = resolved.filter((item) => item.entry.enabled && item.operation && item.effectiveDurationSeconds !== null);
  const seconds = (category: TimingCategory): number => included.filter((item) => item.timingCategory === category).reduce((sum, item) => sum + item.effectiveDurationSeconds!, 0);
  const totals = new Map(categories.map((category) => [category, seconds(category)])); const sum = [...totals.values()].reduce((left, right) => left + right, 0);
  return {
    entryCount: entries.length, enabledEntryCount: entries.filter((entry) => entry.enabled).length, disabledEntryCount: entries.filter((entry) => !entry.enabled).length,
    uniqueOperationCount: new Set(entries.map((entry) => entry.operationId)).size, totalOccurrences: entries.reduce((total, entry) => total + entry.occurrences, 0),
    manualSeconds: totals.get('manual')!, automaticSeconds: totals.get('automatic')!, walkingSeconds: totals.get('walking')!, waitingSeconds: totals.get('waiting')!, sumOfIncludedDurations: sum,
    zeroDurationCount: resolved.filter((item) => item.operation?.cycleTimeSeconds === 0).length,
    assignedResourceCount: new Set(resolved.filter((item) => item.operation?.assignedResourceId).map((item) => item.operation!.assignedResourceId!)).size,
    unassignedOperationCount: resolved.filter((item) => item.operation && !item.operation.assignedResourceId).length,
    categories: categories.map((category) => ({ category, seconds: totals.get(category)!, entryCount: included.filter((item) => item.timingCategory === category).length, percentage: sum > 0 ? totals.get(category)! / sum * 100 : 0 })),
  };
}
