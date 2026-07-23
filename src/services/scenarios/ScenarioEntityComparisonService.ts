import type { ManufacturingScenario, ManufacturingScenarioState } from '../../models/scenarios/ManufacturingScenario';
import type { ScenarioComparison, ScenarioEntityChange, ScenarioEntityType, ScenarioMetricDelta } from '../../models/scenarios/ScenarioComparison';
import type { ProjectSettings } from '../../models/project/ProjectDocument';
import type { AvailabilityStore } from '../availability/AvailabilityStore';
import { validateFactoryLayout } from '../FactoryLayoutValidation';
import { factoryRouteDistance } from '../geometry/FactoryRouteGeometry';
import { polygonArea, polylineLength } from '../geometry/FactoryStructureGeometry';
import { StandardWorkChartScheduler } from '../standardWork/StandardWorkChartScheduler';
import { calculateStandardWorkTaktWithAvailability } from '../standardWork/StandardWorkTaktService';
import { calculateStandardWorkBalance } from '../standardWork/StandardWorkBalanceService';
import { calculateStandardWorkCapacity } from '../standardWork/StandardWorkCapacityService';
import { validateScenario } from './ScenarioValidationService';

export interface ScenarioComparisonContext {
  readonly availability: AvailabilityStore;
  readonly settings: ProjectSettings;
  readonly studyId?: string | null;
}

const ENTITY_TYPES: readonly ScenarioEntityType[] = [
  'resources', 'operations', 'connections', 'layoutBoundaries', 'walls', 'areas', 'aisles',
  'factoryRoutes', 'factoryAnnotations', 'standardWorkStudies', 'standardWorkEntries',
  'standardWorkOperators', 'standardWorkHandovers', 'standardWorkPlanning',
];
const TOLERANCE = 1e-6;

export class ScenarioEntityComparisonService {
  private cache: { readonly key: string; readonly value: ScenarioComparison } | null = null;

  public compare(baseline: ManufacturingScenario, alternative: ManufacturingScenario, baselineRevision = 0, comparisonRevision = 0, context?: ScenarioComparisonContext): ScenarioComparison {
    if (baseline.id === alternative.id) throw new Error('A scenario cannot be compared with itself.');
    const cacheKey = `${baseline.id}:${baselineRevision}|${alternative.id}:${comparisonRevision}|availability:${context?.availability.getRevision() ?? 0}|default:${context?.settings.defaultAvailabilityCalendarId ?? ''}|study:${context?.studyId ?? ''}`;
    if (this.cache?.key === cacheKey) return this.cache.value;
    const changes = ENTITY_TYPES.flatMap((type) => this.compareCollection(type, baseline.state, alternative.state));
    const entityCount = ENTITY_TYPES.reduce((sum, type) => sum + new Set([...collection(baseline.state, type).map((item) => entityId(item, type)), ...collection(alternative.state, type).map((item) => entityId(item, type))]).size, 0);
    const value: ScenarioComparison = {
      baselineScenarioId: baseline.id, comparisonScenarioId: alternative.id, baselineRevision, comparisonRevision, changes,
      addedCount: changes.filter((item) => item.status === 'added').length,
      removedCount: changes.filter((item) => item.status === 'removed').length,
      modifiedCount: changes.filter((item) => item.status === 'modified').length,
      unchangedCount: entityCount - changes.length,
      metrics: this.metrics(baseline, alternative, context),
      diagnostics: alternative.sourceScenarioId && alternative.sourceScenarioId !== baseline.id ? ['The comparison scenario was not created directly from the current baseline. Stable IDs are still compared within their entity type.'] : [],
    };
    this.cache = { key: cacheKey, value };
    return value;
  }

