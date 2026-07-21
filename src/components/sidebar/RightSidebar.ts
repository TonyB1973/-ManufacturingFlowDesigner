import { TIMING_CATEGORIES } from '../../core/constants/operationTemplates';
import { revealConnection } from '../../core/events/connectionEvents';
import { revealOperation } from '../../core/events/operationEvents';
import { revealResource } from '../../core/events/resourceEvents';
import { reportStatus } from '../../core/events/uiEvents';
import type { ConnectionType, ProcessConnection } from '../../models/connections/ProcessConnection';
import type { OperationInstance } from '../../models/operations/OperationInstance';
import type { OperationType } from '../../models/operations/OperationTemplate';
import type { SelectionController } from '../../models/selection/Selection';
import type { ConnectionStore } from '../../services/ConnectionStore';
import { validateProcessConnections } from '../../services/ConnectionValidation';
import { MIN_OPERATION_HEIGHT, MIN_OPERATION_WIDTH, type OperationStore } from '../../services/OperationStore';
import { validateOperations } from '../../services/OperationValidation';
import { routeBendCount, routeLength } from '../../services/OrthogonalRouter';
import { MIN_RESOURCE_HEIGHT, MIN_RESOURCE_WIDTH, type ResourceStore } from '../../services/ResourceStore';
import { validateResources } from '../../services/ResourceValidation';
import type { WorkspaceStore } from '../../services/WorkspaceStore';
import type { ProjectSessionService } from '../../services/project/ProjectSessionService';
import { actionButton, element } from '../../ui/dom';
import type { CommandFactory } from '../../services/history/CommandFactory';
import type { ApplicationClipboardService } from '../../services/editing/ApplicationClipboardService';

export interface RightSidebarController { readonly element: HTMLElement; dispose(): void; }

function section(title: string, content: HTMLElement): HTMLDetailsElement { const details = element('details', 'inspector-section'); details.open = true; details.append(element('summary', '', title), content); return details; }
function field(labelText: string, control: HTMLElement): HTMLLabelElement { const label = element('label', 'property-field'); label.append(element('span', '', labelText), control); return label; }
function input(type: 'text' | 'number', step = '1', minimum?: number): HTMLInputElement { const control = element('input', 'property-input'); control.type = type; if (type === 'number') control.step = step; if (minimum !== undefined) control.min = String(minimum); return control; }
function output(value: string): HTMLOutputElement { return element('output', 'property-output', value); }
function option(label: string, value = label): HTMLOptionElement { const node = element('option', '', label); node.value = value; return node; }
function checkbox(label: string): HTMLInputElement { const node = element('input', 'property-checkbox'); node.type = 'checkbox'; node.setAttribute('aria-label', label); return node; }
function toggle(labelText: string, control: HTMLInputElement): HTMLLabelElement { const label = element('label', 'property-toggle'); label.append(control, element('span', '', labelText)); return label; }
function summaryRow(container: HTMLElement, label: string, value: string): void { container.append(element('span', '', label), element('strong', '', value)); }

interface ValidationListEntry {
  readonly severity: 'error' | 'warning';
  readonly location: string;
  readonly message: string;
  readonly navigate: () => void;
}

