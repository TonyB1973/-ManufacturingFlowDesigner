import { TIMING_CATEGORIES } from '../../core/constants/operationTemplates';
import { reportStatus } from '../../core/events/uiEvents';
import type { OperationInstance, OperationInstancePatch } from '../../models/operations/OperationInstance';
import type { OperationType } from '../../models/operations/OperationTemplate';
import type { PlacedResource, PlacedResourcePatch } from '../../models/resources/PlacedResource';
import type { SelectionController } from '../../models/selection/Selection';
import { MIN_OPERATION_HEIGHT, MIN_OPERATION_WIDTH, type OperationStore } from '../../services/OperationStore';
import { validateOperations } from '../../services/OperationValidation';
import { MIN_RESOURCE_HEIGHT, MIN_RESOURCE_WIDTH, type ResourceStore } from '../../services/ResourceStore';
import { element } from '../../ui/dom';

export interface RightSidebarController { readonly element: HTMLElement; dispose(): void; }

function section(title: string, content: HTMLElement, open = true): HTMLDetailsElement {
  const details = element('details', 'inspector-section'); details.open = open; details.append(element('summary', '', title), content); return details;
}
function field(labelText: string, control: HTMLElement): HTMLLabelElement {
  const label = element('label', 'property-field'); label.append(element('span', '', labelText), control); return label;
}
function input(type: 'text' | 'number', minimum?: number): HTMLInputElement {
  const control = element('input', 'property-input'); control.type = type;
  if (type === 'number') control.step = '1'; if (minimum !== undefined) control.min = String(minimum); return control;
}
function checkbox(label: string): HTMLInputElement { const control = element('input', 'property-checkbox'); control.type = 'checkbox'; control.setAttribute('aria-label', label); return control; }
function summaryRow(container: HTMLElement, label: string, value: string): void { container.append(element('span', '', label), element('strong', '', value)); }
function option(value: string): HTMLOptionElement { const node = element('option', '', value); node.value = value; return node; }