  private compareCollection(type: ScenarioEntityType, baseline: ManufacturingScenarioState, alternative: ManufacturingScenarioState): ScenarioEntityChange[] {
    const left = new Map(collection(baseline, type).map((item) => [entityId(item, type), item]));
    const right = new Map(collection(alternative, type).map((item) => [entityId(item, type), item]));
    const ids = [...new Set([...left.keys(), ...right.keys()])].sort();
    return ids.flatMap<ScenarioEntityChange>((id): ScenarioEntityChange[] => {
      const before = left.get(id); const after = right.get(id);
      if (!before) return [{ key: `${type}:${id}`, entityType: type, entityId: id, status: 'added' as const, changedFields: [] }];
      if (!after) return [{ key: `${type}:${id}`, entityType: type, entityId: id, status: 'removed' as const, changedFields: [] }];
      const changedFields = changedKeys(before, after);
      return changedFields.length ? [{ key: `${type}:${id}`, entityType: type, entityId: id, status: 'modified' as const, changedFields }] : [];
    });
  }

  private metrics(baseline: ManufacturingScenario, alternative: ManufacturingScenario, context?: ScenarioComparisonContext): ScenarioMetricDelta[] {
    const studyId = context?.studyId ?? baseline.state.standardWorkStudies.find((study) => alternative.state.standardWorkStudies.some((candidate) => candidate.id === study.id))?.id ?? null;
    const left = engineeringValues(baseline, context, studyId); const right = engineeringValues(alternative, context, studyId);
    const keys = [...new Set([...left.keys(), ...right.keys()])];
    return keys.map((key) => {
      const baselineValue = left.get(key); const alternativeValue = right.get(key); const descriptor = baselineValue ?? alternativeValue!;
      return metric(key, descriptor.label, descriptor.unit, baselineValue ? baselineValue.value : 0, alternativeValue ? alternativeValue.value : 0);
    });
  }
}

