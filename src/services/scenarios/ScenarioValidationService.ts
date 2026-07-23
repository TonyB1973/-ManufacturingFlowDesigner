import type { ManufacturingScenario } from '../../models/scenarios/ManufacturingScenario';
import type { ProjectSettings } from '../../models/project/ProjectDocument';
import type { AvailabilityCalendar } from '../../models/availability/AvailabilityModels';

export interface ScenarioValidationIssue {
  readonly scenarioId: string;
  readonly severity: 'error' | 'warning';
  readonly code: string;
  readonly entityId: string;
  readonly message: string;
}
export interface ScenarioHealthSummary {
  readonly scenarioId: string;
  readonly errors: number;
  readonly warnings: number;
  readonly issues: readonly ScenarioValidationIssue[];
}

export function validateScenario(
  scenario: ManufacturingScenario,
  calendars: readonly AvailabilityCalendar[],
  settings: ProjectSettings,
): ScenarioHealthSummary {
  const issues: ScenarioValidationIssue[] = []; const state = scenario.state;
  const resourceIds = new Set(state.resources.map((item) => item.id)); const operationIds = new Set(state.operations.map((item) => item.id));
  const studyIds = new Set(state.standardWorkStudies.map((item) => item.id)); const operatorIds = new Set(state.standardWorkOperators.map((item) => item.id));
  const entryIds = new Set(state.standardWorkEntries.map((item) => item.id)); const calendarIds = new Set(calendars.map((item) => item.id));
  const add = (severity: ScenarioValidationIssue['severity'], code: string, entityId: string, message: string): void => { issues.push({ scenarioId: scenario.id, severity, code, entityId, message }); };
  for (const operation of state.operations) {
    if (operation.assignedResourceId && !resourceIds.has(operation.assignedResourceId)) add('error', 'missing-resource', operation.id, `Operation ${operation.id} references missing resource ${operation.assignedResourceId}.`);
    if (!operation.assignedResourceId) add('warning', 'unassigned-operation', operation.id, `Operation ${operation.id} is not assigned to a physical resource.`);
    if (operation.cycleTimeSeconds === 0) add('warning', 'zero-cycle-time', operation.id, `Operation ${operation.id} has zero cycle time.`);
  }
  for (const connection of state.connections) if (!operationIds.has(connection.sourceOperationId) || !operationIds.has(connection.targetOperationId)) add('error', 'missing-operation', connection.id, `Connection ${connection.id} references a missing operation.`);
  for (const entry of state.standardWorkEntries) if (!studyIds.has(entry.studyId) || !operationIds.has(entry.operationId) || !operatorIds.has(entry.assignedOperatorId)) add('error', 'broken-standard-work-reference', entry.id, `Standard Work entry ${entry.id} has a missing scenario-scoped reference.`);
  for (const handover of state.standardWorkHandovers) if (!entryIds.has(handover.fromEntryId) || !entryIds.has(handover.toEntryId)) add('error', 'broken-handover', handover.id, `Standard Work handover ${handover.id} references a missing entry.`);
  for (const resource of state.resources) if (resource.availabilityCalendarId && !calendarIds.has(resource.availabilityCalendarId)) add('error', 'missing-calendar', resource.id, `Resource ${resource.id} references missing availability calendar ${resource.availabilityCalendarId}.`);
  for (const operator of state.standardWorkOperators) if (operator.availabilityCalendarId && !calendarIds.has(operator.availabilityCalendarId)) add('error', 'missing-calendar', operator.id, `Operator ${operator.id} references missing availability calendar ${operator.availabilityCalendarId}.`);
  if (settings.defaultAvailabilityCalendarId && !calendarIds.has(settings.defaultAvailabilityCalendarId)) add('error', 'missing-project-calendar', scenario.id, `Project default availability calendar ${settings.defaultAvailabilityCalendarId} is missing.`);
  return { scenarioId: scenario.id, errors: issues.filter((item) => item.severity === 'error').length, warnings: issues.filter((item) => item.severity === 'warning').length, issues };
}

export function validateScenarioCollection(scenarios: readonly ManufacturingScenario[], activeScenarioId: string): readonly ScenarioValidationIssue[] {
  const issues: ScenarioValidationIssue[] = [];
  if (scenarios.filter((item) => item.isBaseline).length !== 1) issues.push({ scenarioId: '', severity: 'error', code: 'baseline-count', entityId: '', message: 'Exactly one baseline scenario is required.' });
  if (!scenarios.some((item) => item.id === activeScenarioId)) issues.push({ scenarioId: activeScenarioId, severity: 'error', code: 'missing-active-scenario', entityId: activeScenarioId, message: 'The active scenario does not exist.' });
  const ids = new Set<string>(); for (const scenario of scenarios) { if (ids.has(scenario.id)) issues.push({ scenarioId: scenario.id, severity: 'error', code: 'duplicate-scenario-id', entityId: scenario.id, message: `Duplicate scenario ID ${scenario.id}.` }); ids.add(scenario.id); }
  return issues;
}