export function createRightSidebar(resourceStore: ResourceStore, operationStore: OperationStore, selectionStore: SelectionController): RightSidebarController {
  const sidebar = element('aside', 'sidebar sidebar--right'); sidebar.setAttribute('aria-label', 'Inspector panels');
  const properties = element('div', 'properties-content'); const summary = element('div', 'summary-grid'); const validation = element('div', 'validation-summary');
  sidebar.append(section('Properties', properties), section('Selection Summary', summary), section('Validation Summary', validation));

  const updateResource = (patch: PlacedResourcePatch, label: string): void => {
    const resource = resourceStore.getSelectedResource(); if (!resource) return;
    reportStatus(resourceStore.updateResource(resource.id, patch) ? `${label} updated` : `Invalid ${label.toLocaleLowerCase()} value`);
  };
  const updateOperation = (patch: OperationInstancePatch, label: string): void => {
    const operation = operationStore.getSelectedOperation(); if (!operation) return;
    reportStatus(operationStore.updateOperation(operation.id, patch) ? `${label} updated` : `Invalid ${label.toLocaleLowerCase()} value`);
  };
  const bindNumber = (control: HTMLInputElement, commit: (value: number) => boolean, minimum: number, integer = false): void => {
    const run = (): void => {
      const value = Number(control.value); const valid = Number.isFinite(value) && value >= minimum && (!integer || Number.isInteger(value));
      control.setAttribute('aria-invalid', String(!valid)); if (valid && !commit(value)) control.setAttribute('aria-invalid', 'true');
    };
    control.addEventListener('change', run); control.addEventListener('blur', run); control.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); run(); } });
  };
  const toggle = (labelText: string, control: HTMLInputElement): HTMLLabelElement => { const label = element('label', 'property-toggle'); label.append(control, element('span', '', labelText)); return label; };

  const renderResource = (resource: PlacedResource): void => {
    const form = element('form', 'properties-form'); form.addEventListener('submit', (event) => event.preventDefault());
    const name = input('text'); name.value = resource.name;
    const commitName = () => updateResource({ name: name.value.trim() }, 'Resource name'); name.addEventListener('change', commitName); name.addEventListener('blur', commitName); name.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); commitName(); } });
    const type = element('output', 'property-output', resource.resourceType);
    const x = input('number'); x.value = String(resource.worldX); bindNumber(x, (value) => resourceStore.updateResource(resource.id, { worldX: value }), Number.NEGATIVE_INFINITY);
    const y = input('number'); y.value = String(resource.worldY); bindNumber(y, (value) => resourceStore.updateResource(resource.id, { worldY: value }), Number.NEGATIVE_INFINITY);
    const width = input('number', MIN_RESOURCE_WIDTH); width.value = String(resource.width); bindNumber(width, (value) => resourceStore.updateResource(resource.id, { width: value }), MIN_RESOURCE_WIDTH);
    const height = input('number', MIN_RESOURCE_HEIGHT); height.value = String(resource.height); bindNumber(height, (value) => resourceStore.updateResource(resource.id, { height: value }), MIN_RESOURCE_HEIGHT);
    x.disabled = resource.locked; y.disabled = resource.locked;
    const locked = checkbox('Locked'); locked.checked = resource.locked; locked.addEventListener('change', () => updateResource({ locked: locked.checked }, 'Lock state'));
    const visible = checkbox('Visible'); visible.checked = resource.visible; visible.addEventListener('change', () => updateResource({ visible: visible.checked }, 'Visibility'));
    const toggles = element('div', 'property-toggles'); toggles.append(toggle('Locked', locked), toggle('Visible', visible));
    form.append(field('Resource name', name), field('Resource type', type), field('X position', x), field('Y position', y), field('Width', width), field('Height', height), toggles);
    properties.replaceChildren(form);
  };

  const renderOperation = (operation: OperationInstance): void => {
    const form = element('form', 'properties-form operation-properties'); form.addEventListener('submit', (event) => event.preventDefault());
    const name = input('text'); name.value = operation.name;
    const commitName = () => updateOperation({ name: name.value.trim() }, 'Operation name'); name.addEventListener('change', commitName); name.addEventListener('blur', commitName); name.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); commitName(); } });
    const type = element('select', 'property-input');
    const types = [...new Set(operationStore.getTemplates().map((template) => template.operationType))]; types.forEach((value) => type.append(option(value))); type.value = operation.operationType;
    type.addEventListener('change', () => updateOperation({ operationType: type.value as OperationType }, 'Operation type'));
    const timing = element('select', 'property-input'); TIMING_CATEGORIES.forEach((value) => timing.append(option(value))); timing.value = operation.timingCategory;
    timing.addEventListener('change', () => updateOperation({ timingCategory: timing.value as OperationInstance['timingCategory'] }, 'Timing category'));
    const cycle = input('number', 0.001); cycle.step = '0.001'; cycle.value = String(operation.cycleTimeSeconds); bindNumber(cycle, (value) => operationStore.updateOperation(operation.id, { cycleTimeSeconds: value }), 0.001);
    const sequence = input('number', 1); sequence.value = String(operation.sequence); bindNumber(sequence, (value) => operationStore.updateOperation(operation.id, { sequence: value }), 1, true);
    const assignment = element('select', 'property-input'); const unassigned = option('Unassigned'); unassigned.value = ''; assignment.append(unassigned);
    resourceStore.getPlacedResources().forEach((resource) => { const item = option(`${resource.name} (${resource.id})`); item.value = resource.id; assignment.append(item); });
    assignment.value = operation.assignedResourceId ?? ''; assignment.addEventListener('change', () => updateOperation({ assignedResourceId: assignment.value || null }, 'Resource assignment'));
    const notes = element('textarea', 'property-input property-textarea'); notes.value = operation.notes; notes.rows = 3; notes.addEventListener('change', () => updateOperation({ notes: notes.value }, 'Notes'));
    const x = input('number'); x.value = String(operation.worldX); bindNumber(x, (value) => operationStore.updateOperation(operation.id, { worldX: value }), Number.NEGATIVE_INFINITY);
    const y = input('number'); y.value = String(operation.worldY); bindNumber(y, (value) => operationStore.updateOperation(operation.id, { worldY: value }), Number.NEGATIVE_INFINITY);
    const width = input('number', MIN_OPERATION_WIDTH); width.value = String(operation.width); bindNumber(width, (value) => operationStore.updateOperation(operation.id, { width: value }), MIN_OPERATION_WIDTH);
    const height = input('number', MIN_OPERATION_HEIGHT); height.value = String(operation.height); bindNumber(height, (value) => operationStore.updateOperation(operation.id, { height: value }), MIN_OPERATION_HEIGHT);
    x.disabled = operation.locked; y.disabled = operation.locked;
    const locked = checkbox('Locked'); locked.checked = operation.locked; locked.addEventListener('change', () => updateOperation({ locked: locked.checked }, 'Lock state'));
    const visible = checkbox('Visible'); visible.checked = operation.visible; visible.addEventListener('change', () => updateOperation({ visible: visible.checked }, 'Visibility'));
    const toggles = element('div', 'property-toggles'); toggles.append(toggle('Locked', locked), toggle('Visible', visible));
    form.append(field('Operation name', name), field('Operation type', type), field('Timing category', timing), field('Cycle time (seconds)', cycle), field('Sequence', sequence), field('Assigned resource', assignment), field('Notes', notes), field('X position', x), field('Y position', y), field('Width', width), field('Height', height), toggles);
    properties.replaceChildren(form);
  };

  const render = (): void => {
    const selected = selectionStore.getSelection(); const resource = resourceStore.getSelectedResource(); const operation = operationStore.getSelectedOperation();
    if (selected.kind === 'resource' && resource) renderResource(resource);
    else if (selected.kind === 'operation' && operation) renderOperation(operation);
    else { const empty = element('div', 'empty-inspector'); empty.append(element('strong', '', 'No selection'), element('p', '', 'Select a resource or operation to edit its properties.')); properties.replaceChildren(empty); }
    summary.replaceChildren();
    if (resource) { summaryRow(summary, 'Object type', 'Resource'); summaryRow(summary, 'ID', resource.id); summaryRow(summary, 'Name', resource.name); summaryRow(summary, 'Position', `${resource.worldX.toFixed(1)}, ${resource.worldY.toFixed(1)}`); }
    else if (operation) { summaryRow(summary, 'Object type', 'Operation'); summaryRow(summary, 'ID', operation.id); summaryRow(summary, 'Sequence', `OP ${operation.sequence}`); summaryRow(summary, 'Cycle time', `${operation.cycleTimeSeconds}s`); summaryRow(summary, 'Resource', operation.assignedResourceId ? resourceStore.getResource(operation.assignedResourceId)?.name ?? 'Missing' : 'Unassigned'); }
    else { summaryRow(summary, 'Selected items', '0'); summaryRow(summary, 'Object type', '—'); }
    const result = validateOperations(operationStore.getOperations(), (id) => Boolean(resourceStore.getResource(id)));
    validation.replaceChildren(element('div', result.healthy ? 'validation-healthy' : result.errors ? 'validation-error' : 'validation-warning', result.healthy ? '● Project healthy' : `● ${result.errors ? 'Project has errors' : 'Review warnings'}`));
    const metrics = element('div', 'validation-metrics'); metrics.append(element('span', '', `${result.errors} Errors`), element('span', '', `${result.warnings} Warnings`)); validation.append(metrics);
    if (operation) {
      const issues = result.issues.filter((issue) => issue.operationId === operation.id);
      if (issues.length) { const list = element('ul', 'validation-issues'); issues.forEach((issue) => list.append(element('li', `validation-issue validation-issue--${issue.severity}`, issue.message))); validation.append(list); }
    }
  };
  const unsubscribers = [resourceStore.subscribe(render), operationStore.subscribe(render), selectionStore.subscribe(render)]; render();
  return { element: sidebar, dispose: () => unsubscribers.forEach((unsubscribe) => unsubscribe()) };
}
