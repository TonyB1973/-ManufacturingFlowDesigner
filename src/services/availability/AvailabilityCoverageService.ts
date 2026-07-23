import type { ResourceInstance } from '../../models/resources/ResourceInstance';
import type { StandardWorkEntry } from '../../models/standardWork/StandardWork';
import type { StandardWorkOperator } from '../../models/standardWork/StandardWorkOperator';
import type { OperationStore } from '../OperationStore';
import type { ResourceStore } from '../ResourceStore';
import { AvailabilityAssignmentResolver } from './AvailabilityAssignmentResolver';
import { AvailabilityCalendarEvaluationService } from './AvailabilityCalendarEvaluationService';
import type { ResolvedStandardWorkPlanning } from './StandardWorkCalendarPlanningService';

export interface AvailabilityCoverageItem {
  readonly kind: 'operator' | 'resource';
  readonly id: string;
  readonly name: string;
  readonly effectiveCalendarId: string | null;
  readonly assignmentSource: 'explicit' | 'projectDefault' | 'none';
  readonly entityNetAvailableSeconds: number | null;
  readonly planningNetAvailableSeconds: number;
  readonly availabilityCoverageRatio: number | null;
  readonly availabilityShortfallSeconds: number | null;
  readonly status: 'covered' | 'shortfall' | 'notConfigured' | 'unavailable';
  readonly diagnostics: readonly AvailabilityCoverageDiagnostic[];
}
export interface AvailabilityCoverageDiagnostic {
  readonly severity: 'warning' | 'information';
  readonly code: string;
  readonly message: string;
}
export interface AvailabilityCoverageResult {
  readonly available: boolean;
  readonly operators: readonly AvailabilityCoverageItem[];
  readonly resources: readonly AvailabilityCoverageItem[];
  readonly diagnostics: readonly AvailabilityCoverageDiagnostic[];
}

export class AvailabilityCoverageService {
  public constructor(
    private readonly assignment: AvailabilityAssignmentResolver,
    private readonly evaluation: AvailabilityCalendarEvaluationService,
    private readonly operations: OperationStore,
    private readonly resources: ResourceStore,
  ) {}

  public calculate(planning: ResolvedStandardWorkPlanning, entries: readonly StandardWorkEntry[], operators: readonly StandardWorkOperator[]): AvailabilityCoverageResult {
    if (planning.parameters.availabilityMode !== 'calendar' || !planning.evaluation?.valid || !planning.parameters.active) return { available: false, operators: [], resources: [], diagnostics: [] };
    const includedOperatorIds = new Set(entries.filter((item) => item.enabled).map((item) => item.assignedOperatorId));
    const operatorItems = operators.filter((item) => item.active && includedOperatorIds.has(item.id)).map((item) => this.operatorCoverage(item, planning));
    const requiredResources = new Map<string, ResourceInstance>();
    for (const entry of entries.filter((item) => item.enabled)) {
      const operation = this.operations.getOperation(entry.operationId); const resource = operation?.assignedResourceId ? this.resources.getResource(operation.assignedResourceId) : undefined;
      if (resource) requiredResources.set(resource.id, resource);
    }
    const diagnostics: AvailabilityCoverageDiagnostic[] = [];
    if (planning.evaluation.netAvailableSeconds <= 0) diagnostics.push({ severity: 'warning', code: 'planning-zero-availability', message: 'Planning calendar contains no availability in the selected range.' });
    if (planning.evaluation.overlapDiagnostics.length) diagnostics.push({ severity: 'warning', code: 'planning-overlap', message: 'Planning calendar contains overlapping shifts; totals use interval union.' });
    if (planning.evaluation.resolvedShiftInstances.some((item) => !item.active)) diagnostics.push({ severity: 'warning', code: 'planning-inactive-shift', message: 'Planning calendar references inactive shifts.' });
    if (planning.evaluation.exceptionCount) diagnostics.push({ severity: 'information', code: 'planning-exceptions', message: `${planning.evaluation.exceptionCount} calendar exception(s) change the normal planning pattern.` });
    return { available: true, operators: operatorItems, resources: [...requiredResources.values()].map((item) => this.resourceCoverage(item, planning)), diagnostics };
  }

