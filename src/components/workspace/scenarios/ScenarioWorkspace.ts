import type { ProjectSessionService } from '../../../services/project/ProjectSessionService';
import type { ScenarioCommandFactory } from '../../../services/history/ScenarioCommandFactory';
import type { ScenarioSelectionStore } from '../../../services/scenarios/ScenarioSelectionStore';
import type { WorkspaceStore } from '../../../services/WorkspaceStore';
import type { SelectionController, SelectionItem } from '../../../models/selection/Selection';
import type { StandardWorkSelectionKind } from '../../../services/standardWork/StandardWorkSelectionStore';
import type { StandardWorkSelectionStore } from '../../../services/standardWork/StandardWorkSelectionStore';
import type { ScenarioEntityType } from '../../../models/scenarios/ScenarioComparison';
import { ScenarioEntityComparisonService } from '../../../services/scenarios/ScenarioEntityComparisonService';
import { validateScenario } from '../../../services/scenarios/ScenarioValidationService';
import { actionButton, element } from '../../../ui/dom';

export interface ScenarioWorkspaceController { readonly element: HTMLElement; dispose(): void; }

export function createScenarioWorkspace(
  project: ProjectSessionService,
  commands: ScenarioCommandFactory,
  selection: ScenarioSelectionStore,
  workspaces: WorkspaceStore,
  entitySelection: SelectionController,
  standardWorkSelection: StandardWorkSelectionStore,
  report: (message: string) => void,
): ScenarioWorkspaceController {
  const root = element('section', 'scenario-workspace'); root.hidden = true; root.tabIndex = 0; root.setAttribute('aria-label', 'Scenario manager');
  const navigator = element('aside', 'scenario-navigator'); const centre = element('main', 'scenario-comparison'); const properties = element('aside', 'scenario-properties');
  const actions = element('div', 'scenario-actions'); const list = element('div', 'scenario-list'); navigator.append(element('h2', undefined, 'Scenarios'), actions, list);
  root.append(navigator, centre, properties);
  const comparisonService = new ScenarioEntityComparisonService();
  let comparisonStudyId: string | null = null;
  const add = (label: string, action: () => void): HTMLButtonElement => { const button = actionButton(label); button.addEventListener('click', action); actions.append(button); return button; };
  add('New from Baseline', () => { const value = commands.newFromBaseline(); if (value) { selection.select(value.id); report(`${value.name} created from baseline`); } render(); });
  add('Duplicate Current', () => { const value = commands.duplicateCurrent(); if (value) { selection.select(value.id); report(`${value.name} duplicated`); } render(); });

  const selectedScenario = () => {
    const id = selection.get(); return id ? project.getScenario(id) : project.getActiveScenario();
  };
  const render = (): void => {
    const scenarios = project.getScenarios(); if (!selection.get() || !scenarios.some((item) => item.id === selection.get())) selection.select(project.getActiveScenarioId());
    renderList(); renderComparison(); renderProperties();
  };
  const renderList = (): void => {
    list.replaceChildren();
    for (const item of project.getScenarioSummaries()) {
      const health = validateScenario(project.getScenario(item.id)!, project.availability.getCalendars(), project.getSettings());
      const badges = [item.isBaseline ? 'Baseline' : '', item.active ? 'Active' : '', item.locked ? 'Locked' : '', health.errors ? `${health.errors} errors` : health.warnings ? `${health.warnings} warnings` : 'Healthy'].filter(Boolean).join(' · ');
      const button = actionButton(`${item.name}\n${item.id} · ${badges}`, `scenario-list-item${selection.get() === item.id ? ' scenario-list-item--selected' : ''}`);
      button.setAttribute('aria-label', `${item.name}, ${item.id}, ${badges}`); button.addEventListener('click', () => { selection.select(item.id); render(); });
      button.addEventListener('dblclick', () => activate(item.id)); list.append(button);
    }
  };
  const renderComparison = (): void => {
    centre.replaceChildren(element('h2', undefined, 'Baseline Comparison'));
    const baseline = project.getBaselineScenario(); const selected = selectedScenario();
    if (!selected || selected.id === baseline.id) { centre.append(element('p', 'scenario-empty', 'Select an alternative scenario to compare it with the baseline.')); return; }
    const comparisonStudies = baseline.state.standardWorkStudies.filter((study) => selected.state.standardWorkStudies.some((candidate) => candidate.id === study.id));
    if (!comparisonStudies.some((study) => study.id === comparisonStudyId)) comparisonStudyId = comparisonStudies[0]?.id ?? null;
    const comparison = comparisonService.compare(baseline, selected, project.getScenarioRevision(baseline.id), project.getScenarioRevision(selected.id), { availability: project.availability, settings: project.getSettings(), studyId: comparisonStudyId });
    const heading = element('div', 'scenario-comparison-heading'); heading.append(element('strong', undefined, `${baseline.name} (${baseline.id}) → ${selected.name} (${selected.id})`), element('span', undefined, `${comparison.addedCount} added · ${comparison.removedCount} removed · ${comparison.modifiedCount} modified · ${comparison.unchangedCount} unchanged`), element('small', undefined, `Baseline created ${baseline.createdUtc} · Alternative created ${selected.createdUtc} · modified ${selected.modifiedUtc}`)); centre.append(heading);
    const studyField = element('label', 'scenario-comparison-study'); studyField.append(element('span', undefined, 'Standard Work study'));
    const studySelect = element('select'); const noStudy = element('option', undefined, comparisonStudies.length ? 'Select a shared study' : 'No shared study available'); noStudy.value = ''; studySelect.append(noStudy);
    for (const study of comparisonStudies) { const option = element('option', undefined, `${study.name} (${study.id})`); option.value = study.id; studySelect.append(option); }
    studySelect.value = comparisonStudyId ?? ''; studySelect.disabled = comparisonStudies.length === 0;
    studySelect.addEventListener('change', () => { comparisonStudyId = studySelect.value || null; renderComparison(); });
    studyField.append(studySelect); centre.append(studyField);
    const metricTable = element('table', 'scenario-table'); const metricHead = element('tr'); ['Metric', 'Baseline', 'Alternative', 'Delta', 'Direction'].forEach((value) => metricHead.append(element('th', undefined, value))); const metricBody = element('tbody');
    for (const metric of comparison.metrics) { const row = element('tr'); row.append(element('td', undefined, metric.label), element('td', undefined, format(metric.baseline, metric.unit)), element('td', undefined, format(metric.alternative, metric.unit)), element('td', undefined, metric.delta === null ? 'Not available' : `${metric.delta > 0 ? '+' : ''}${format(metric.delta, metric.unit)}${metric.percentageDelta === null ? '' : ` (${metric.percentageDelta > 0 ? '+' : ''}${metric.percentageDelta.toFixed(1)}%)`}`), element('td', `scenario-delta scenario-delta--${metric.status}`, metric.status === 'notAvailable' ? 'Not available' : metric.status)); metricBody.append(row); }
    const metricThead = element('thead'); metricThead.append(metricHead); metricTable.append(metricThead, metricBody); centre.append(element('h3', undefined, 'Engineering metric deltas'), metricTable);
    const changes = element('div', 'scenario-changes'); changes.append(element('h3', undefined, 'Entity changes'));
    if (!comparison.changes.length) changes.append(element('p', 'scenario-empty', 'No scenario-specific entity differences.'));
    for (const change of comparison.changes) {
      const row = element('div', `scenario-change scenario-change--${change.status}`);
      row.append(element('span', undefined, `${change.status.toUpperCase()} · ${change.entityType} · ${change.entityId}${change.changedFields.length ? ` · ${change.changedFields.join(', ')}` : ''}`));
      const locateActions = element('span', 'scenario-change-actions');
      if (change.status !== 'added') { const locateBaseline = actionButton('Locate baseline'); locateBaseline.addEventListener('click', () => locate(baseline.id, change.entityType, change.entityId)); locateActions.append(locateBaseline); }
      if (change.status !== 'removed') { const locateAlternative = actionButton('Locate alternative'); locateAlternative.addEventListener('click', () => locate(selected.id, change.entityType, change.entityId)); locateActions.append(locateAlternative); }
      row.append(locateActions); changes.append(row);
    }
    centre.append(changes);
    for (const diagnostic of comparison.diagnostics) centre.append(element('p', 'scenario-diagnostic', diagnostic));
  };
  const renderProperties = (): void => {
    properties.replaceChildren(element('h2', undefined, 'Scenario Properties')); const item = selectedScenario(); if (!item) return;
    const health = validateScenario(item, project.availability.getCalendars(), project.getSettings());
    properties.append(readonly('Scenario ID', item.id), textField('Name', item.name, (value) => commands.update(item.id, { name: value }, `Rename scenario ${item.id}`)), textField('Description', item.description, (value) => commands.update(item.id, { description: value }, `Edit scenario description ${item.id}`), true), readonly('Baseline', item.isBaseline ? 'Yes' : 'No'), readonly('Locked', item.locked ? 'Yes' : 'No'), readonly('Active', item.id === project.getActiveScenarioId() ? 'Yes' : 'No'), readonly('Source scenario', sourceLabel(item.sourceScenarioId)), readonly('Created UTC', item.createdUtc), readonly('Modified UTC', item.modifiedUtc), readonly('Resources', String(item.state.resources.length)), readonly('Operations', String(item.state.operations.length)), readonly('Standard Work studies', String(item.state.standardWorkStudies.length)), readonly('Operators', String(item.state.standardWorkOperators.length)), readonly('Health', health.errors ? `${health.errors} errors` : health.warnings ? `${health.warnings} warnings` : 'Healthy'));
    const buttons = element('div', 'scenario-property-actions');
    const activateButton = actionButton('Activate'); activateButton.disabled = item.id === project.getActiveScenarioId(); activateButton.addEventListener('click', () => activate(item.id));
    const duplicateButton = actionButton('Duplicate'); duplicateButton.addEventListener('click', () => { if (item.id !== project.getActiveScenarioId()) project.activateScenario(item.id); const created = commands.duplicateCurrent(); if (created) selection.select(created.id); render(); });
    const lockButton = actionButton(item.locked ? 'Unlock' : 'Lock'); lockButton.addEventListener('click', () => { commands.update(item.id, { locked: !item.locked }, `${item.locked ? 'Unlock' : 'Lock'} scenario ${item.id}`); render(); });
    const baselineButton = actionButton('Set as Baseline'); baselineButton.disabled = item.isBaseline; baselineButton.addEventListener('click', () => { if (confirm(`Set ${item.name} as the baseline comparison reference? No scenario data will be copied or overwritten.`)) commands.setBaseline(item.id); render(); });
    const deleteButton = actionButton('Delete'); deleteButton.disabled = item.isBaseline || project.getScenarios().length <= 1; deleteButton.addEventListener('click', () => {
      const descendants = project.getScenarios().filter((candidate) => candidate.sourceScenarioId === item.id).length;
      const counts = `${item.state.operations.length} operations, ${item.state.resources.length} resources, ${item.state.standardWorkStudies.length} Standard Work studies`;
      if (confirm(`Delete ${item.name} (${item.id})?\n${counts}\n${item.id === project.getActiveScenarioId() ? 'This scenario is active. ' : ''}${descendants} descendant scenario(s) retain historical lineage.`)) { commands.delete(item.id); selection.select(project.getActiveScenarioId()); render(); }
    });
    buttons.append(activateButton, duplicateButton, lockButton, baselineButton, deleteButton); properties.append(buttons);
    for (const issue of health.issues.slice(0, 12)) properties.append(element('p', `scenario-health scenario-health--${issue.severity}`, `${issue.severity.toUpperCase()}: ${issue.message}`));
  };
  const activate = (id: string): void => { if (!project.activateScenario(id)) return; selection.select(id); workspaces.activate('scenarios'); report(`${project.getActiveScenario().name} activated`); render(); };
  const locate = (scenarioId: string, entityType: ScenarioEntityType, entityId: string): void => {
    if (!project.activateScenario(scenarioId)) return;
    selection.select(scenarioId);
    const canvas = canvasSelection(entityType, entityId);
    if (canvas) {
      workspaces.activate(canvas.workspace); entitySelection.setWorkspace(canvas.workspace); entitySelection.select(canvas.selection);
    } else {
      const kind = standardWorkKind(entityType); if (!kind) return;
      workspaces.activate('standardWork'); standardWorkSelection.select({ kind, id: entityId });
    }
    report(`Located ${entityId} in ${project.getActiveScenario().name}`);
  };
  const sourceLabel = (id: string | null): string => id === null ? 'Migrated baseline' : project.getScenario(id) ? `${id} — ${project.getScenario(id)!.name}` : `${id} — Source scenario no longer exists`;
  const handleKey = (event: KeyboardEvent): void => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    if (event.key === 'Enter' && selection.get()) { event.preventDefault(); activate(selection.get()!); }
    else if (event.key === 'Delete' && selection.get()) { const item = project.getScenario(selection.get()!); if (item && !item.isBaseline && confirm(`Delete ${item.name}?`)) { commands.delete(item.id); selection.select(project.getActiveScenarioId()); render(); } }
    else if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'n') { event.preventDefault(); const item = commands.newFromBaseline(); if (item) selection.select(item.id); render(); }
    else if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'd') { event.preventDefault(); const item = commands.duplicateCurrent(); if (item) selection.select(item.id); render(); }
  };
  root.addEventListener('keydown', handleKey); const unsubscribers = [project.subscribe(render), selection.subscribe(render)]; selection.select(project.getActiveScenarioId()); render();
  return { element: root, dispose: () => { root.removeEventListener('keydown', handleKey); unsubscribers.forEach((unsubscribe) => unsubscribe()); } };
}

