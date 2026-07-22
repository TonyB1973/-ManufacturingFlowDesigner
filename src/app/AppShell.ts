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
import { ApplicationClipboardService } from '../services/editing/ApplicationClipboardService';
import { GeometrySelectionService } from '../services/geometry/GeometrySelectionService';
import { GeometryEditingService } from '../services/geometry/GeometryEditingService';
import { GeometryCommandFactory } from '../services/history/GeometryCommandFactory';
import { FactoryStructureIdGenerator } from '../utilities/FactoryStructureIdGenerator';
import { FactoryStructureStore } from '../services/FactoryStructureStore';
import { validateFactoryStructure } from '../services/FactoryStructureValidation';
import { FactoryRouteIdGenerator } from '../utilities/FactoryRouteIdGenerator';
import { FactoryRouteStore } from '../services/FactoryRouteStore';
import { FactoryRouteCommandFactory } from '../services/history/FactoryRouteCommandFactory';
import { validateFactoryRoutes } from '../services/FactoryRouteValidation';
import { FactoryAnnotationIdGenerator } from '../utilities/FactoryAnnotationIdGenerator';
import { FactoryAnnotationStore } from '../services/FactoryAnnotationStore';
import { FactoryAnnotationCommandFactory } from '../services/history/FactoryAnnotationCommandFactory';
import { AnnotationAnchorResolver } from '../services/annotations/AnnotationAnchorResolver';
import { validateFactoryAnnotations } from '../services/annotations/FactoryAnnotationValidationService';
import { StandardWorkStudyIdGenerator, StandardWorkEntryIdGenerator } from '../utilities/StandardWorkIdGenerator';
import { StandardWorkStore } from '../services/StandardWorkStore';
import { StandardWorkSelectionStore } from '../services/standardWork/StandardWorkSelectionStore';
import { StandardWorkOperationResolver } from '../services/standardWork/StandardWorkOperationResolver';
import { StandardWorkCommandFactory } from '../services/history/StandardWorkCommandFactory';
import { StandardWorkOperatorCommandFactory } from '../services/history/StandardWorkOperatorCommandFactory';
import { StandardWorkHandoverCommandFactory } from '../services/history/StandardWorkHandoverCommandFactory';
import { createStandardWorkWorkspace } from '../components/workspace/standardWork/StandardWorkWorkspace';
import { validateStandardWork } from '../services/standardWork/StandardWorkValidationService';

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
  const boundaryIds = new FactoryStructureIdGenerator('BND'); const wallIds = new FactoryStructureIdGenerator('WALL'); const areaIds = new FactoryStructureIdGenerator('AREA'); const aisleIds = new FactoryStructureIdGenerator('AISLE');
  const structureStore = new FactoryStructureStore(boundaryIds, wallIds, areaIds, aisleIds);
  const routeIds = new FactoryRouteIdGenerator();
  const routeStore = new FactoryRouteStore(routeIds, { hasResource: (id) => Boolean(resourceStore.getResource(id)), hasArea: (id) => Boolean(structureStore.getArea(id)) });
  const annotationIds = new FactoryAnnotationIdGenerator(); const annotationStore = new FactoryAnnotationStore(annotationIds);
  const standardWorkSelection = new StandardWorkSelectionStore(); const standardWorkStore = new StandardWorkStore(new StandardWorkStudyIdGenerator(), new StandardWorkEntryIdGenerator(), (id) => Boolean(operationStore.getOperation(id)));
  let projectSession: ProjectSessionService | null = null;
  const connectionStore = new ConnectionStore(connectionIds, (id) => operationStore.getOperation(id), (connection) => {
    const source = operationStore.getOperation(connection.sourceOperationId); const target = operationStore.getOperation(connection.targetOperationId);
    if (!source || !target) return { points: [], status: 'fallback' };
    const obstacles = operationStore.getOperations().filter((operation) => operation.visible && operation.id !== source.id && operation.id !== target.id).map(operationBounds);
    const route = routeOrthogonal({ source: anchorWorldPosition(source, connection.sourceAnchor), sourceDirection: anchorDirection(connection.sourceAnchor), target: anchorWorldPosition(target, connection.targetAnchor), targetDirection: anchorDirection(connection.targetAnchor), obstacles, clearance: projectSession?.getSettings().routingClearance ?? 16 });
    return { points: route.points, status: route.fallback ? 'fallback' : 'clear' };
  }, selectionStore);
  projectSession = new ProjectSessionService(resourceStore, operationStore, connectionStore, structureStore, routeStore, annotationStore, workspaceStore, selectionStore, resourceIds, operationIds, connectionIds, routeIds, annotationIds, standardWorkStore, standardWorkSelection);
  const commandContext = { resources: resourceStore, operations: operationStore, connections: connectionStore, structure: structureStore, routes: routeStore, annotations: annotationStore, standardWork: standardWorkStore, standardWorkOperators: projectSession.standardWorkOperators, standardWorkHandovers: projectSession.standardWorkHandovers, standardWorkSelection, project: projectSession, selection: selectionStore };
  const history = new CommandHistoryService(commandContext, 200); projectSession.attachHistory(history); const commands = new CommandFactory(history, commandContext);
  const routeCommands = new FactoryRouteCommandFactory(history, commandContext);
  const annotationCommands = new FactoryAnnotationCommandFactory(history, commandContext); const annotationResolver = new AnnotationAnchorResolver({ resources: resourceStore, structure: structureStore, routes: routeStore });
  const standardWorkCommands = new StandardWorkCommandFactory(history, commandContext); const standardWorkOperatorCommands = new StandardWorkOperatorCommandFactory(history, commandContext); const standardWorkHandoverCommands = new StandardWorkHandoverCommandFactory(history, commandContext); const standardWorkResolver = new StandardWorkOperationResolver(operationStore, resourceStore);
  const geometrySelection = new GeometrySelectionService(selectionStore, workspaceStore, operationStore, resourceStore);
  const geometryCommands = new GeometryCommandFactory(history);
  const geometryEditing = new GeometryEditingService(geometrySelection, geometryCommands, projectSession);
  selectionStore.setValidator((item) => item.kind === 'resource' ? Boolean(resourceStore.getResource(item.id)) : item.kind === 'operation' ? Boolean(operationStore.getOperation(item.id)) : item.kind === 'connection' ? Boolean(connectionStore.getConnection(item.id)) : item.kind === 'boundary' ? Boolean(structureStore.getBoundary(item.id)) : item.kind === 'wall' ? Boolean(structureStore.getWall(item.id)) : item.kind === 'area' ? Boolean(structureStore.getArea(item.id)) : item.kind === 'aisle' ? Boolean(structureStore.getAisle(item.id)) : item.kind === 'factoryRoute' ? Boolean(routeStore.getRoute(item.id)) : Boolean(annotationStore.getAnnotation(item.id)));
  const editing = new ApplicationClipboardService(selectionStore, resourceStore, operationStore, connectionStore, workspaceStore, projectSession, commands, resourceIds, operationIds, connectionIds, structureStore, wallIds, areaIds, aisleIds, routeStore, routeIds, routeCommands, annotationStore, annotationIds);
  const statusBar = createStatusBar();
  const titleBar = createTitleBar();
  const projectDialogs = createProjectDialogs(); const deletionDialog = createResourceDeletionDialog(resourceStore, operationStore, routeStore, annotationStore, commands, statusBar.setMessage); shell.append(projectDialogs.element, deletionDialog.element);
  const requestResourceDeletion = (id: string): void => deletionDialog.request(id);
  const left = createLeftSidebar(resourceStore, operationStore, connectionStore, structureStore, routeStore, annotationStore, annotationResolver, standardWorkStore, standardWorkResolver, standardWorkSelection, workspaceStore, projectSession, selectionStore, commands);
  const right = createRightSidebar(resourceStore, operationStore, connectionStore, structureStore, routeStore, annotationStore, annotationResolver, workspaceStore, selectionStore, requestResourceDeletion, projectSession, commands, routeCommands, annotationCommands, editing, geometrySelection, geometryEditing);
  const leftToggle = actionButton('Hide project and resource panels', 'panel-toggle panel-toggle--left');
  const rightToggle = actionButton('Hide inspector panels', 'panel-toggle panel-toggle--right');
  const standardWorkWorkspace = createStandardWorkWorkspace(standardWorkStore, projectSession.standardWorkOperators, projectSession.standardWorkHandovers, operationStore, resourceStore, standardWorkResolver, standardWorkSelection, standardWorkCommands, standardWorkOperatorCommands, standardWorkHandoverCommands, commands, projectSession, workspaceStore, selectionStore);

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
    structureStore,
    routeStore,
    annotationStore,
    annotationResolver,
    workspaceStore,
    selectionStore,
    commands,
    routeCommands,
    annotationCommands,
    projectSession,
    editing,
    geometrySelection,
    geometryEditing,
    geometryCommands,
    standardWorkPanel: standardWorkWorkspace.element,
    requestResourceDeletion,
    onFocusModeChange: (active) => shell.classList.toggle('app-shell--canvas-focus', active),
  });
  body.append(left.element, leftToggle, workspace.element, rightToggle, right.element);
  const ribbon = createRibbon(workspaceStore, geometryEditing); const historyController = new HistoryController(history, shell, workspace.cancelActiveInteractions, statusBar.setMessage); ribbon.setHistoryCommands(historyController); const projectFiles = new ProjectFileController(projectSession, new ProjectFileService(), projectDialogs, ribbon.setFileBusy, workspace.cancelActiveInteractions); ribbon.setFileCommands(projectFiles);
  shell.append(titleBar.element, ribbon.element, body, statusBar.element);
  const updateStatus = (): void => {
    const selected = selectionStore.getSelection(); const selectionCount = selectionStore.getState().items.length;
    const standardSelected = standardWorkSelection.get(); const standardKind = standardSelected.kind === 'standardWorkStudy' ? 'Study' : standardSelected.kind === 'standardWorkOperator' ? 'Operator' : standardSelected.kind === 'standardWorkHandover' ? 'Handover' : 'Entry'; const label = workspaceStore.getActive() === 'standardWork' && standardSelected.kind !== 'none' ? `${standardKind} ${standardSelected.id}` : selectionCount > 1 ? `${selectionCount} items` : selected.kind === 'project' ? `Project ${projectSession.getMetadata().name}` : selected.kind === 'resource' ? `Resource ${resourceStore.getResource(selected.id)?.name ?? selected.id}` : selected.kind === 'operation' ? `Operation OP ${operationStore.getOperation(selected.id)?.sequence ?? selected.id}` : selected.kind === 'connection' ? `Connection ${selected.id}` : selected.kind === 'factoryAnnotation' ? `Annotation ${selected.id}` : selected.kind === 'none' ? '0' : `${selected.kind} ${selected.id}`;
    statusBar.setSelectionLabel(label);
    statusBar.setResourceCount(resourceStore.getResourceCount());
    statusBar.setOperationCount(operationStore.getOperationCount());
    statusBar.setConnectionCount(connectionStore.getConnectionCount());
    const operationHealth = validateOperations(operationStore.getOperations(), (id) => resourceStore.getResource(id), (id) => Boolean(resourceStore.getTemplate(id)));
    const resourceHealth = validateResources(resourceStore.getPlacedResources(), resourceStore.getTemplates(), (id) => operationStore.getAssignmentCount(id));
    const connectionHealth = validateProcessConnections(operationStore.getOperations(), connectionStore.getConnections());
    const structureHealth = validateFactoryStructure(resourceStore.getPlacedResources(), structureStore); const routeHealth = validateFactoryRoutes({ resources: resourceStore.getPlacedResources(), structure: structureStore, routes: routeStore }); const annotationHealth = validateFactoryAnnotations(annotationStore, annotationResolver); const standardWorkHealth = validateStandardWork(standardWorkStore.getStudies(), standardWorkStore.getEntries(), operationStore, projectSession.standardWorkOperators.getOperators(), projectSession.standardWorkHandovers.getHandovers(), resourceStore); const errors = operationHealth.errors + resourceHealth.errors + connectionHealth.errors + structureHealth.issues.filter((issue) => issue.severity === 'error').length + routeHealth.errors + annotationHealth.errors + standardWorkHealth.errors; const warnings = operationHealth.warnings + resourceHealth.warnings + connectionHealth.warnings + structureHealth.issues.filter((issue) => issue.severity === 'warning').length + routeHealth.warnings + annotationHealth.warnings + standardWorkHealth.warnings;
    statusBar.setHealth(errors, warnings); titleBar.setHealth(errors, warnings);
  };
  const unsubscribeResourceStatus = resourceStore.subscribe((change) => {
    if (change.kind === 'deleted') operationStore.unassignResource(change.resourceId); else if (change.kind === 'updated') operationStore.handleResourceChange(change.resource.id, false);
    updateStatus();
  });
  const unsubscribeOperationStatus = operationStore.subscribe((change) => { if (change.kind === 'deleted') { connectionStore.deleteForOperation(change.operationId); connectionStore.recalculateAll(); } else if (change.kind === 'created' || change.kind === 'updated') connectionStore.recalculateAll(); updateStatus(); });
  const unsubscribeConnectionStatus = connectionStore.subscribe(updateStatus); const unsubscribeStructureStatus = structureStore.subscribe(updateStatus); const unsubscribeRouteStatus = routeStore.subscribe(updateStatus); const unsubscribeAnnotationStatus = annotationStore.subscribe(updateStatus); const unsubscribeStandardWorkStatus = standardWorkStore.subscribe(updateStatus); const unsubscribeStandardWorkOperatorStatus = projectSession.standardWorkOperators.subscribe(updateStatus); const unsubscribeStandardWorkHandoverStatus = projectSession.standardWorkHandovers.subscribe(updateStatus); const unsubscribeStandardWorkSelection = standardWorkSelection.subscribe(updateStatus); const unsubscribeSelectionStatus = selectionStore.subscribe(() => { updateStatus(); geometryEditing.notify(); }); const unsubscribeGeometryResources = resourceStore.subscribe(geometryEditing.notify.bind(geometryEditing)); const unsubscribeGeometryOperations = operationStore.subscribe(geometryEditing.notify.bind(geometryEditing)); const unsubscribeGeometryWorkspace = workspaceStore.subscribe((active) => { geometryEditing.notify(); shell.classList.toggle('app-shell--standard-work', active === 'standardWork'); }); updateStatus();
  const unsubscribeHistory = history.subscribe(statusBar.setHistory); statusBar.setHistory(history.getState());
  const unsubscribeProject = projectSession.subscribe((state) => { titleBar.setProject(state.metadata.name, state.dirty, state.fileName); statusBar.setProject(state.metadata.name, state.dirty); updateStatus(); }); const initialProject = projectSession.getState(); titleBar.setProject(initialProject.metadata.name, initialProject.dirty, initialProject.fileName); statusBar.setProject(initialProject.metadata.name, initialProject.dirty);
  return {
    element: shell,
    statusBar,
    dispose: () => {
      unsubscribeResourceStatus(); unsubscribeOperationStatus(); unsubscribeConnectionStatus(); unsubscribeStructureStatus(); unsubscribeRouteStatus(); unsubscribeAnnotationStatus(); unsubscribeStandardWorkStatus(); unsubscribeStandardWorkOperatorStatus(); unsubscribeStandardWorkHandoverStatus(); unsubscribeStandardWorkSelection(); unsubscribeSelectionStatus(); unsubscribeGeometryResources(); unsubscribeGeometryOperations(); unsubscribeGeometryWorkspace(); unsubscribeProject(); unsubscribeHistory();
      left.dispose();
      right.dispose();
      workspace.dispose();
      standardWorkWorkspace.dispose();
      deletionDialog.dispose();
      projectFiles.dispose(); historyController.dispose(); projectDialogs.dispose(); ribbon.dispose(); projectSession.dispose();
      connectionStore.dispose(); operationStore.dispose(); resourceStore.dispose();
    },
  };
}