export function createRightSidebar(resources: ResourceStore, operations: OperationStore, connections: ConnectionStore, workspaces: WorkspaceStore, selection: SelectionController, requestDelete: (resourceId: string) => void, project: ProjectSessionService, commands: CommandFactory, editing: ApplicationClipboardService): RightSidebarController {
  const sidebar = element('aside', 'sidebar sidebar--right'); sidebar.setAttribute('aria-label', 'Inspector panels');
  const properties = element('div', 'properties-content'); const summary = element('div', 'summary-grid'); const validation = element('div', 'validation-summary');
  sidebar.append(section('Validation Issues', validation), section('Properties', properties), section('Selection Summary', summary));
  const bindNumber = (control: HTMLInputElement, commit: (value: number) => boolean, minimum: number, integer = false): void => { let committed = Number(control.value); const run = (): void => { const value = Number(control.value); const valid = control.value.trim() !== '' && Number.isFinite(value) && value >= minimum && (!integer || Number.isInteger(value)); const accepted = valid && (Object.is(value, committed) || commit(value)); if (accepted) committed = value; control.setAttribute('aria-invalid', String(!accepted)); }; control.addEventListener('change', run); control.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); run(); } }); };
  const bindText = (control: HTMLInputElement, commit: (value: string) => boolean): void => { let committed = control.value.trim(); const run = (): void => { const value = control.value.trim(); const accepted = value === committed || commit(value); if (accepted) committed = value; control.setAttribute('aria-invalid', String(!accepted)); }; control.addEventListener('change', run); control.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); run(); } }); };

  const renderResource = (): void => {
    const resource = resources.getSelectedResource(); if (!resource) return;
    const form = element('form', 'properties-form resource-instance-properties'); form.addEventListener('submit', (event) => event.preventDefault());
    const name = input('text'); name.value = resource.name; bindText(name, (value) => commands.updateResource(resource.id, { name: value }));
    const x = input('number'); x.value = String(resource.worldX); bindNumber(x, (value) => commands.updateResource(resource.id, { worldX: value }), Number.NEGATIVE_INFINITY);
    const y = input('number'); y.value = String(resource.worldY); bindNumber(y, (value) => commands.updateResource(resource.id, { worldY: value }), Number.NEGATIVE_INFINITY);
    const width = input('number', '5', MIN_RESOURCE_WIDTH); width.value = String(resource.width); bindNumber(width, (value) => commands.updateResource(resource.id, { width: value }), MIN_RESOURCE_WIDTH);
    const height = input('number', '5', MIN_RESOURCE_HEIGHT); height.value = String(resource.height); bindNumber(height, (value) => commands.updateResource(resource.id, { height: value }), MIN_RESOURCE_HEIGHT);
    const rotation = input('number', '5'); rotation.value = String(resource.rotationDegrees); bindNumber(rotation, (value) => commands.updateResource(resource.id, { rotationDegrees: value }), Number.NEGATIVE_INFINITY);
    const capacity = input('number', '1', 1); capacity.value = String(resource.capacity); bindNumber(capacity, (value) => commands.updateResource(resource.id, { capacity: value }), 1, true); x.disabled = resource.locked; y.disabled = resource.locked;
    const active = checkbox('Active'); active.checked = resource.active; active.addEventListener('change', () => commands.updateResource(resource.id, { active: active.checked })); const visible = checkbox('Visible'); visible.checked = resource.visible; visible.addEventListener('change', () => commands.updateResource(resource.id, { visible: visible.checked })); const locked = checkbox('Locked'); locked.checked = resource.locked; locked.addEventListener('change', () => commands.updateResource(resource.id, { locked: locked.checked })); const toggles = element('div', 'property-toggles'); toggles.append(toggle('Active', active), toggle('Visible', visible), toggle('Locked', locked));
    const help = element('p', 'property-help', 'For additional machinery capacity, normally add another physical resource instance instead of increasing capacity.'); const actions = element('div', 'resource-property-actions'); const duplicate = actionButton('Duplicate Resource', 'secondary-button'); duplicate.setAttribute('aria-label', 'Duplicate selected physical resource'); duplicate.addEventListener('click', () => { const copy = commands.duplicateResource(resource.id); reportStatus(copy ? `Resource duplicated: ${copy.id}` : 'Resource could not be duplicated'); }); const remove = actionButton('Delete Resource', 'secondary-button resource-delete-button'); remove.addEventListener('click', () => requestDelete(resource.id)); actions.append(duplicate, remove);
    form.append(field('Resource ID', output(resource.id)), field('Template ID', output(resource.templateId)), field('Name', name), field('Resource type', output(resource.resourceType)), field('X position', x), field('Y position', y), field('Width', width), field('Depth / height', height), field('Rotation (degrees)', rotation), field('Capacity', capacity), field('Assigned operations', output(String(operations.getAssignmentCount(resource.id)))), toggles, help, actions); properties.replaceChildren(form);
  };

  const renderOperation = (): void => {
    const operation = operations.getSelectedOperation(); if (!operation) return;
    const form = element('form', 'properties-form operation-properties'); form.addEventListener('submit', (event) => event.preventDefault()); const name = input('text'); name.value = operation.name; bindText(name, (value) => commands.updateOperation(operation.id, { name: value }));
    const type = element('select', 'property-input'); [...new Set(operations.getTemplates().map((template) => template.operationType))].forEach((value) => type.append(option(value))); type.value = operation.operationType; type.addEventListener('change', () => commands.updateOperation(operation.id, { operationType: type.value as OperationType }));
    const timing = element('select', 'property-input'); TIMING_CATEGORIES.forEach((value) => timing.append(option(value))); timing.value = operation.timingCategory; timing.addEventListener('change', () => commands.updateOperation(operation.id, { timingCategory: timing.value as OperationInstance['timingCategory'] }));
    const cycle = input('number', '0.001', 0.001); cycle.value = String(operation.cycleTimeSeconds); bindNumber(cycle, (value) => commands.updateOperation(operation.id, { cycleTimeSeconds: value }), 0.001); const sequence = input('number', '1', 1); sequence.value = String(operation.sequence); bindNumber(sequence, (value) => commands.updateOperation(operation.id, { sequence: value }), 1, true);
    const assignment = element('select', 'property-input'); assignment.append(option('Unassigned', '')); for (const resource of resources.getAssignableResources()) assignment.append(option(`${resource.id} — ${resource.name}`, resource.id)); assignment.value = operation.assignedResourceId && resources.getResource(operation.assignedResourceId)?.active ? operation.assignedResourceId : ''; assignment.addEventListener('change', () => { const resource = assignment.value ? resources.getResource(assignment.value) : undefined; if (assignment.value && !resource?.active) { reportStatus('Inactive resource cannot be assigned'); return; } commands.updateOperation(operation.id, { assignedResourceId: assignment.value || null }); reportStatus(assignment.value ? `Operation assigned to ${assignment.value}` : 'Operation unassigned'); });
    const assigned = operation.assignedResourceId ? resources.getResource(operation.assignedResourceId) : undefined; const assignedDetails = output(assigned ? `${assigned.id} — ${assigned.name} — ${assigned.resourceType} — ${assigned.active ? 'Active' : 'Inactive'} — Factory Layout` : 'Unassigned'); const locate = actionButton('Locate in Factory Layout', 'secondary-button'); locate.disabled = !assigned; locate.addEventListener('click', () => { if (!assigned) return; workspaces.activate('factoryLayout'); resources.selectResource(assigned.id); revealResource(assigned.id); reportStatus('Assigned resource located in Factory Layout'); });
    const notes = element('textarea', 'property-input property-textarea'); notes.value = operation.notes; notes.rows = 3; notes.addEventListener('change', () => commands.updateOperation(operation.id, { notes: notes.value }));
    const x = input('number'); x.value = String(operation.worldX); bindNumber(x, (value) => commands.updateOperation(operation.id, { worldX: value }), Number.NEGATIVE_INFINITY); const y = input('number'); y.value = String(operation.worldY); bindNumber(y, (value) => commands.updateOperation(operation.id, { worldY: value }), Number.NEGATIVE_INFINITY); const width = input('number', '5', MIN_OPERATION_WIDTH); width.value = String(operation.width); bindNumber(width, (value) => commands.updateOperation(operation.id, { width: value }), MIN_OPERATION_WIDTH); const height = input('number', '5', MIN_OPERATION_HEIGHT); height.value = String(operation.height); bindNumber(height, (value) => commands.updateOperation(operation.id, { height: value }), MIN_OPERATION_HEIGHT); x.disabled = operation.locked; y.disabled = operation.locked;
    const locked = checkbox('Locked'); locked.checked = operation.locked; locked.addEventListener('change', () => commands.updateOperation(operation.id, { locked: locked.checked })); const visible = checkbox('Visible'); visible.checked = operation.visible; visible.addEventListener('change', () => commands.updateOperation(operation.id, { visible: visible.checked })); const toggles = element('div', 'property-toggles'); toggles.append(toggle('Locked', locked), toggle('Visible', visible));
    form.append(field('Operation name', name), field('Operation type', type), field('Timing category', timing), field('Cycle time (seconds)', cycle), field('Sequence', sequence), field('Assigned Resource', assignment), field('Assigned physical resource', assignedDetails), locate, field('Notes', notes), field('X position', x), field('Y position', y), field('Width', width), field('Height', height), toggles); properties.replaceChildren(form);
  };

  const renderConnection = (connection: ProcessConnection): void => {
    const form = element('form', 'properties-form connection-properties'); form.addEventListener('submit', (event) => event.preventDefault()); const sourceOperation = operations.getOperation(connection.sourceOperationId); const targetOperation = operations.getOperation(connection.targetOperationId);
    const type = element('select', 'property-input'); (['Standard', 'Rework', 'Alternate', 'Information'] as const).forEach((value) => type.append(option(value))); type.value = connection.connectionType; type.addEventListener('change', () => reportStatus(commands.updateConnection(connection.id, { connectionType: type.value as ConnectionType }) ? 'Connection type updated' : 'Duplicate Standard connection not permitted'));
    const label = input('text'); label.maxLength = 120; label.value = connection.label; bindText(label, (value) => commands.updateConnection(connection.id, { label: value }));
    const locked = checkbox('Locked'); locked.checked = connection.locked; locked.addEventListener('change', () => { commands.updateConnection(connection.id, { locked: locked.checked }); reportStatus(`Connection ${locked.checked ? 'locked' : 'unlocked'}`); }); const visible = checkbox('Visible'); visible.checked = connection.visible; visible.addEventListener('change', () => { commands.updateConnection(connection.id, { visible: visible.checked }); reportStatus(`Connection ${visible.checked ? 'shown' : 'hidden'}`); }); const toggles = element('div', 'property-toggles'); toggles.append(toggle('Locked', locked), toggle('Visible', visible));
    const actions = element('div', 'connection-property-actions'); const reverse = actionButton('Reverse Direction', 'secondary-button'); const remove = actionButton('Delete Connection', 'secondary-button connection-delete-button'); reverse.addEventListener('click', () => { const result = commands.reverseConnection(connection.id); reportStatus(result === 'updated' ? 'Connection reversed' : result === 'duplicate' ? 'Cannot reverse: duplicate Standard connection' : result === 'locked' ? 'Connection is locked' : 'Connection not found'); }); remove.addEventListener('click', () => { const result = commands.deleteConnection(connection.id); reportStatus(result === 'deleted' ? 'Connection deleted' : result === 'locked' ? 'Connection is locked' : 'Connection not found'); }); actions.append(reverse, remove);
    form.append(field('Connection ID', output(connection.id)), field('Source operation', output(sourceOperation ? `OP ${sourceOperation.sequence} — ${sourceOperation.name}` : connection.sourceOperationId)), field('Target operation', output(targetOperation ? `OP ${targetOperation.sequence} — ${targetOperation.name}` : connection.targetOperationId)), field('Connection type', type), field('Label', label), field('Source anchor', output(`${connection.sourceAnchor.side} @ ${connection.sourceAnchor.offset.toFixed(3)}`)), field('Target anchor', output(`${connection.targetAnchor.side} @ ${connection.targetAnchor.offset.toFixed(3)}`)), field('Route status', output(connection.routeStatus === 'clear' ? 'Clear route' : 'Fallback routing warning')), field('Route length', output(`${routeLength(connection.routePoints).toFixed(1)} units`)), field('Bend count', output(String(routeBendCount(connection.routePoints)))), toggles, actions); properties.replaceChildren(form);
  };

  const renderProject = (): void => {
    const state = project.getState(); const metadata = state.metadata; const form = element('form', 'properties-form project-properties'); form.addEventListener('submit', (event) => event.preventDefault());
    const name = input('text'); name.value = metadata.name; bindText(name, (value) => value ? commands.updateProjectMetadata({ name: value }) : false);
    const description = element('textarea', 'property-input property-textarea'); description.rows = 4; description.value = metadata.description; description.addEventListener('change', () => commands.updateProjectMetadata({ description: description.value.trim() }));
    const author = input('text'); author.value = metadata.author; bindText(author, (value) => commands.updateProjectMetadata({ author: value }));
    const company = input('text'); company.value = metadata.company; bindText(company, (value) => commands.updateProjectMetadata({ company: value }));
    const gridInterval = input('number', '1', 1); gridInterval.value = String(state.settings.gridBaseInterval); bindNumber(gridInterval, (value) => commands.updateProjectSettings({ gridBaseInterval: value }), 1);
    const routingClearance = input('number', '1', 0); routingClearance.value = String(state.settings.routingClearance); bindNumber(routingClearance, (value) => commands.updateProjectSettings({ routingClearance: value }), 0);
    const displayPrecision = input('number', '1', 0); displayPrecision.max = '6'; displayPrecision.value = String(state.settings.displayPrecision); bindNumber(displayPrecision, (value) => value <= 6 && commands.updateProjectSettings({ displayPrecision: value }), 0, true);
    form.append(field('Project name', name), field('Description', description), field('Author', author), field('Company', company), field('Grid base interval', gridInterval), field('Routing clearance', routingClearance), field('Display precision', displayPrecision), field('Unit system', output(state.settings.unitSystem)), field('Project ID', output(metadata.id)), field('Created UTC', output(metadata.createdUtc)), field('Modified UTC', output(metadata.modifiedUtc)), field('Schema version', output('1.0.0')), field('File', output(state.fileName ?? 'Not saved'))); properties.replaceChildren(form);
  };

  const render = (): void => {
    const selected = selection.getSelection(); const selectionState = selection.getState(); const workspace = workspaces.getActive(); const resource = resources.getSelectedResource(); const operation = operations.getSelectedOperation(); const connection = connections.getSelectedConnection();
    if (selectionState.items.length > 1) { const counts = { resources: selectionState.items.filter((item) => item.kind === 'resource').length, operations: selectionState.items.filter((item) => item.kind === 'operation').length, connections: selectionState.items.filter((item) => item.kind === 'connection').length }; const locked = selectionState.items.filter((item) => item.kind === 'resource' ? resources.getResource(item.id)?.locked : item.kind === 'operation' ? operations.getOperation(item.id)?.locked : connections.getConnection(item.id)?.locked).length; const panel = element('div', 'multi-selection-properties'); panel.append(element('h3', '', `${selectionState.items.length} items selected`), element('p', '', `${counts.resources} resources · ${counts.operations} operations · ${counts.connections} connections · ${locked} locked`)); const actions = element('div', 'resource-property-actions'); const add = (label: string, run: () => { readonly message: string }): void => { const button = actionButton(label, 'secondary-button'); button.addEventListener('click', () => reportStatus(run().message)); actions.append(button); }; add('Copy', () => editing.copy()); add('Cut', () => editing.cut((message) => window.confirm(message))); add('Duplicate', () => editing.duplicate()); add('Delete', () => editing.deleteSelection((message) => window.confirm(message))); panel.append(actions); properties.replaceChildren(panel); }
    else if (selected.kind === 'project') renderProject(); else if (workspace === 'factoryLayout' && selected.kind === 'resource' && resource) renderResource(); else if (workspace === 'processFlow' && selected.kind === 'operation' && operation) renderOperation(); else if (workspace === 'processFlow' && selected.kind === 'connection' && connection) renderConnection(connection); else properties.replaceChildren(element('div', 'empty-inspector', `No ${workspace === 'processFlow' ? 'operation or connection' : 'physical resource'} selected`));
    summary.replaceChildren();
    if (selectionState.items.length > 1) { summaryRow(summary, 'Selected items', String(selectionState.items.length)); summaryRow(summary, 'Primary', selectionState.primary?.id ?? 'None'); summaryRow(summary, 'Workspace', workspace === 'processFlow' ? 'Process Flow' : 'Factory Layout'); }
    else if (selected.kind === 'project') { const state = project.getState(); summaryRow(summary, 'Object type', 'Project'); summaryRow(summary, 'ID', state.metadata.id); summaryRow(summary, 'Status', state.dirty ? 'Unsaved changes' : 'Saved'); summaryRow(summary, 'Operations', String(operations.getOperationCount())); summaryRow(summary, 'Connections', String(connections.getConnectionCount())); summaryRow(summary, 'Resources', String(resources.getResourceCount())); }
    else if (workspace === 'factoryLayout' && resource) { summaryRow(summary, 'Object type', 'Physical Resource'); summaryRow(summary, 'ID', resource.id); summaryRow(summary, 'Active', resource.active ? 'Yes' : 'No'); summaryRow(summary, 'Assignments', String(operations.getAssignmentCount(resource.id))); }
    else if (workspace === 'processFlow' && operation) { summaryRow(summary, 'Object type', 'Operation'); summaryRow(summary, 'ID', operation.id); summaryRow(summary, 'Sequence', `OP ${operation.sequence}`); summaryRow(summary, 'Resource', operation.assignedResourceId ?? 'Unassigned'); }
    else if (workspace === 'processFlow' && connection) { const source = operations.getOperation(connection.sourceOperationId); const target = operations.getOperation(connection.targetOperationId); summaryRow(summary, 'Object type', 'Connection'); summaryRow(summary, 'ID', connection.id); summaryRow(summary, 'Type', connection.connectionType); summaryRow(summary, 'Source', `${source?.id ?? connection.sourceOperationId} — ${source?.name ?? 'Missing'}`); summaryRow(summary, 'Target', `${target?.id ?? connection.targetOperationId} — ${target?.name ?? 'Missing'}`); summaryRow(summary, 'Route length', routeLength(connection.routePoints).toFixed(1)); summaryRow(summary, 'Bends', String(routeBendCount(connection.routePoints))); }
    else summaryRow(summary, 'Selected items', '0');
    const operationHealth = validateOperations(operations.getOperations(), (id) => resources.getResource(id), (id) => Boolean(resources.getTemplate(id))); const resourceHealth = validateResources(resources.getPlacedResources(), resources.getTemplates(), (id) => operations.getAssignmentCount(id)); const connectionHealth = validateProcessConnections(operations.getOperations(), connections.getConnections()); const errors = operationHealth.errors + resourceHealth.errors + connectionHealth.errors; const warnings = operationHealth.warnings + resourceHealth.warnings + connectionHealth.warnings;
    validation.replaceChildren(element('div', errors ? 'validation-error' : warnings ? 'validation-warning' : 'validation-healthy', errors ? '● Project has errors' : warnings ? '● Review warnings' : '● Project healthy')); const metrics = element('div', 'validation-metrics'); metrics.append(element('span', '', `${errors} Errors`), element('span', '', `${warnings} Warnings`)); validation.append(metrics);
    const issueEntries: ValidationListEntry[] = [];
    for (const entry of operationHealth.issues) {
      const affected = operations.getOperation(entry.operationId); const location = affected ? `OP ${affected.sequence} — ${affected.name}` : `Operation ${entry.operationId}`;
      issueEntries.push({ severity: entry.severity, location, message: entry.message, navigate: () => { workspaces.activate('processFlow'); operations.selectOperation(entry.operationId); revealOperation(entry.operationId); reportStatus(`Showing validation issue at ${location}`); } });
    }
    for (const entry of resourceHealth.issues) {
      const affected = resources.getResource(entry.resourceId); const location = affected ? `${affected.id} — ${affected.name}` : `Resource ${entry.resourceId}`;
      issueEntries.push({ severity: entry.severity, location, message: entry.message, navigate: () => { workspaces.activate('factoryLayout'); resources.selectResource(entry.resourceId); revealResource(entry.resourceId); reportStatus(`Showing validation issue at ${location}`); } });
    }
    for (const entry of connectionHealth.issues) {
      if (entry.connectionId) {
        const location = `Connection ${entry.connectionId}`;
        issueEntries.push({ severity: entry.severity, location, message: entry.message, navigate: () => { workspaces.activate('processFlow'); connections.selectConnection(entry.connectionId!); revealConnection(entry.connectionId!); reportStatus(`Showing validation issue at ${location}`); } });
      } else if (entry.operationId) {
        const affected = operations.getOperation(entry.operationId); const location = affected ? `OP ${affected.sequence} — ${affected.name}` : `Operation ${entry.operationId}`;
        issueEntries.push({ severity: entry.severity, location, message: entry.message, navigate: () => { workspaces.activate('processFlow'); operations.selectOperation(entry.operationId!); revealOperation(entry.operationId!); reportStatus(`Showing validation issue at ${location}`); } });
      } else {
        issueEntries.push({ severity: entry.severity, location: 'Process Flow', message: entry.message, navigate: () => { workspaces.activate('processFlow'); reportStatus('Showing Process Flow validation issue'); } });
      }
    }
    issueEntries.sort((left, right) => left.severity === right.severity ? left.location.localeCompare(right.location) || left.message.localeCompare(right.message) : left.severity === 'error' ? -1 : 1);
    if (issueEntries.length) {
      validation.append(element('div', 'validation-list-heading', `${issueEntries.length} issue${issueEntries.length === 1 ? '' : 's'} — select one to locate it`));
      const list = element('ul', 'validation-issues');
      for (const entry of issueEntries) {
        const item = element('li', `validation-issue validation-issue--${entry.severity}`); const button = actionButton(`${entry.location}: ${entry.message}`, 'validation-issue__button');
        button.replaceChildren(element('span', 'validation-issue__icon', entry.severity === 'error' ? '⛔' : '⚠'), element('strong', 'validation-issue__location', entry.location), element('span', 'validation-issue__message', entry.message));
        button.setAttribute('aria-label', `${entry.severity === 'error' ? 'Error' : 'Warning'} at ${entry.location}: ${entry.message}. Select to locate.`); button.addEventListener('click', entry.navigate); item.append(button); list.append(item);
      }
      validation.append(list);
    }
  };
  const unsubscribers = [resources.subscribe(render), operations.subscribe(render), connections.subscribe(render), workspaces.subscribe(render), selection.subscribe(render), project.subscribe(render)]; render();
  return { element: sidebar, dispose: () => unsubscribers.forEach((unsubscribe) => unsubscribe()) };
}