function canvasSelection(entityType: ScenarioEntityType, id: string): { readonly workspace: 'processFlow' | 'factoryLayout'; readonly selection: SelectionItem } | null {
  if (entityType === 'operations') return { workspace: 'processFlow', selection: { kind: 'operation', id } };
  if (entityType === 'connections') return { workspace: 'processFlow', selection: { kind: 'connection', id } };
  if (entityType === 'resources') return { workspace: 'factoryLayout', selection: { kind: 'resource', id } };
  const factoryKinds: Partial<Record<ScenarioEntityType, SelectionItem['kind']>> = { layoutBoundaries: 'boundary', walls: 'wall', areas: 'area', aisles: 'aisle', factoryRoutes: 'factoryRoute', factoryAnnotations: 'factoryAnnotation' };
  const kind = factoryKinds[entityType]; return kind ? { workspace: 'factoryLayout', selection: { kind, id } as SelectionItem } : null;
}

function standardWorkKind(entityType: ScenarioEntityType): StandardWorkSelectionKind | null {
  const kinds: Partial<Record<ScenarioEntityType, StandardWorkSelectionKind>> = {
    standardWorkStudies: 'standardWorkStudy', standardWorkPlanning: 'standardWorkPlanning', standardWorkOperators: 'standardWorkOperator',
    standardWorkEntries: 'standardWorkEntry', standardWorkHandovers: 'standardWorkHandover',
  };
  return kinds[entityType] ?? null;
}

function format(value: number | null, unit: string): string { return value === null ? 'Not available' : `${Number.isInteger(value) ? value : value.toFixed(2)}${unit === 'count' ? '' : ` ${unit}`}`; }
function readonly(label: string, value: string): HTMLElement { const field = element('label', 'scenario-field'); field.append(element('span', undefined, label), element('output', undefined, value)); return field; }
function textField(label: string, value: string, change: (value: string) => boolean, multiline = false): HTMLElement { const field = element('label', 'scenario-field'); const control = multiline ? element('textarea') : element('input'); control.value = value; control.addEventListener('change', () => { if (!change(control.value)) control.value = value; }); field.append(element('span', undefined, label), control); return field; }
