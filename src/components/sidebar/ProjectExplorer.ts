import { revealOperation } from '../../core/events/operationEvents';
import { revealResource } from '../../core/events/resourceEvents';
import { reportStatus } from '../../core/events/uiEvents';
import type { OperationStore } from '../../services/OperationStore';
import type { ResourceStore } from '../../services/ResourceStore';
import { validateResources } from '../../services/ResourceValidation';
import type { WorkspaceStore } from '../../services/WorkspaceStore';
import { actionButton, element } from '../../ui/dom';

export interface ProjectExplorerController { readonly element: HTMLElement; dispose(): void; }

export function createProjectExplorer(operationsStore: OperationStore, resourcesStore: ResourceStore, workspaceStore: WorkspaceStore): ProjectExplorerController {
  const explorer = element('section', 'panel-section project-explorer');
  explorer.append(element('h2', 'panel-heading', 'Project Explorer'));
  const tree = element('nav', 'project-tree'); tree.setAttribute('aria-label', 'Project explorer');
  const list = element('ul'); const root = element('li', 'project-tree__root'); root.append(element('span', 'tree-item tree-item--label', '▾ Project'));
  const process = element('li'); const processDetails = element('details', 'process-tree'); processDetails.open = true;
  const processSummary = element('summary'); const operations = element('ol', 'process-operation-list'); const normalize = actionButton('Normalize Sequence', 'normalize-sequence'); processDetails.append(processSummary, operations, normalize); process.append(processDetails);
  const layout = element('li'); const layoutDetails = element('details', 'process-tree'); layoutDetails.open = true;
  const layoutSummary = element('summary'); const resources = element('ol', 'process-operation-list resource-instance-list'); layoutDetails.append(layoutSummary, resources); layout.append(layoutDetails); list.append(root, process, layout); tree.append(list); explorer.append(tree);
  normalize.addEventListener('click', () => { operationsStore.normalizeSequences(); reportStatus('Operation sequence normalized'); });

  const render = (): void => {
    const sorted = operationsStore.sortedOperations(); processSummary.textContent = `Process Flow — Operations (${sorted.length})`; operations.replaceChildren();
    for (const operation of sorted) { const entry = element('li'); const button = actionButton(`OP ${operation.sequence} ${operation.name}`, 'process-operation'); button.classList.toggle('process-operation--selected', operation.selected); button.addEventListener('click', () => { workspaceStore.activate('processFlow'); operationsStore.selectOperation(operation.id); revealOperation(operation.id); }); entry.append(button); operations.append(entry); }
    if (!sorted.length) operations.append(element('li', 'process-operation-list__empty', 'No operations placed'));
    const instances = [...resourcesStore.getPlacedResources()].sort((a, b) => a.id.localeCompare(b.id));
    const validation = validateResources(instances, resourcesStore.getTemplates(), (id) => operationsStore.getAssignmentCount(id)); layoutSummary.textContent = `Factory Layout — Resources (${instances.length})`; resources.replaceChildren();
    for (const resource of instances) { const count = operationsStore.getAssignmentCount(resource.id); const hasIssue = validation.issues.some((issue) => issue.resourceId === resource.id); const entry = element('li'); const button = actionButton(`${resource.id} — ${resource.name} — ${resource.resourceType} — ${resource.active ? 'Active' : 'Inactive'} — ${count} assigned${hasIssue ? ' — Validation warning' : ''}`, 'process-operation resource-instance-entry'); button.classList.toggle('process-operation--selected', resource.selected); button.addEventListener('click', () => { workspaceStore.activate('factoryLayout'); resourcesStore.selectResource(resource.id); revealResource(resource.id); }); entry.append(button); resources.append(entry); }
    if (!instances.length) resources.append(element('li', 'process-operation-list__empty', 'No physical resources placed'));
  };
  const unsubscribers = [operationsStore.subscribe(render), resourcesStore.subscribe(render), workspaceStore.subscribe(render)]; render();
  return { element: explorer, dispose: () => unsubscribers.forEach((unsubscribe) => unsubscribe()) };
}
