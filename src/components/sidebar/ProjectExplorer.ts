import { revealConnection } from '../../core/events/connectionEvents';
import { revealOperation } from '../../core/events/operationEvents';
import { revealResource } from '../../core/events/resourceEvents';
import { reportStatus } from '../../core/events/uiEvents';
import type { ConnectionStore } from '../../services/ConnectionStore';
import { validateProcessConnections } from '../../services/ConnectionValidation';
import type { OperationStore } from '../../services/OperationStore';
import type { ResourceStore } from '../../services/ResourceStore';
import { validateResources } from '../../services/ResourceValidation';
import type { WorkspaceStore } from '../../services/WorkspaceStore';
import { actionButton, element } from '../../ui/dom';

export interface ProjectExplorerController { readonly element: HTMLElement; dispose(): void; }

export function createProjectExplorer(operationsStore: OperationStore, connectionsStore: ConnectionStore, resourcesStore: ResourceStore, workspaceStore: WorkspaceStore): ProjectExplorerController {
  const explorer = element('section', 'panel-section project-explorer'); explorer.append(element('h2', 'panel-heading', 'Project Explorer'));
  const tree = element('nav', 'project-tree'); tree.setAttribute('aria-label', 'Project explorer');
  const list = element('ul'); const root = element('li', 'project-tree__root'); root.append(element('span', 'tree-item tree-item--label', '▾ Project'));
  const process = element('li'); const processDetails = element('details', 'process-tree'); processDetails.open = true; const processSummary = element('summary');
  const operationHeading = element('h3', 'process-group-heading', 'Operations (0)'); const operations = element('ol', 'process-operation-list');
  const connectionHeading = element('h3', 'process-group-heading', 'Connections (0)'); const connections = element('ul', 'process-connection-list');
  const normalize = actionButton('Normalize Sequence', 'normalize-sequence'); processDetails.append(processSummary, operationHeading, operations, connectionHeading, connections, normalize); process.append(processDetails);
  const layout = element('li'); const layoutDetails = element('details', 'process-tree'); layoutDetails.open = true; const layoutSummary = element('summary'); const resources = element('ol', 'process-operation-list resource-instance-list'); layoutDetails.append(layoutSummary, resources); layout.append(layoutDetails);
  list.append(root, process, layout); tree.append(list); explorer.append(tree);
  normalize.addEventListener('click', () => { operationsStore.normalizeSequences(); reportStatus('Operation sequence normalized'); });

  const render = (): void => {
    const sortedOperations = operationsStore.sortedOperations(); const sortedConnections = connectionsStore.sortedConnections(); const processHealth = validateProcessConnections(sortedOperations, sortedConnections); const processMarker = processHealth.errors ? ' ⛔' : processHealth.warnings ? ' ⚠' : '';
    processSummary.textContent = `Process Flow — ${sortedOperations.length} operations, ${sortedConnections.length} connections${processMarker}`; operationHeading.textContent = `Operations (${sortedOperations.length})`; connectionHeading.textContent = `Connections (${sortedConnections.length})`; operations.replaceChildren(); connections.replaceChildren();
    for (const operation of sortedOperations) { const entry = element('li'); const button = actionButton(`OP ${operation.sequence} ${operation.name}`, 'process-operation'); button.classList.toggle('process-operation--selected', operation.selected); button.addEventListener('click', () => { workspaceStore.activate('processFlow'); operationsStore.selectOperation(operation.id); revealOperation(operation.id); }); entry.append(button); operations.append(entry); }
    if (!sortedOperations.length) operations.append(element('li', 'process-operation-list__empty', 'No operations placed'));
    for (const connection of sortedConnections) { const source = operationsStore.getOperation(connection.sourceOperationId); const target = operationsStore.getOperation(connection.targetOperationId); const label = `${connection.id} — OP ${source?.sequence ?? '?'} → OP ${target?.sequence ?? '?'}`; const entry = element('li'); const button = actionButton(label, 'process-connection-entry'); button.classList.toggle('process-connection-entry--selected', connection.selected); const issues = processHealth.issues.filter((issue) => issue.connectionId === connection.id); if (issues.length) { const warning = element('span', 'process-warning', issues.some((issue) => issue.severity === 'error') ? ' ⛔' : ' ⚠'); warning.setAttribute('aria-label', issues.map((issue) => issue.message).join(' ')); button.append(warning); } button.addEventListener('click', () => { workspaceStore.activate('processFlow'); connectionsStore.selectConnection(connection.id); revealConnection(connection.id); }); entry.append(button); connections.append(entry); }
    if (!sortedConnections.length) connections.append(element('li', 'process-operation-list__empty', 'No process connections'));
    const instances = [...resourcesStore.getPlacedResources()].sort((a, b) => a.id.localeCompare(b.id)); const resourceHealth = validateResources(instances, resourcesStore.getTemplates(), (id) => operationsStore.getAssignmentCount(id)); layoutSummary.textContent = `Factory Layout — Resources (${instances.length})`; resources.replaceChildren();
    for (const resource of instances) { const count = operationsStore.getAssignmentCount(resource.id); const hasIssue = resourceHealth.issues.some((issue) => issue.resourceId === resource.id); const entry = element('li'); const button = actionButton(`${resource.id} — ${resource.name} — ${resource.resourceType} — ${resource.active ? 'Active' : 'Inactive'} — ${count} assigned${hasIssue ? ' — Validation warning' : ''}`, 'process-operation resource-instance-entry'); button.classList.toggle('process-operation--selected', resource.selected); button.addEventListener('click', () => { workspaceStore.activate('factoryLayout'); resourcesStore.selectResource(resource.id); revealResource(resource.id); }); entry.append(button); resources.append(entry); }
    if (!instances.length) resources.append(element('li', 'process-operation-list__empty', 'No physical resources placed'));
  };
  const unsubscribers = [operationsStore.subscribe(render), connectionsStore.subscribe(render), resourcesStore.subscribe(render), workspaceStore.subscribe(render)]; render();
  return { element: explorer, dispose: () => unsubscribers.forEach((unsubscribe) => unsubscribe()) };
}
