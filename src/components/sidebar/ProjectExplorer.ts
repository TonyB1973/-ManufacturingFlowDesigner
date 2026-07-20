import { revealOperation } from '../../core/events/operationEvents';
import { reportPlaceholder, reportStatus } from '../../core/events/uiEvents';
import type { OperationStore } from '../../services/OperationStore';
import { actionButton, element } from '../../ui/dom';

export interface ProjectExplorerController { readonly element: HTMLElement; dispose(): void; }

export function createProjectExplorer(store: OperationStore): ProjectExplorerController {
  const explorer = element('section', 'panel-section project-explorer'); explorer.append(element('h2', 'panel-heading', 'Project Explorer'));
  const tree = element('nav', 'project-tree'); tree.setAttribute('aria-label', 'Project explorer'); const list = element('ul');
  const root = element('li', 'project-tree__root'); root.append(element('span', 'tree-item tree-item--label', '▾  Project'));
  const process = element('li'); const processDetails = element('details', 'process-tree'); processDetails.open = true;
  const processSummary = element('summary', '', 'Process Flow (0)'); const operations = element('ol', 'process-operation-list');
  const normalize = actionButton('Normalize Sequence', 'normalize-sequence'); processDetails.append(processSummary, operations, normalize); process.append(processDetails);
  list.append(root, process);
  ['Factory Layout', 'Standard Work', 'Simulation', 'Documents'].forEach((name) => {
    const entry = element('li'); const button = actionButton(`◇  ${name}`, 'tree-item'); button.addEventListener('click', () => reportPlaceholder(name)); entry.append(button); list.append(entry);
  });
  tree.append(list); explorer.append(tree);
  const dialog = element('dialog', 'confirmation-dialog'); const title = element('h3', '', 'Normalize operation sequence?'); title.id = 'normalize-title'; dialog.setAttribute('aria-labelledby', title.id);
  dialog.append(title, element('p', '', 'Operations will be renumbered in current sequence order using intervals of 10.'));
  const actions = element('div', 'confirmation-dialog__actions'); const cancel = actionButton('Cancel'); const confirm = actionButton('Normalize', 'command-button command-button--primary');
  actions.append(cancel, confirm); dialog.append(actions); explorer.append(dialog);
  normalize.addEventListener('click', () => dialog.showModal()); cancel.addEventListener('click', () => dialog.close());
  confirm.addEventListener('click', () => { store.normalizeSequences(); dialog.close(); reportStatus('Operation sequence normalized'); });
  const render = (): void => {
    const sorted = store.sortedOperations(); processSummary.textContent = `Process Flow (${sorted.length})`; operations.replaceChildren();
    if (!sorted.length) { operations.append(element('li', 'process-operation-list__empty', 'No operations placed')); return; }
    for (const operation of sorted) {
      const entry = element('li'); const button = actionButton(`OP ${operation.sequence}  ${operation.name}`, 'process-operation');
      button.classList.toggle('process-operation--selected', operation.selected);
      button.addEventListener('click', () => { store.selectOperation(operation.id); revealOperation(operation.id); }); entry.append(button); operations.append(entry);
    }
  };
  const unsubscribe = store.subscribe(render); render(); return { element: explorer, dispose: unsubscribe };
}