  private operatorCoverage(item: StandardWorkOperator, planning: ResolvedStandardWorkPlanning): AvailabilityCoverageItem {
    const resolved = this.assignment.forOperator(item); return this.coverage('operator', item.id, item.name, resolved, planning);
  }
  private resourceCoverage(item: ResourceInstance, planning: ResolvedStandardWorkPlanning): AvailabilityCoverageItem {
    const resolved = this.assignment.forResource(item); return this.coverage('resource', item.id, item.name, resolved, planning);
  }
  private coverage(kind: AvailabilityCoverageItem['kind'], id: string, name: string, resolved: ReturnType<AvailabilityAssignmentResolver['resolve']>, planning: ResolvedStandardWorkPlanning): AvailabilityCoverageItem {
    const required = planning.evaluation?.netAvailableSeconds ?? 0;
    const noun = kind === 'operator' ? 'Included operator' : 'Required physical resource';
    if (!resolved.calendarId) return { kind, id, name, effectiveCalendarId: null, assignmentSource: resolved.source, entityNetAvailableSeconds: null, planningNetAvailableSeconds: required, availabilityCoverageRatio: null, availabilityShortfallSeconds: null, status: 'notConfigured', diagnostics: [{ severity: 'warning', code: 'no-effective-calendar', message: `${noun} has no effective availability calendar.` }] };
    const start = planning.parameters.periodStartDate!; const end = planning.parameters.periodEndDate!;
    const evaluated = this.evaluation.evaluate(resolved.calendarId, start, end);
    if (!evaluated.valid) return { kind, id, name, effectiveCalendarId: resolved.calendarId, assignmentSource: resolved.source, entityNetAvailableSeconds: null, planningNetAvailableSeconds: required, availabilityCoverageRatio: null, availabilityShortfallSeconds: null, status: 'unavailable', diagnostics: [{ severity: 'warning', code: 'unavailable-calendar', message: `${noun} availability calendar could not be evaluated.` }] };
    const shortfall = Math.max(0, required - evaluated.netAvailableSeconds); const ratio = required > 0 ? evaluated.netAvailableSeconds / required : null;
    const diagnostics: AvailabilityCoverageDiagnostic[] = [];
    if (resolved.source === 'projectDefault') diagnostics.push({ severity: 'information', code: 'inherited-calendar', message: `${noun} inherits the project default calendar.` });
    if (resolved.active === false) diagnostics.push({ severity: 'warning', code: 'inactive-calendar', message: `${noun} is assigned an inactive calendar.` });
    if (evaluated.resolvedShiftInstances.some((item) => !item.active)) diagnostics.push({ severity: 'warning', code: 'inactive-shift', message: `${noun} calendar references inactive shifts.` });
    if (evaluated.overlapDiagnostics.length) diagnostics.push({ severity: 'warning', code: 'overlapping-shifts', message: `${noun} calendar contains overlapping shifts; totals use interval union.` });
    if (evaluated.netAvailableSeconds <= 0) diagnostics.push({ severity: 'warning', code: 'zero-availability', message: `${noun} has zero availability in the planning period.` });
    if (shortfall > 0) diagnostics.push({ severity: 'warning', code: 'availability-shortfall', message: `${noun} net availability is less than planning-calendar net availability.` });
    if (evaluated.netAvailableSeconds > required) diagnostics.push({ severity: 'information', code: 'additional-availability', message: `${noun} has more availability than the planning calendar.` });
    if (resolved.calendarId !== planning.parameters.planningCalendarId) diagnostics.push({ severity: 'information', code: 'different-calendar', message: `${noun} uses a different calendar from the planning calendar.` });
    if (evaluated.exceptionCount) diagnostics.push({ severity: 'information', code: 'calendar-exceptions', message: `${evaluated.exceptionCount} calendar exception(s) change the normal pattern.` });
    return { kind, id, name, effectiveCalendarId: resolved.calendarId, assignmentSource: resolved.source, entityNetAvailableSeconds: evaluated.netAvailableSeconds, planningNetAvailableSeconds: required, availabilityCoverageRatio: ratio, availabilityShortfallSeconds: shortfall, status: shortfall > 0 ? 'shortfall' : 'covered', diagnostics };
  }
}
