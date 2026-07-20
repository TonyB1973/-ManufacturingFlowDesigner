import { revealConnection } from '../../core/events/connectionEvents';
import { revealOperation } from '../../core/events/operationEvents';
import { reportPlaceholder, reportStatus } from '../../core/events/uiEvents';
import type { ConnectionStore } from '../../services/ConnectionStore';
import type { OperationStore } from '../../services/OperationStore';
import { validateProcessConnections } from '../../services/ConnectionValidation';
import { actionButton, element } from '../../ui/dom';

export interface ProjectExplorerController { readonly element: HTMLElement; dispose(): void; }
export function createProjectExplorer(operationsStore: OperationStore, connectionsStore: ConnectionStore): ProjectExplorerController {
  const explorer = element('section', 'panel-section project-explorer'); explorer.append(element('h2', 'panel-heading', 'Project Explorer'));
  const tree = element('nav', 'project-tree'); tree.setAttribute('aria-label', 'Project explorer'); const list = element('ul');
  const root = element('li', 'project-tree__root'); root.append(element('span', 'tree-item tree-item--label', '▾  Project'));
  const process = element('li'); const processDetails = element('details', 'process-tree'); processDetails.open = true; const processSummary = element('summary', '', 'Process Flow');
  const operationHeading = element('h3', 'process-group-heading', 'Operations (0)'); const operationList = element('ol', 'process-operation-list');
  const connectionHeading = element('h3', 'process-group-heading', 'Connections (0)'); const connectionList = element('ul', 'process-connection-list');
  const normalize = actionButton('Normalize Sequence', 'normalize-sequence'); processDetails.append(processSummary, operationHeading, operationList, connectionHeading, connectionList, normalize); process.append(processDetails); list.append(root, process);
  ['Factory Layout', 'Standard Work', 'Simulation', 'Documents'].forEach((name) => { const entry = element('li'); const button = actionButton(`◇  ${name}`, 'tree-item'); button.addEventListener('click', () => reportPlaceholder(name)); entry.append(button); list.append(entry); }); tree.append(list); explorer.append(tree);
  const dialog = element('dialog', 'confirmation-dialog'); const title = element('h3', '', 'Normalize operation sequence?'); title.id = 'normalize-title'; dialog.setAttribute('aria-labelledby', title.id); dialog.append(title, element('p', '', 'Operations will be renumbered in current sequence order using intervals of 10.'));
  const actions = element('div', 'confirmation-dialog__actions'); const cancel = actionButton('Cancel'); const confirm = actionButton('Normalize', 'command-button command-button--primary'); actions.append(cancel, confirm); dialog.append(actions); explorer.append(dialog);
  normalize.addEventListener('click', () => dialog.showModal()); cancel.addEventListener('click', () => dialog.close()); confirm.addEventListener('click', () => { operationsStore.normalizeSequences(); dialog.close(); reportStatus('Operation sequence normalized'); });
  const render = (): void => {
    const operations = operationsStore.sortedOperations(); const connections = connectionsStore.sortedConnections(); const health = validateProcessConnections(operations, connections); const marker = health.errors ? ' ⛔' : health.warnings ? ' ⚠' : ''; processSummary.textContent = `Process Flow — ${operations.length} operations, ${connections.length} connections${marker}`; operationHeading.textContent = `Operations (${operations.length})`; connectionHeading.textContent = `Connections (${connections.length})`; operationList.replaceChildren(); connectionList.replaceChildren();
    if (!operations.length) operationList.append(element('li', 'process-operation-list__empty', 'No operations placed'));
    operations.forEach((operation) => { const entry = element('li'); const button = actionButton(`OP ${operation.sequence}  ${operation.name}`, 'process-operation'); button.classList.toggle('process-operation--selected', operation.selected); button.addEventListener('click', () => { operationsStore.selectOperation(operation.id); revealOperation(operation.id); }); entry.append(button); operationList.append(entry); });
    if (!connections.length) connectionList.append(element('li', 'process-operation-list__empty', 'No process connections'));
    connections.forEach((connection) => { const source = operationsStore.getOperation(connection.sourceOperationId); const target = operationsStore.getOperation(connection.targetOperationId); const label = `${connection.id} — OP ${source?.sequence ?? '?'} → OP ${target?.sequence ?? '?'}`; const entry = element('li'); const button = actionButton(label, 'process-connection-entry'); button.classList.toggle('process-connection-entry--selected', connection.selected); const issues = health.issues.filter((issue) => issue.connectionId === connection.id); if (issues.length) { const symbol = issues.some((issue) => issue.severity === 'error') ? ' ⛔' : ' ⚠'; const warning = element('span', 'process-warning', symbol); warning.setAttribute('aria-label', issues.map((issue) => issue.message).join(' ')); button.append(warning); } button.addEventListener('click', () => { connectionsStore.selectConnection(connection.id); revealConnection(connection.id); }); entry.append(button); connectionList.append(entry); });
  };
  const unsubscribers = [operationsStore.subscribe(render), connectionsStore.subscribe(render)]; render(); return { element: explorer, dispose: () => unsubscribers.forEach((unsubscribe) => unsubscribe()) };
}