interface EngineeringValue { readonly label: string; readonly unit: string; readonly value: number | null }
function engineeringValues(scenario: ManufacturingScenario, context?: ScenarioComparisonContext, studyId: string | null = null): Map<string, EngineeringValue> {
  const state = scenario.state; const values = new Map<string, EngineeringValue>();
  const add = (key: string, label: string, unit: string, value: number | null): void => { values.set(key, { label, unit, value }); };
  const operationDuration = (category: string): number => state.operations.filter((item) => item.timingCategory === category).reduce((sum, item) => sum + item.cycleTimeSeconds, 0);
  add('operations', 'Operations', 'count', state.operations.length);
  add('connections', 'Process connections', 'count', state.connections.length);
  add('assigned-operations', 'Assigned operations', 'count', state.operations.filter((item) => item.assignedResourceId).length);
  add('unassigned-operations', 'Unassigned operations', 'count', state.operations.filter((item) => !item.assignedResourceId).length);
  add('cycle-time', 'Total operation cycle time', 's', state.operations.reduce((sum, item) => sum + item.cycleTimeSeconds, 0));
  for (const category of ['manual', 'automatic', 'walking', 'waiting']) add(`operation-${category}`, `${title(category)} operation time`, 's', operationDuration(category));

  const layout = validateFactoryLayout(state.resources.map((item) => ({ ...item, clearance: { ...item.clearance }, selected: false })));
  const boundaryArea = state.layoutBoundaries[0] ? polygonArea(state.layoutBoundaries[0].points) : null;
  add('resources', 'Physical resources', 'count', state.resources.length);
  add('active-resources', 'Active physical resources', 'count', state.resources.filter((item) => item.active).length);
  for (const type of [...new Set(state.resources.map((item) => item.resourceType))].sort()) add(`resource-type:${type}`, `${type} resources`, 'count', state.resources.filter((item) => item.resourceType === type).length);
  add('footprint', 'Nominal resource footprint', 'model²', layout.footprintArea);
  add('boundary-area', 'Factory boundary area', 'model²', boundaryArea);
  add('footprint-ratio', 'Nominal footprint ratio', '%', boundaryArea && boundaryArea > 0 ? layout.footprintArea / boundaryArea * 100 : null);
  add('physical-overlaps', 'Physical overlap errors', 'count', layout.issues.filter((item) => item.severity === 'error').length);
  add('clearance-warnings', 'Clearance warnings', 'count', layout.issues.filter((item) => item.severity === 'warning').length);
  add('walls', 'Walls', 'count', state.walls.length); add('areas', 'Areas', 'count', state.areas.length); add('aisles', 'Aisles', 'count', state.aisles.length);
  add('aisle-distance', 'Total aisle centreline length', 'model', state.aisles.reduce((sum, item) => sum + polylineLength(item.points), 0));
  const resourceMap = new Map(state.resources.map((item) => [item.id, { ...item, clearance: { ...item.clearance }, selected: false }]));
  const areaMap = new Map(state.areas.map((item) => [item.id, item]));
  const routeSource = { getResource: (id: string) => resourceMap.get(id), getArea: (id: string) => areaMap.get(id) };
  add('routes', 'Factory routes', 'count', state.factoryRoutes.length);
  add('route-distance', 'Total Factory Route distance', 'model', state.factoryRoutes.reduce((sum, item) => sum + factoryRouteDistance(item, routeSource), 0));
  add('annotations', 'Factory annotations', 'count', state.factoryAnnotations.length);

  add('studies', 'Standard Work studies', 'count', state.standardWorkStudies.length);
  add('operators', 'Standard Work operators', 'count', state.standardWorkOperators.length);
  add('entries', 'Standard Work entries', 'count', state.standardWorkEntries.length);
  add('handovers', 'Standard Work handovers', 'count', state.standardWorkHandovers.length);
  const analysis = studyId ? analyseStudy(state, studyId, context) : null;
  for (const category of ['manual', 'automatic', 'walking', 'waiting'] as const) add(`standard-work-${category}`, `${title(category)} Standard Work time`, 's', analysis?.schedule.summary[`${category}Seconds`] ?? null);
  add('chart-cycle', 'Chart cycle span', 's', analysis?.schedule.chartCycleSpanSeconds ?? null);
  add('takt', 'Takt time', 's', analysis?.takt ?? null);
  add('nominal-capacity', 'Chart-based nominal capacity', 'units', analysis?.capacity ?? null);
  add('balance-efficiency', 'Work-balance efficiency', '%', analysis?.balanceEfficiency ?? null);
  add('minimum-operators', 'Theoretical minimum operators', 'count', analysis?.minimumOperators ?? null);
  add('operators-over-takt', 'Operators over takt', 'count', analysis?.operatorsOverTakt ?? null);
  add('automatic-overlaps', 'Potential automatic-resource overlaps', 'count', analysis?.schedule.summary.potentialOverlapCount ?? null);

  const calendarIds = new Set(context?.availability.getCalendars().map((item) => item.id) ?? []);
  const effective = (id: string | null): string | null => id ?? context?.settings.defaultAvailabilityCalendarId ?? null;
  add('operator-calendar-assignments', 'Effective operator-calendar assignments', 'count', state.standardWorkOperators.filter((item) => effective(item.availabilityCalendarId)).length);
  add('resource-calendar-assignments', 'Effective resource-calendar assignments', 'count', state.resources.filter((item) => effective(item.availabilityCalendarId)).length);
  add('calendar-net-time', 'Calendar-planning net available time', 's', analysis?.netAvailable ?? null);
  add('availability-shortfalls', 'Availability shortfalls', 'count', null);
  add('missing-effective-calendars', 'Missing effective calendars', 'count', context ? [...state.resources.map((item) => effective(item.availabilityCalendarId)), ...state.standardWorkOperators.map((item) => effective(item.availabilityCalendarId))].filter((id) => !id || !calendarIds.has(id)).length : null);
  if (context) {
    const health = validateScenario(scenario, context.availability.getCalendars(), context.settings);
    add('health-errors', 'Scenario errors', 'count', health.errors); add('health-warnings', 'Scenario warnings', 'count', health.warnings);
  } else { add('health-errors', 'Scenario errors', 'count', null); add('health-warnings', 'Scenario warnings', 'count', null); }
  add('information-diagnostics', 'Information diagnostics', 'count', analysis?.schedule.diagnostics.filter((item) => item.severity === 'information').length ?? null);
  return values;
}

