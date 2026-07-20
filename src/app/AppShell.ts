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
import { WorkspaceStore } from '../services/WorkspaceStore';
import { validateResources } from '../services/ResourceValidation';
import { createResourceDeletionDialog } from '../components/workspace/resources/ResourceDeletionDialog';
import { ProjectSessionService } from '../services/project/ProjectSessionService';
import { ProjectFileService } from '../services/project/ProjectFileService';
import { ProjectFileController } from '../services/project/ProjectFileController';
import { createProjectDialogs } from '../components/project/ProjectDialogs';
import { CommandHistoryService } from '../services/history/CommandHistoryService';
import { CommandFactory } from '../services/history/CommandFactory';
import { HistoryController } from '../services/history/HistoryController';

export interface AppShellResult {
  readonly element: HTMLElement;
  readonly statusBar: StatusBarController;
  dispose(): void;
}

export function createAppShell(): AppShellResult {
  const shell = element('div', 'app-shell');
  const body = element('div', 'app-body');
  const selectionStore = new SelectionStore();
  const resourceIds = new ResourceIdGenerator(); const operationIds = new OperationIdGenerator(); const connectionIds = new ConnectionIdGenerator();
  const resourceStore = new ResourceStore(RESOURCE_TEMPLATES, resourceIds, selectionStore);
  const operationStore = new OperationStore(OPERATION_TEMPLATES, operationIds, selectionStore);
  const workspaceStore = new WorkspaceStore();
  let projectSession: ProjectSessionService | null = null;
  const connectionStore = new ConnectionStore(connectionIds, (id) => operationStore.getOperation(id), (connection) => {
    const source = operationStore.getOperation(connection.sourceOperationId); const target = operationStore.getOperation(connection.targetOperationId);
    if (!source || !target) return { points: [], status: 'fallback' };
    const obstacles = operationStore.getOperations().filter((operation) => operation.visible && operation.id !== source.id && operation.id !== target.id).map(operationBounds);
    const route = routeOrthogonal({ source: anchorWorldPosition(source, connection.sourceAnchor), sourceDirection: anchorDirection(connection.sourceAnchor), target: anchorWorldPosition(target, connection.targetAnchor), targetDirection: anchorDirection(connection.targetAnchor), obstacles, clearance: projectSession?.getSettings().routingClearance ?? 16 });
    return { points: route.points, status: route.fallback ? 'fallback' : 'clear' };
  }, selectionStore);
  projectSession = new ProjectSessionService(resourceStore, operationStore, connectionStore, workspaceStore, selectionStore, resourceIds, operationIds, connectionIds);
  const commandContext = { resources: resourceStore, operations: operationStore, connections: connectionStore, project: projectSession, selection: selectionStore };
  const history = new CommandHistoryService(commandContext, 200); projectSession.attachHistory(history); const commands = new CommandFactory(history, commandContext);
  const statusBar = createStatusBar();
  const titleBar = createTitleBar();
  const projectDialogs = createProjectDialogs(); const deletionDialog = createResourceDeletionDialog(resourceStore, operationStore, commands, statusBar.setMessage); shell.append(projectDialogs.element, deletionDialog.element);
  const requestResourceDeletion = (id: string): void => deletionDialog.request(id);
  const left = createLeftSidebar(resourceStore, operationStore, connectionStore, workspaceStore, projectSession, selectionStore, commands);
  const right = createRightSidebar(resourceStore, operationStore, connectionStore, workspaceStore, selectionStore, requestResourceDeletion, projectSession, commands);
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
    workspaceStore,
    selectionStore,
    commands,
    requestResourceDeletion,
    onFocusModeChange: (active) => shell.classList.toggle('app-shell--canvas-focus', active),
  });
  body.append(left.element, leftToggle, workspace.element, rightToggle, right.element);
  const ribbon = createRibbon(workspaceStore); const historyController = new HistoryController(history, shell, workspace.cancelActiveInteractions, statusBar.setMessage); ribbon.setHistoryCommands(historyController); const projectFiles = new ProjectFileController(projectSession, new ProjectFileService(), projectDialogs, ribbon.setFileBusy, workspace.cancelActiveInteractions); ribbon.setFileCommands(projectFiles);
  shell.append(titleBar.element, ribbon.element, body, statusBar.element);
  const updateStatus = (): void => {
    const selected = selectionStore.getSelection();
    const label = selected.kind === 'project' ? `Project ${projectSession.getMetadata().name}` : selected.kind === 'resource' ? `Resource ${resourceStore.getResource(selected.id)?.name ?? selected.id}` : selected.kind === 'operation' ? `Operation OP ${operationStore.getOperation(selected.id)?.sequence ?? selected.id}` : selected.kind === 'connection' ? `Connection ${selected.id}` : '0';
    statusBar.setSelectionLabel(label);
    statusBar.setResourceCount(resourceStore.getResourceCount());
    statusBar.setOperationCount(operationStore.getOperationCount());
    statusBar.setConnectionCount(connectionStore.getConnectionCount());
    const operationHealth = validateOperations(operationStore.getOperations(), (id) => resourceStore.getResource(id), (id) => Boolean(resourceStore.getTemplate(id)));
    const resourceHealth = validateResources(resourceStore.getPlacedResources(), resourceStore.getTemplates(), (id) => operationStore.getAssignmentCount(id));
    const connectionHealth = validateProcessConnections(operationStore.getOperations(), connectionStore.getConnections());
    const errors = operationHealth.errors + resourceHealth.errors + connectionHealth.errors; const warnings = operationHealth.warnings + resourceHealth.warnings + connectionHealth.warnings;
    statusBar.setHealth(errors, warnings); titleBar.setHealth(errors, warnings);
  };
  const unsubscribeResourceStatus = resourceStore.subscribe((change) => {
    if (change.kind === 'deleted') operationStore.unassignResource(change.resourceId); else if (change.kind === 'updated') operationStore.handleResourceChange(change.resource.id, false);
    updateStatus();
  });
  const unsubscribeOperationStatus = operationStore.subscribe((change) => { if (change.kind === 'deleted') { connectionStore.deleteForOperation(change.operationId); connectionStore.recalculateAll(); } else if (change.kind === 'created' || change.kind === 'updated') connectionStore.recalculateAll(); updateStatus(); });
  const unsubscribeConnectionStatus = connectionStore.subscribe(updateStatus); const unsubscribeSelectionStatus = selectionStore.subscribe(updateStatus); updateStatus();
  const unsubscribeHistory = history.subscribe(statusBar.setHistory); statusBar.setHistory(history.getState());
  const unsubscribeProject = projectSession.subscribe((state) => { titleBar.setProject(state.metadata.name, state.dirty, state.fileName); statusBar.setProject(state.metadata.name, state.dirty); updateStatus(); }); const initialProject = projectSession.getState(); titleBar.setProject(initialProject.metadata.name, initialProject.dirty, initialProject.fileName); statusBar.setProject(initialProject.metadata.name, initialProject.dirty);
  return {
    element: shell,
    statusBar,
    dispose: () => {
      unsubscribeResourceStatus(); unsubscribeOperationStatus(); unsubscribeConnectionStatus(); unsubscribeSelectionStatus(); unsubscribeProject(); unsubscribeHistory();
      left.dispose();
      right.dispose();
      workspace.dispose();
      deletionDialog.dispose();
      projectFiles.dispose(); historyController.dispose(); projectDialogs.dispose(); ribbon.dispose(); projectSession.dispose();
      connectionStore.dispose(); operationStore.dispose(); resourceStore.dispose();
    },
  };
}

