import { createRibbon } from '../components/ribbon/Ribbon';
import { createLeftSidebar } from '../components/sidebar/LeftSidebar';
import { createRightSidebar } from '../components/sidebar/RightSidebar';
import { createStatusBar, type StatusBarController } from '../components/statusbar/StatusBar';
import { createTitleBar } from '../components/titlebar/TitleBar';
import { createWorkspace } from '../components/workspace/Workspace';
import { actionButton, element } from '../ui/dom';
import { RESOURCE_TEMPLATES } from '../core/constants/resourceTemplates';
import { ResourceStore } from '../services/ResourceStore';
import { ResourceIdGenerator } from '../utilities/ResourceIdGenerator';
import { OPERATION_TEMPLATES } from '../core/constants/operationTemplates';
import { OperationStore } from '../services/OperationStore';
import { OperationIdGenerator } from '../utilities/OperationIdGenerator';
import { SelectionStore } from '../services/SelectionStore';
import { validateOperations } from '../services/OperationValidation';

export interface AppShellResult {
  readonly element: HTMLElement;
  readonly statusBar: StatusBarController;
  dispose(): void;
}

export function createAppShell(): AppShellResult {
  const shell = element('div', 'app-shell');
  const body = element('div', 'app-body');
  const selectionStore = new SelectionStore();
  const resourceStore = new ResourceStore(RESOURCE_TEMPLATES, new ResourceIdGenerator(), selectionStore);
  const operationStore = new OperationStore(OPERATION_TEMPLATES, new OperationIdGenerator(), selectionStore);
  const left = createLeftSidebar(resourceStore, operationStore);
  const right = createRightSidebar(resourceStore, operationStore, selectionStore);
  const statusBar = createStatusBar();
  const titleBar = createTitleBar();
  const leftToggle = actionButton('Hide project and resource panels', 'panel-toggle panel-toggle--left');
  const rightToggle = actionButton('Hide inspector panels', 'panel-toggle panel-toggle--right');

  leftToggle.textContent = '‹';
  rightToggle.textContent = '›';
  leftToggle.addEventListener('click', () => {
    const collapsed = shell.classList.toggle('app-shell--left-collapsed');
    leftToggle.textContent = collapsed ? '›' : '‹';
    leftToggle.setAttribute('aria-label', `${collapsed ? 'Show' : 'Hide'} project and resource panels`);
  });
  rightToggle.addEventListener('click', () => {
    const collapsed = shell.classList.toggle('app-shell--right-collapsed');
    rightToggle.textContent = collapsed ? '‹' : '›';
    rightToggle.setAttribute('aria-label', `${collapsed ? 'Show' : 'Hide'} inspector panels`);
  });
  const workspace = createWorkspace({
    application: shell,
    statusBar,
    resourceStore,
    operationStore,
    selectionStore,
    onFocusModeChange: (active) => shell.classList.toggle('app-shell--canvas-focus', active),
  });
  body.append(left.element, leftToggle, workspace.element, rightToggle, right.element);
  shell.append(titleBar.element, createRibbon(), body, statusBar.element);
  const updateStatus = (): void => {
    const selected = selectionStore.getSelection();
    const label = selected.kind === 'resource' ? `Resource ${resourceStore.getResource(selected.id)?.name ?? selected.id}` : selected.kind === 'operation' ? `Operation OP ${operationStore.getOperation(selected.id)?.sequence ?? selected.id}` : '0';
    statusBar.setSelectionLabel(label);
    statusBar.setResourceCount(resourceStore.getResourceCount());
    statusBar.setOperationCount(operationStore.getOperationCount());
    const health = validateOperations(operationStore.getOperations(), (id) => Boolean(resourceStore.getResource(id)));
    statusBar.setHealth(health.errors, health.warnings); titleBar.setHealth(health.errors, health.warnings);
  };
  const unsubscribeResourceStatus = resourceStore.subscribe((change) => {
    if (change.kind === 'updated' || change.kind === 'deleted') operationStore.handleResourceChange(change.kind === 'deleted' ? change.resourceId : change.resource.id, change.kind === 'deleted');
    updateStatus();
  });
  const unsubscribeOperationStatus = operationStore.subscribe(updateStatus); const unsubscribeSelectionStatus = selectionStore.subscribe(updateStatus); updateStatus();
  return {
    element: shell,
    statusBar,
    dispose: () => {
      unsubscribeResourceStatus(); unsubscribeOperationStatus(); unsubscribeSelectionStatus();
      left.dispose();
      right.dispose();
      workspace.dispose();
      operationStore.dispose(); resourceStore.dispose();
    },
  };
}