function analyseStudy(state: ManufacturingScenarioState, studyId: string, context?: ScenarioComparisonContext) {
  const study = state.standardWorkStudies.find((item) => item.id === studyId); if (!study) return null;
  const operationMap = new Map(state.operations.map((item) => [item.id, { ...item, selected: false }]));
  const resourceMap = new Map(state.resources.map((item) => [item.id, { ...item, clearance: { ...item.clearance }, selected: false }]));
  const operators = state.standardWorkOperators.filter((item) => item.studyId === studyId);
  const scheduler = new StandardWorkChartScheduler(
    { getOperation: (id: string) => operationMap.get(id) },
    { getResource: (id: string) => resourceMap.get(id) },
    { getOperators: () => operators },
    { getHandovers: () => state.standardWorkHandovers.filter((item) => item.studyId === studyId) },
  );
  const schedule = scheduler.calculate(study, state.standardWorkEntries.filter((item) => item.studyId === studyId));
  const planning = state.standardWorkPlanning.find((item) => item.studyId === studyId);
  const taktResult = planning && context ? calculateStandardWorkTaktWithAvailability(planning, context.availability) : null;
  const takt = planning?.active && taktResult?.valid ? taktResult.taktTimeSeconds : null;
  const balance = calculateStandardWorkBalance(schedule, operators, takt);
  const capacity = planning && taktResult ? calculateStandardWorkCapacity(taktResult, schedule.chartCycleSpanSeconds, planning.requiredOutputUnits) : null;
  return {
    schedule, takt, netAvailable: planning?.active && taktResult?.valid ? taktResult.netAvailableProductionSeconds : null,
    capacity: planning?.active ? capacity?.nominalUnitsPerPeriod ?? null : null,
    balanceEfficiency: balance.balanceEfficiencyPercent, minimumOperators: balance.theoreticalMinimumOperators,
    operatorsOverTakt: takt === null ? null : balance.operators.filter((item) => (item.overloadSeconds ?? 0) > 0).length,
  };
}

function title(value: string): string { return `${value[0].toUpperCase()}${value.slice(1)}`; }

function collection(state: ManufacturingScenarioState, type: ScenarioEntityType): readonly Record<string, unknown>[] {
  return state[type] as unknown as readonly Record<string, unknown>[];
}
function entityId(value: Record<string, unknown>, type: ScenarioEntityType): string {
  return type === 'standardWorkPlanning' ? String(value.studyId) : String(value.id);
}
function changedKeys(left: Record<string, unknown>, right: Record<string, unknown>): string[] {
  return [...new Set([...Object.keys(left), ...Object.keys(right)])].filter((key) => !equal(left[key], right[key])).sort();
}
function equal(left: unknown, right: unknown): boolean {
  if (typeof left === 'number' && typeof right === 'number') return Math.abs(left - right) <= TOLERANCE;
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((item, index) => equal(item, right[index]));
  if (left && right && typeof left === 'object' && typeof right === 'object') {
    const leftRecord = left as Record<string, unknown>; const rightRecord = right as Record<string, unknown>;
    const keys = new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)]);
    return [...keys].every((key) => equal(leftRecord[key], rightRecord[key]));
  }
  return Object.is(left, right);
}
function metric(key: string, label: string, unit: string, baseline: number | null, alternative: number | null): ScenarioMetricDelta {
  if (baseline === null || alternative === null) return { key, label, unit, baseline, alternative, delta: null, percentageDelta: null, status: 'notAvailable' };
  const delta = alternative - baseline; const percentageDelta = Math.abs(baseline) <= TOLERANCE ? null : delta / Math.abs(baseline) * 100;
  return { key, label, unit, baseline, alternative, delta, percentageDelta, status: Math.abs(delta) <= TOLERANCE ? 'equal' : delta > 0 ? 'increased' : 'decreased' };
}
