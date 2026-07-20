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
import { ConnectionStore } from '../services/ConnectionStore';
import { ConnectionIdGenerator } from '../utilities/ConnectionIdGenerator';
import { anchorDirection, anchorWorldPosition, operationBounds } from '../services/ConnectionAnchors';
import { routeOrthogonal } from '../services/OrthogonalRouter';
import { validateProcessConnections } from '../services/ConnectionValidation';

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
  const connectionStore = new ConnectionStore(new ConnectionIdGenerator(), (id) => operationStore.getOperation(id), (connection) => {
    const source = operationStore.getOperation(connection.sourceOperationId); const target = operationStore.getOperation(connection.targetOperationId);
    if (!source || !target) return { points: [], status: 'fallback' };
    const obstacles = [
      ...operationStore.getOperations().filter((operation) => operation.visible && operation.id !== source.id && operation.id !== target.id).map(operationBounds),
      ...resourceStore.getPlacedResources().filter((resource) => resource.visible).map(operationBounds),
    ];
    const route = routeOrthogonal({ source: anchorWorldPosition(source, connection.sourceAnchor), sourceDirection: anchorDirection(connection.sourceAnchor), target: anchorWorldPosition(target, connection.targetAnchor), targetDirection: anchorDirection(connection.targetAnchor), obstacles, clearance: 16 });
    return { points: route.points, status: route.fallback ? 'fallback' : 'clear' };
  }, selectionStore);
  const left = createLeftSidebar(resourceStore, operationStore, connectionStore);
  const right = createRightSidebar(resourceStore, operationStore, connectionStore, selectionStore);
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
    connectionStore,
    selectionStore,
    onFocusModeChange: (active) => shell.classList.toggle('app-shell--canvas-focus', active),
  });
  body.append(left.element, leftToggle, workspace.element, rightToggle, right.element);
  shell.append(titleBar.element, createRibbon(), body, statusBar.element);
  const updateStatus = (): void => {
    const selected = selectionStore.getSelection();
    const label = selected.kind === 'resource' ? `Resource ${resourceStore.getResource(selected.id)?.name ?? selected.id}` : selected.kind === 'operation' ? `Operation OP ${operationStore.getOperation(selected.id)?.sequence ?? selected.id}` : selected.kind === 'connection' ? `Connection ${selected.id}` : '0';
    statusBar.setSelectionLabel(label);
    statusBar.setResourceCount(resourceStore.getResourceCount());
    statusBar.setOperationCount(operationStore.getOperationCount());
    statusBar.setConnectionCount(connectionStore.getConnectionCount());
    const operationHealth = validateOperations(operationStore.getOperations(), (id) => Boolean(resourceStore.getResource(id)));
    const connectionHealth = validateProcessConnections(operationStore.getOperations(), connectionStore.getConnections());
    statusBar.setHealth(operationHealth.errors + connectionHealth.errors, operationHealth.warnings + connectionHealth.warnings); titleBar.setHealth(operationHealth.errors + connectionHealth.errors, operationHealth.warnings + connectionHealth.warnings);
  };
  const unsubscribeResourceStatus = resourceStore.subscribe((change) => {
    if (change.kind === 'updated' || change.kind === 'deleted') operationStore.handleResourceChange(change.kind === 'deleted' ? change.resourceId : change.resource.id, change.kind === 'deleted');
    if (change.kind === 'created' || change.kind === 'updated' || change.kind === 'deleted') connectionStore.recalculateAll();
    updateStatus();
  });
  const unsubscribeOperationStatus = operationStore.subscribe((change) => { if (change.kind === 'deleted') { connectionStore.deleteForOperation(change.operationId); connectionStore.recalculateAll(); } else if (change.kind === 'created' || change.kind === 'updated') connectionStore.recalculateAll(); updateStatus(); });
  const unsubscribeConnectionStatus = connectionStore.subscribe(updateStatus); const unsubscribeSelectionStatus = selectionStore.subscribe(updateStatus); updateStatus();
  return {
    element: shell,
    statusBar,
    dispose: () => {
      unsubscribeResourceStatus(); unsubscribeOperationStatus(); unsubscribeConnectionStatus(); unsubscribeSelectionStatus();
      left.dispose();
      right.dispose();
      workspace.dispose();
      connectionStore.dispose(); operationStore.dispose(); resourceStore.dispose();
    },
  };
}

