import { revealConnection } from '../../core/events/connectionEvents';
import { revealOperation } from '../../core/events/operationEvents';
import { revealResource } from '../../core/events/resourceEvents';
import { reportStatus } from '../../core/events/uiEvents';
import type { SelectionController } from '../../models/selection/Selection';
import type { ConnectionStore } from '../../services/ConnectionStore';
import { validateProcessConnections } from '../../services/ConnectionValidation';
import type { OperationStore } from '../../services/OperationStore';
import type { ProjectSessionService } from '../../services/project/ProjectSessionService';
import type { ResourceStore } from '../../services/ResourceStore';
import { validateResources } from '../../services/ResourceValidation';
import type { WorkspaceStore } from '../../services/WorkspaceStore';
import { actionButton, element } from '../../ui/dom';
import type { CommandFactory } from '../../services/history/CommandFactory';

export interface ProjectExplorerController { readonly element: HTMLElement; dispose(): void; }

export function createProjectExplorer(operationsStore: OperationStore, connectionsStore: ConnectionStore, resourcesStore: ResourceStore, workspaceStore: WorkspaceStore, project: ProjectSessionService, selection: SelectionController, commands: CommandFactory): ProjectExplorerController {
  const explorer = element('section', 'panel-section project-explorer'); explorer.append(element('h2', 'panel-heading', 'Project Explorer'));
  const tree = element('nav', 'project-tree'); tree.setAttribute('aria-label', 'Project explorer');
  const list = element('ul'); const root = element('li', 'project-tree__root'); const rootButton = actionButton('Project', 'tree-item tree-item--label project-root-button'); rootButton.addEventListener('click', () => selection.select({ kind: 'project', id: project.getMetadata().id })); root.append(rootButton);
  const process = element('li'); const processDetails = element('details', 'process-tree'); processDetails.open = true; const processSummary = element('summary');
  const operationHeading = element('h3', 'process-group-heading', 'Operations (0)'); const operations = element('ol', 'process-operation-list');
  const connectionHeading = element('h3', 'process-group-heading', 'Connections (0)'); const connections = element('ul', 'process-connection-list');
  const normalize = actionButton('Normalize Sequence', 'normalize-sequence'); processDetails.append(processSummary, operationHeading, operations, connectionHeading, connections, normalize); process.append(processDetails);
  const layout = element('li'); const layoutDetails = element('details', 'process-tree'); layoutDetails.open = true; const layoutSummary = element('summary'); const resources = element('ol', 'process-operation-list resource-instance-list'); layoutDetails.append(layoutSummary, resources); layout.append(layoutDetails);
  list.append(root, process, layout); tree.append(list); explorer.append(tree);
  normalize.addEventListener('click', () => { reportStatus(commands.normalizeOperationSequences() ? 'Operation sequence normalized' : 'Operation sequence already normalized'); });
  const selectFromExplorer = (event: MouseEvent, item: { readonly kind: 'resource' | 'operation' | 'connection'; readonly id: string }): void => { workspaceStore.activate(item.kind === 'resource' ? 'factoryLayout' : 'processFlow'); if (event.ctrlKey || event.metaKey) selection.toggle(item); else if (event.shiftKey) selection.add(item); else selection.select(item); };

  const render = (): void => {
    const projectState = project.getState(); rootButton.textContent = `▾ ${projectState.metadata.name}${projectState.dirty ? ' *' : ''} (${projectState.metadata.id}) — ${operationsStore.getOperationCount()} ops, ${connectionsStore.getConnectionCount()} links, ${resourcesStore.getResourceCount()} resources`; rootButton.classList.toggle('project-root-button--selected', selection.getSelection().kind === 'project');
    const sortedOperations = operationsStore.sortedOperations(); const sortedConnections = connectionsStore.sortedConnections(); const processHealth = validateProcessConnections(sortedOperations, sortedConnections); const processMarker = processHealth.errors ? ' ⛔' : processHealth.warnings ? ' ⚠' : '';
    processSummary.textContent = `Process Flow — ${sortedOperations.length} operations, ${sortedConnections.length} connections${processMarker}`; operationHeading.textContent = `Operations (${sortedOperations.length})`; connectionHeading.textContent = `Connections (${sortedConnections.length})`; operations.replaceChildren(); connections.replaceChildren();
    for (const operation of sortedOperations) { const entry = element('li'); const button = actionButton(`OP ${operation.sequence} ${operation.name}`, 'process-operation'); button.classList.toggle('process-operation--selected', operation.selected); button.addEventListener('click', (event) => { selectFromExplorer(event, { kind: 'operation', id: operation.id }); revealOperation(operation.id); }); entry.append(button); operations.append(entry); }
    if (!sortedOperations.length) operations.append(element('li', 'process-operation-list__empty', 'No operations placed'));
    for (const connection of sortedConnections) { const source = operationsStore.getOperation(connection.sourceOperationId); const target = operationsStore.getOperation(connection.targetOperationId); const label = `${connection.id} — OP ${source?.sequence ?? '?'} → OP ${target?.sequence ?? '?'}`; const entry = element('li'); const button = actionButton(label, 'process-connection-entry'); button.classList.toggle('process-connection-entry--selected', connection.selected); const issues = processHealth.issues.filter((issue) => issue.connectionId === connection.id); if (issues.length) { const warning = element('span', 'process-warning', issues.some((issue) => issue.severity === 'error') ? ' ⛔' : ' ⚠'); warning.setAttribute('aria-label', issues.map((issue) => issue.message).join(' ')); button.append(warning); } button.addEventListener('click', (event) => { selectFromExplorer(event, { kind: 'connection', id: connection.id }); revealConnection(connection.id); }); entry.append(button); connections.append(entry); }
    if (!sortedConnections.length) connections.append(element('li', 'process-operation-list__empty', 'No process connections'));
    const instances = [...resourcesStore.getPlacedResources()].sort((a, b) => a.id.localeCompare(b.id)); const resourceHealth = validateResources(instances, resourcesStore.getTemplates(), (id) => operationsStore.getAssignmentCount(id)); layoutSummary.textContent = `Factory Layout — Resources (${instances.length})`; resources.replaceChildren();
    for (const resource of instances) { const count = operationsStore.getAssignmentCount(resource.id); const hasIssue = resourceHealth.issues.some((issue) => issue.resourceId === resource.id); const entry = element('li'); const button = actionButton(`${resource.id} — ${resource.name} — ${resource.resourceType} — ${resource.active ? 'Active' : 'Inactive'} — ${count} assigned${hasIssue ? ' — Validation warning' : ''}`, 'process-operation resource-instance-entry'); button.classList.toggle('process-operation--selected', resource.selected); button.addEventListener('click', (event) => { selectFromExplorer(event, { kind: 'resource', id: resource.id }); revealResource(resource.id); }); entry.append(button); resources.append(entry); }
    if (!instances.length) resources.append(element('li', 'process-operation-list__empty', 'No physical resources placed'));
  };
  const unsubscribers = [operationsStore.subscribe(render), connectionsStore.subscribe(render), resourcesStore.subscribe(render), workspaceStore.subscribe(render), project.subscribe(render), selection.subscribe(render)]; render();
  return { element: explorer, dispose: () => unsubscribers.forEach((unsubscribe) => unsubscribe()) };
}
