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
import { WorkspaceStore } from '../services/WorkspaceStore';
import { validateResources } from '../services/ResourceValidation';
import { createResourceDeletionDialog } from '../components/workspace/resources/ResourceDeletionDialog';

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
  const workspaceStore = new WorkspaceStore();
  const statusBar = createStatusBar();
  const titleBar = createTitleBar();
  const deletionDialog = createResourceDeletionDialog(resourceStore, operationStore, statusBar.setMessage); shell.append(deletionDialog.element);
  const requestResourceDeletion = (id: string): void => deletionDialog.request(id);
  const left = createLeftSidebar(resourceStore, operationStore, workspaceStore);
  const right = createRightSidebar(resourceStore, operationStore, workspaceStore, selectionStore, requestResourceDeletion);
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
    workspaceStore,
    selectionStore,
    requestResourceDeletion,
    onFocusModeChange: (active) => shell.classList.toggle('app-shell--canvas-focus', active),
  });
  body.append(left.element, leftToggle, workspace.element, rightToggle, right.element);
  shell.append(titleBar.element, createRibbon(workspaceStore), body, statusBar.element);
  const updateStatus = (): void => {
    const selected = selectionStore.getSelection();
    const label = selected.kind === 'resource' ? `Resource ${resourceStore.getResource(selected.id)?.name ?? selected.id}` : selected.kind === 'operation' ? `Operation OP ${operationStore.getOperation(selected.id)?.sequence ?? selected.id}` : '0';
    statusBar.setSelectionLabel(label);
    statusBar.setResourceCount(resourceStore.getResourceCount());
    statusBar.setOperationCount(operationStore.getOperationCount());
    const operationHealth = validateOperations(operationStore.getOperations(), (id) => resourceStore.getResource(id), (id) => Boolean(resourceStore.getTemplate(id))); const resourceHealth = validateResources(resourceStore.getPlacedResources(), resourceStore.getTemplates(), (id) => operationStore.getAssignmentCount(id)); const errors = operationHealth.errors + resourceHealth.errors; const warnings = operationHealth.warnings + resourceHealth.warnings;
    statusBar.setHealth(errors, warnings); titleBar.setHealth(errors, warnings);
  };
  const unsubscribeResourceStatus = resourceStore.subscribe((change) => {
    if (change.kind === 'deleted') operationStore.unassignResource(change.resourceId); else if (change.kind === 'updated') operationStore.handleResourceChange(change.resource.id, false);
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
      deletionDialog.dispose();
      operationStore.dispose(); resourceStore.dispose();
    },
  };
}

