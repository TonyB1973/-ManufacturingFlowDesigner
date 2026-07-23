import type { StandardWorkPlanningParameters } from '../../models/standardWork/StandardWorkPlanning';
import type { StandardWorkTaktResult } from '../standardWork/StandardWorkTaktService';
import { AvailabilityCalendarEvaluationService, type AvailabilityEvaluationResult } from './AvailabilityCalendarEvaluationService';

export interface ResolvedStandardWorkPlanning {
  readonly parameters: StandardWorkPlanningParameters;
  readonly scheduledProductionTimeSeconds: number;
  readonly plannedBreakTimeSeconds: number;
  readonly calendarNetAvailableSeconds: number;
  readonly netAvailableProductionSeconds: number;
  readonly evaluation: AvailabilityEvaluationResult | null;
  readonly takt: StandardWorkTaktResult;
  readonly errors: readonly string[];
}

export class StandardWorkCalendarPlanningService {
  public constructor(private readonly calendars: AvailabilityCalendarEvaluationService) {}
  public resolve(parameters: StandardWorkPlanningParameters): ResolvedStandardWorkPlanning {
    if (parameters.availabilityMode === 'manual') {
      const takt = calculateResolvedTakt(parameters);
      return {
        parameters, scheduledProductionTimeSeconds: parameters.scheduledProductionTimeSeconds,
        plannedBreakTimeSeconds: parameters.plannedBreakTimeSeconds,
        calendarNetAvailableSeconds: parameters.scheduledProductionTimeSeconds - parameters.plannedBreakTimeSeconds,
        netAvailableProductionSeconds: takt.netAvailableProductionSeconds ?? 0, evaluation: null, takt, errors: takt.errors,
      };
    }
    if (!parameters.planningCalendarId || !parameters.periodStartDate || !parameters.periodEndDate) {
      const errors = ['Calendar mode requires a planning calendar and valid period dates.'];
      return { parameters, scheduledProductionTimeSeconds: 0, plannedBreakTimeSeconds: 0, calendarNetAvailableSeconds: 0, netAvailableProductionSeconds: 0, evaluation: null, takt: { valid: false, active: parameters.active, netAvailableProductionSeconds: null, taktTimeSeconds: null, errors }, errors };
    }
    const evaluation = this.calendars.evaluate(parameters.planningCalendarId, parameters.periodStartDate, parameters.periodEndDate);
    const scheduled = evaluation.grossScheduledSeconds; const plannedBreaks = evaluation.plannedBreakSeconds;
    const derived = { ...parameters, scheduledProductionTimeSeconds: scheduled, plannedBreakTimeSeconds: plannedBreaks };
    const takt = evaluation.valid ? calculateResolvedTakt(derived) : { valid: false, active: parameters.active, netAvailableProductionSeconds: null, taktTimeSeconds: null, errors: evaluation.errors };
    return {
      parameters, scheduledProductionTimeSeconds: scheduled, plannedBreakTimeSeconds: plannedBreaks,
      calendarNetAvailableSeconds: evaluation.netAvailableSeconds, netAvailableProductionSeconds: takt.netAvailableProductionSeconds ?? 0,
      evaluation, takt, errors: [...evaluation.errors, ...takt.errors],
    };
  }
}

function calculateResolvedTakt(parameters: StandardWorkPlanningParameters): StandardWorkTaktResult {
  const errors: string[] = [];
  if (!Number.isFinite(parameters.scheduledProductionTimeSeconds) || parameters.scheduledProductionTimeSeconds <= 0) errors.push('Scheduled production time must be finite and greater than zero.');
  if (!Number.isFinite(parameters.plannedBreakTimeSeconds) || parameters.plannedBreakTimeSeconds < 0) errors.push('Planned break time must be finite and non-negative.');
  if (!Number.isFinite(parameters.plannedDowntimeSeconds) || parameters.plannedDowntimeSeconds < 0) errors.push('Planned downtime must be finite and non-negative.');
  if (Number.isFinite(parameters.scheduledProductionTimeSeconds) && Number.isFinite(parameters.plannedBreakTimeSeconds) && Number.isFinite(parameters.plannedDowntimeSeconds) && parameters.plannedBreakTimeSeconds + parameters.plannedDowntimeSeconds >= parameters.scheduledProductionTimeSeconds) errors.push('Planned break and downtime must be less than scheduled production time.');
  if (!Number.isFinite(parameters.requiredOutputUnits) || parameters.requiredOutputUnits <= 0) errors.push('Required output must be finite and greater than zero.');
  if (errors.length) return { valid: false, active: parameters.active, netAvailableProductionSeconds: null, taktTimeSeconds: null, errors };
  const net = parameters.scheduledProductionTimeSeconds - parameters.plannedBreakTimeSeconds - parameters.plannedDowntimeSeconds;
  return net > 0 ? { valid: true, active: parameters.active, netAvailableProductionSeconds: net, taktTimeSeconds: net / parameters.requiredOutputUnits, errors: [] } : { valid: false, active: parameters.active, netAvailableProductionSeconds: null, taktTimeSeconds: null, errors: ['Net available production time must be greater than zero.'] };
}
