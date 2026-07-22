import { CANCEL_ACTIVE_INTERACTIONS_EVENT, CANVAS_COMMAND_EVENT, type CanvasCommand } from '../../../core/events/uiEvents';
import { createCanvasState } from '../../../models/canvas/CanvasState';
import type { ResourceStore } from '../../../services/ResourceStore';
import type { OperationStore } from '../../../services/OperationStore';
import type { SelectionController } from '../../../models/selection/Selection';
import type { ConnectionStore } from '../../../services/ConnectionStore';
import type { WorkspaceId } from '../../../models/workspace/Workspace';
import type { WorkspaceStore } from '../../../services/WorkspaceStore';
import { SnapService } from '../../../services/SnapService';
import { element } from '../../../ui/dom';
import {
  RESOURCE_DRAG_ENDED_EVENT,
  RESOURCE_DRAG_MOVED_EVENT,
  RESOURCE_DRAG_STARTED_EVENT,
  RESOURCE_KEYBOARD_PLACE_EVENT,
  RESOURCE_REVEAL_EVENT,
  type ResourceDragDetail,
} from '../../../core/events/resourceEvents';
import { ResourceInteractionController } from '../resources/ResourceInteractionController';
import { ResourceRenderer } from '../resources/ResourceRenderer';
import { OperationRenderer } from '../operations/OperationRenderer';
import { OperationInteractionController } from '../operations/OperationInteractionController';
import { ConnectionRenderer } from '../connections/ConnectionRenderer';
import { ConnectionInteractionController } from '../connections/ConnectionInteractionController';
import { anchorDirection, anchorWorldPosition, operationBounds } from '../../../services/ConnectionAnchors';
import { routeOrthogonal } from '../../../services/OrthogonalRouter';
import { CONNECTION_REVEAL_EVENT } from '../../../core/events/connectionEvents';
import {
  OPERATION_DRAG_ENDED_EVENT, OPERATION_DRAG_MOVED_EVENT, OPERATION_DRAG_STARTED_EVENT,
  OPERATION_KEYBOARD_PLACE_EVENT, OPERATION_REVEAL_EVENT, type OperationDragDetail,
} from '../../../core/events/operationEvents';
import { CanvasInteractionController } from './CanvasInteractionController';
import { createCanvasToolbar, type CanvasToolbarCommand } from './CanvasToolbar';
import { EngineeringGrid } from './EngineeringGrid';
import { centreOrigin, screenToWorld, zoomAroundPoint, type Point, type ViewportSize } from './ViewportTransform';
import type { CommandFactory } from '../../../services/history/CommandFactory';
import type { ApplicationClipboardService } from '../../../services/editing/ApplicationClipboardService';
import { normalizeRectangle, polylineIntersectsRectangle, rectanglesIntersect } from '../../../services/selection/MarqueeGeometry';
import type { GeometrySelectionService } from '../../../services/geometry/GeometrySelectionService';
import type { GeometryEditingService, GeometryCommand } from '../../../services/geometry/GeometryEditingService';
import type { GeometryCommandFactory } from '../../../services/history/GeometryCommandFactory';
import { AlignmentGuideController } from './AlignmentGuideController';
import { SelectionOverlayRenderer } from './SelectionOverlayRenderer';
import { ResizeInteractionController } from './ResizeInteractionController';
import { ResourceRotationController } from '../resources/ResourceRotationController';
import { clearancePolygon, footprintPolygon, polygonAabb } from '../../../services/geometry/FactoryFootprintGeometry';

const arrangementCommands = new Set<CanvasCommand>(['align-left', 'align-centre-x', 'align-right', 'align-top', 'align-centre-y', 'align-bottom', 'distribute-x', 'distribute-y', 'equal-gaps-x', 'equal-gaps-y', 'match-width', 'match-height', 'match-size']);
const isGeometryCommand = (command: CanvasToolbarCommand | CanvasCommand): command is GeometryCommand => arrangementCommands.has(command as CanvasCommand);

export interface CanvasViewportCallbacks {
  readonly onZoomChange: (zoom: number) => void;
  readonly onGridVisibilityChange: (visible: boolean) => void;
  readonly onCoordinatesChange: (point: Point | null) => void;
  readonly onFocusModeChange: (active: boolean) => void;
  readonly onStatusChange: (message: string) => void;
  readonly onSnapChange: (enabled: boolean) => void;
  readonly onToolChange: (tool: string) => void;
  readonly onWorkspaceChange: (workspace: WorkspaceId) => void;
  readonly requestResourceDeletion: (resourceId: string) => void;
}

export interface CanvasViewportController {
  readonly element: HTMLElement;
  cancelActiveInteractions(): void;
  dispose(): void;
}

export function createCanvasViewport(application: HTMLElement, resourceStore: ResourceStore, operationStore: OperationStore, connectionStore: ConnectionStore, workspaceStore: WorkspaceStore, selectionStore: SelectionController, commands: CommandFactory, editing: ApplicationClipboardService, geometrySelection: GeometrySelectionService, geometryEditing: GeometryEditingService, geometryCommands: GeometryCommandFactory, callbacks: CanvasViewportCallbacks): CanvasViewportController {
  const state = createCanvasState();
  const snap = new SnapService();
  const workspace = element('main', 'workspace');
  const workspaceHeader = element('div', 'workspace-header'); const workspaceTabs = element('div', 'workspace-tabs'); workspaceTabs.setAttribute('role', 'tablist'); workspaceTabs.setAttribute('aria-label', 'Engineering workspace'); const canvasTitle = element('strong', 'workspace-title', 'Process Flow');
  const processTab = element('button', 'workspace-tab', 'Process Flow'); const layoutTab = element('button', 'workspace-tab', 'Factory Layout'); for (const tab of [processTab, layoutTab]) tab.setAttribute('role', 'tab'); workspaceTabs.append(processTab, layoutTab); workspaceHeader.append(workspaceTabs, canvasTitle);
  const viewport = element('section', 'canvas-viewport');
  viewport.tabIndex = 0;
  viewport.setAttribute('role', 'application');
  viewport.setAttribute('aria-label', 'Manufacturing engineering canvas. Use the mouse wheel to zoom and middle mouse or Space plus drag to pan.');
  const grid = new EngineeringGrid();
  const scaleReference = element('output', 'canvas-scale', 'World origin centred');
  const marquee = element('div', 'canvas-marquee'); marquee.hidden = true;
  const editingMenu = element('div', 'resource-context-menu'); editingMenu.setAttribute('role', 'menu'); editingMenu.hidden = true;
  viewport.append(grid.svg, marquee, scaleReference, editingMenu);

  let size: ViewportSize = { width: 1, height: 1 };
  let initialised = false;
  let renderFrame = 0;
  let focusMode = false;
  let temporaryPan = false;
  let activeWorkspace: WorkspaceId = workspaceStore.getActive();
  let selectionOverlay: SelectionOverlayRenderer | null = null;
  let resizeInteraction: ResizeInteractionController | null = null;
  let rotationInteraction: ResourceRotationController | null = null;
  let clearanceVisible = true;

  const saveViewport = (): void => workspaceStore.updateViewport(activeWorkspace, { panX: state.panX, panY: state.panY, zoom: state.zoom, gridVisible: state.gridVisible, originVisible: state.originVisible, snapEnabled: snap.enabled });
  const loadViewport = (workspaceId: WorkspaceId): void => { const stored = workspaceStore.getViewport(workspaceId); Object.assign(state, { panX: stored.panX, panY: stored.panY, zoom: stored.zoom, gridVisible: stored.gridVisible, originVisible: stored.originVisible, tool: 'select' }); snap.enabled = stored.snapEnabled; };

  const requestRender = (): void => {
    if (renderFrame !== 0) return;
    renderFrame = requestAnimationFrame(() => {
      renderFrame = 0;
      grid.render(state, size);
      toolbar.setZoom(state.zoom);
      toolbar.setTool(state.tool);
      toolbar.setGridVisible(state.gridVisible);
      toolbar.setOriginVisible(state.originVisible);
      toolbar.setSnapEnabled(snap.enabled);
      toolbar.setFocusMode(focusMode);
      toolbar.setClearanceVisible(clearanceVisible);
      connectionInteraction?.viewportChanged();
      selectionOverlay?.setTool(state.tool);
      selectionOverlay?.viewportChanged();
      viewport.classList.toggle('canvas-viewport--pan-tool', state.tool === 'pan' || temporaryPan);
      callbacks.onZoomChange(state.zoom);
      callbacks.onGridVisibilityChange(state.gridVisible);
      callbacks.onSnapChange(snap.enabled);
      callbacks.onToolChange(state.tool === 'delete-link' ? 'Delete Link' : `${state.tool.charAt(0).toUpperCase()}${state.tool.slice(1)}`);
      saveViewport();
    });
  };

  const zoomBy = (factor: number, anchor: Point = { x: size.width / 2, y: size.height / 2 }): void => {
    zoomAroundPoint(state, state.zoom * factor, anchor);
    callbacks.onStatusChange(`Canvas zoom ${Math.round(state.zoom * 100)}%`);
    requestRender();
  };

  const runCommand = (command: CanvasToolbarCommand | CanvasCommand): void => {
    if (isGeometryCommand(command)) { const result = geometryEditing.run(command); callbacks.onStatusChange(result.message); requestRender(); return; }
    switch (command) {
      case 'select':
        state.tool = 'select';
        callbacks.onStatusChange('Select tool active');
        break;
      case 'pan':
        state.tool = state.tool === 'pan' ? 'select' : 'pan';
        callbacks.onStatusChange(state.tool === 'pan' ? 'Pan tool active' : 'Select tool active');
        break;
      case 'connect':
        if (activeWorkspace !== 'processFlow') { state.tool = 'select'; callbacks.onStatusChange('Connect is available only in Process Flow'); break; }
        state.tool = state.tool === 'connect' ? 'select' : 'connect';
        break;
      case 'delete-link':
        if (activeWorkspace !== 'processFlow') { state.tool = 'select'; callbacks.onStatusChange('Delete Link is available only in Process Flow'); break; }
        state.tool = state.tool === 'delete-link' ? 'select' : 'delete-link';
        callbacks.onStatusChange(state.tool === 'delete-link' ? 'Delete Link mode active' : 'Select tool active');
        break;
      case 'zoom-in':
        zoomBy(1.2);
        return;
      case 'zoom-out':
        zoomBy(1 / 1.2);
        return;
      case 'actual-size':
        zoomAroundPoint(state, 1, { x: size.width / 2, y: size.height / 2 });
        callbacks.onStatusChange('Canvas reset to 100%');
        break;
      case 'fit':
        fitActiveWorkspace(true);
        callbacks.onStatusChange(`${activeWorkspace === 'processFlow' ? 'Process Flow' : 'Factory Layout'} fitted to viewport`);
        break;
      case 'fit-layout':
        if (activeWorkspace !== 'factoryLayout') { callbacks.onStatusChange('Fit Layout is available only in Factory Layout'); break; }
        fitActiveWorkspace(false); callbacks.onStatusChange('Factory footprints fitted to viewport'); break;
      case 'fit-clearance':
        if (activeWorkspace !== 'factoryLayout') { callbacks.onStatusChange('Fit Including Clearance is available only in Factory Layout'); break; }
        fitActiveWorkspace(true); callbacks.onStatusChange('Factory footprints and clearance fitted to viewport'); break;
      case 'toggle-clearance':
        if (activeWorkspace !== 'factoryLayout') { callbacks.onStatusChange('Clearance envelopes are available only in Factory Layout'); break; }
        clearanceVisible = !clearanceVisible; resourceRenderer.setClearanceVisible(clearanceVisible); callbacks.onStatusChange(`Clearance envelopes ${clearanceVisible ? 'shown' : 'hidden'}`); break;
      case 'rotate-left': case 'rotate-right': case 'rotation-reset': {
        if (activeWorkspace !== 'factoryLayout') { callbacks.onStatusChange('Resource rotation is available only in Factory Layout'); break; }
        const resource = resourceStore.getSelectedResource(); if (!resource) { callbacks.onStatusChange('Select one resource to rotate'); break; } if (resource.locked) { callbacks.onStatusChange('Resource is locked'); break; }
        const rotationDegrees = command === 'rotation-reset' ? 0 : resource.rotationDegrees + (command === 'rotate-left' ? -90 : 90); commands.updateResource(resource.id, { rotationDegrees }, `Rotate resource ${resource.id}`); callbacks.onStatusChange(`Resource rotated to ${resourceStore.getResource(resource.id)?.rotationDegrees ?? rotationDegrees}°`); break;
      }
      case 'grid':
        state.gridVisible = !state.gridVisible;
        callbacks.onStatusChange(`Grid ${state.gridVisible ? 'enabled' : 'disabled'}`);
        break;
      case 'origin':
        state.originVisible = !state.originVisible;
        callbacks.onStatusChange(`Origin ${state.originVisible ? 'shown' : 'hidden'}`);
        break;
      case 'snap':
        callbacks.onStatusChange(`Snap ${snap.toggle() ? 'enabled' : 'disabled'}`);
        break;
      case 'delete-selection':
        { const result = editing.deleteSelection((message) => window.confirm(message)); callbacks.onStatusChange(result.message); }
        break;
      case 'copy': { const result = editing.copy(); callbacks.onStatusChange(result.message); break; }
      case 'cut': { const result = editing.cut((message) => window.confirm(message)); callbacks.onStatusChange(result.message); break; }
      case 'paste': { const result = editing.paste(); callbacks.onStatusChange(result.message); break; }
      case 'duplicate': { const result = editing.duplicate(); callbacks.onStatusChange(result.message); break; }
      case 'select-all': { const result = editing.selectAll(); callbacks.onStatusChange(result.message); break; }
      case 'clear-selection':
        selectionStore.clear();
        callbacks.onStatusChange('Selection cleared');
        break;
      case 'add-operation':
        if (activeWorkspace !== 'processFlow') { callbacks.onStatusChange('Add Operation is available in Process Flow'); break; }
        placeOperation(operationStore.getTemplates()[0]?.id ?? '', { x: size.width / 2, y: size.height / 2 }, false);
        viewport.focus({ preventScroll: true });
        break;
      case 'add-resource':
        if (activeWorkspace !== 'factoryLayout') { callbacks.onStatusChange('Add Resource is available in Factory Layout'); break; }
        placeTemplate(resourceStore.getTemplates()[0]?.id ?? '', { x: size.width / 2, y: size.height / 2 }, false); viewport.focus({ preventScroll: true }); break;
      case 'focus':
        focusMode = !focusMode;
        callbacks.onFocusModeChange(focusMode);
        callbacks.onStatusChange(`Canvas Focus ${focusMode ? 'enabled' : 'disabled'}`);
        break;
    }
    if (command === 'select' || command === 'pan' || command === 'connect' || command === 'delete-link') { resourceInteraction?.cancelActiveDrag(); operationInteraction?.cancelActiveDrag(); connectionInteraction?.toolChanged(); }
    requestRender();
  };

  const toolbar = createCanvasToolbar(runCommand);
  workspace.append(workspaceHeader, toolbar.element, viewport);

  const resourceRenderer = new ResourceRenderer(grid.getObjectLayer(), resourceStore);
  const operationRenderer = new OperationRenderer(grid.getOperationLayer(), operationStore, resourceStore);
  const connectionRenderer = new ConnectionRenderer(grid.getConnectionLayer(), connectionStore, operationStore);
  const guides = new AlignmentGuideController(grid.getInteractionLayer(), state, operationStore, resourceStore);
  let resourceInteraction: ResourceInteractionController | null = new ResourceInteractionController(
    viewport,
    application,
    state,
    resourceStore,
    snap,
    callbacks.onStatusChange,
    commands,
    selectionStore,
    editing,
    guides,
    geometryEditing,
  );
  rotationInteraction = new ResourceRotationController(viewport, state, resourceStore, commands, callbacks.onStatusChange);
  let operationInteraction: OperationInteractionController | null = new OperationInteractionController(viewport, state, operationStore, snap, callbacks.onStatusChange, commands, selectionStore, guides);
  const previewRoute = (sourceId: string, targetId: string, sourceAnchor: import('../../../models/connections/ProcessConnection').OperationAnchor, targetAnchor: import('../../../models/connections/ProcessConnection').OperationAnchor) => {
    const source = operationStore.getOperation(sourceId); const target = operationStore.getOperation(targetId); if (!source || !target) return { points: [], status: 'fallback' as const };
    const obstacles = operationStore.getOperations().filter((operation) => operation.visible && operation.id !== sourceId && operation.id !== targetId).map(operationBounds);
    const route = routeOrthogonal({ source: anchorWorldPosition(source, sourceAnchor), sourceDirection: anchorDirection(sourceAnchor), target: anchorWorldPosition(target, targetAnchor), targetDirection: anchorDirection(targetAnchor), obstacles, clearance: 16 }); return { points: route.points, status: route.fallback ? 'fallback' as const : 'clear' as const };
  };
  let connectionInteraction: ConnectionInteractionController | null = new ConnectionInteractionController(viewport, application, state, operationStore, connectionStore, commands, selectionStore, editing, grid.getInteractionLayer(), { setTool: (tool) => { if (state.tool !== tool) runCommand(tool); }, onStatus: callbacks.onStatusChange, routePreview: previewRoute });
  selectionOverlay = new SelectionOverlayRenderer(grid.getInteractionLayer(), state, geometrySelection, selectionStore, operationStore, resourceStore);
  resizeInteraction = new ResizeInteractionController(viewport, state, geometrySelection, operationStore, resourceStore, snap, geometryCommands, guides, callbacks.onStatusChange);

  const interaction = new CanvasInteractionController(viewport, application, {
    getZoom: () => state.zoom,
    shouldPanWithPrimaryButton: () => state.tool === 'pan',
    onPan: (delta) => {
      state.panX += delta.x;
      state.panY += delta.y;
      requestRender();
    },
    onZoom: (requestedZoom, anchor) => {
      zoomAroundPoint(state, requestedZoom, anchor);
      requestRender();
    },
    onPointerWorldPosition: (point) => callbacks.onCoordinatesChange(point ? screenToWorld(point, state) : null),
    onTemporaryPanChange: (active) => {
      temporaryPan = active;
      requestRender();
    },
    onKeyboardCommand: runCommand,
  });

  function fitActiveWorkspace(includeClearance = true): void {
    const points: Point[] = [];
    if (activeWorkspace === 'processFlow') {
      operationStore.getOperations().filter((item) => item.visible).forEach((item) => points.push({ x: item.worldX - item.width / 2, y: item.worldY - item.height / 2 }, { x: item.worldX + item.width / 2, y: item.worldY + item.height / 2 }));
      connectionStore.getConnections().filter((connection) => connection.visible).forEach((connection) => points.push(...connection.routePoints));
    } else resourceStore.getPlacedResources().filter((item) => item.visible).forEach((item) => points.push(...(includeClearance && item.clearance.enabled ? clearancePolygon(item) : footprintPolygon(item))));
    if (!points.length) { centreOrigin(state, size, 1); return; } const minX = Math.min(...points.map((p) => p.x)); const maxX = Math.max(...points.map((p) => p.x)); const minY = Math.min(...points.map((p) => p.y)); const maxY = Math.max(...points.map((p) => p.y)); const padding = 60; state.zoom = Math.min(state.maxZoom, Math.max(state.minZoom, Math.min((size.width - padding * 2) / Math.max(1, maxX - minX), (size.height - padding * 2) / Math.max(1, maxY - minY)))); state.panX = size.width / 2 - (minX + maxX) / 2 * state.zoom; state.panY = size.height / 2 - (minY + maxY) / 2 * state.zoom;
  }

  const isInsideViewport = (clientX: number, clientY: number): boolean => {
    const bounds = viewport.getBoundingClientRect();
    return clientX >= bounds.left && clientX <= bounds.right && clientY >= bounds.top && clientY <= bounds.bottom;
  };

  const placeTemplate = (templateId: string, viewportPoint: Point, bypassSnap: boolean): void => {
    const worldPoint = snap.snapPoint(screenToWorld(viewportPoint, state), bypassSnap);
    const resource = commands.addResource(templateId, worldPoint.x, worldPoint.y);
    if (resource) callbacks.onStatusChange(`Resource placed: ${resource.name}`);
  };
  function placeOperation(templateId: string, viewportPoint: Point, bypassSnap: boolean): void {
    const worldPoint = snap.snapPoint(screenToWorld(viewportPoint, state), bypassSnap);
    const operation = commands.addOperation(templateId, worldPoint.x, worldPoint.y);
    if (operation) callbacks.onStatusChange(`Operation placed: OP ${operation.sequence} ${operation.name}`);
  }

  const handleResourceDrag = (event: Event): void => {
    const detail = (event as CustomEvent<ResourceDragDetail>).detail;
    const inside = activeWorkspace === 'factoryLayout' && !detail.cancelled && isInsideViewport(detail.clientX, detail.clientY);
    viewport.classList.toggle('canvas-viewport--drop-target', inside);
    if (event.type !== RESOURCE_DRAG_ENDED_EVENT) return;
    viewport.classList.remove('canvas-viewport--drop-target');
    if (!inside) return;
    const bounds = viewport.getBoundingClientRect();
    placeTemplate(detail.templateId, { x: detail.clientX - bounds.left, y: detail.clientY - bounds.top }, detail.altKey);
  };

  const handleKeyboardPlacement = (event: Event): void => {
    if (activeWorkspace !== 'factoryLayout') { callbacks.onStatusChange('Resource templates can only be placed in Factory Layout'); return; }
    placeTemplate((event as CustomEvent<string>).detail, { x: size.width / 2, y: size.height / 2 }, false);
    viewport.focus({ preventScroll: true });
  };
  document.addEventListener(RESOURCE_DRAG_STARTED_EVENT, handleResourceDrag);
  document.addEventListener(RESOURCE_DRAG_MOVED_EVENT, handleResourceDrag);
  document.addEventListener(RESOURCE_DRAG_ENDED_EVENT, handleResourceDrag);
  document.addEventListener(RESOURCE_KEYBOARD_PLACE_EVENT, handleKeyboardPlacement);
  const handleOperationDrag = (event: Event): void => {
    const detail = (event as CustomEvent<OperationDragDetail>).detail;
    const inside = activeWorkspace === 'processFlow' && !detail.cancelled && isInsideViewport(detail.clientX, detail.clientY);
    viewport.classList.toggle('canvas-viewport--drop-target', inside);
    if (event.type !== OPERATION_DRAG_ENDED_EVENT) return;
    viewport.classList.remove('canvas-viewport--drop-target'); if (!inside) return;
    const bounds = viewport.getBoundingClientRect(); placeOperation(detail.templateId, { x: detail.clientX - bounds.left, y: detail.clientY - bounds.top }, detail.altKey);
  };
  const handleOperationKeyboardPlacement = (event: Event): void => { if (activeWorkspace !== 'processFlow') { callbacks.onStatusChange('Operations can only be placed in Process Flow'); return; } placeOperation((event as CustomEvent<string>).detail, { x: size.width / 2, y: size.height / 2 }, false); viewport.focus({ preventScroll: true }); };
  const handleOperationReveal = (event: Event): void => {
    const operation = operationStore.getOperation((event as CustomEvent<string>).detail); if (!operation) return;
    state.panX = size.width / 2 - operation.worldX * state.zoom; state.panY = size.height / 2 - operation.worldY * state.zoom; requestRender(); callbacks.onStatusChange(`Revealed OP ${operation.sequence}`);
  };
  document.addEventListener(OPERATION_DRAG_STARTED_EVENT, handleOperationDrag); document.addEventListener(OPERATION_DRAG_MOVED_EVENT, handleOperationDrag); document.addEventListener(OPERATION_DRAG_ENDED_EVENT, handleOperationDrag);
  document.addEventListener(OPERATION_KEYBOARD_PLACE_EVENT, handleOperationKeyboardPlacement); document.addEventListener(OPERATION_REVEAL_EVENT, handleOperationReveal);
  const handleConnectionReveal = (event: Event): void => { const connection = connectionStore.getConnection((event as CustomEvent<string>).detail); if (!connection?.routePoints.length) return; const minX = Math.min(...connection.routePoints.map((point) => point.x)); const maxX = Math.max(...connection.routePoints.map((point) => point.x)); const minY = Math.min(...connection.routePoints.map((point) => point.y)); const maxY = Math.max(...connection.routePoints.map((point) => point.y)); state.panX = size.width / 2 - ((minX + maxX) / 2) * state.zoom; state.panY = size.height / 2 - ((minY + maxY) / 2) * state.zoom; requestRender(); callbacks.onStatusChange(`Revealed ${connection.id}`); };
  document.addEventListener(CONNECTION_REVEAL_EVENT, handleConnectionReveal);
  const handleResourceReveal = (event: Event): void => { const resource = resourceStore.getResource((event as CustomEvent<string>).detail); if (!resource) return; state.panX = size.width / 2 - resource.worldX * state.zoom; state.panY = size.height / 2 - resource.worldY * state.zoom; requestRender(); callbacks.onStatusChange(`Revealed ${resource.id}`); };
  document.addEventListener(RESOURCE_REVEAL_EVENT, handleResourceReveal);

  let marqueeState: { readonly pointerId: number; readonly start: Point; readonly additive: boolean; readonly subtractive: boolean; moved: boolean } | null = null;
  const viewportPoint = (event: PointerEvent): Point => { const bounds = viewport.getBoundingClientRect(); return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }; };
  const handleBackgroundSelection = (event: PointerEvent): void => {
    if (event.button !== 0 || state.tool !== 'select') return; const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('[data-resource-id], [data-operation-id], [data-connection-id], button, input, textarea, select')) return;
    marqueeState = { pointerId: event.pointerId, start: viewportPoint(event), additive: event.ctrlKey || event.metaKey || event.shiftKey, subtractive: event.altKey, moved: false }; viewport.setPointerCapture(event.pointerId); event.preventDefault();
  };
  const handleMarqueeMove = (event: PointerEvent): void => { if (!marqueeState || event.pointerId !== marqueeState.pointerId) return; const point = viewportPoint(event); if (Math.hypot(point.x - marqueeState.start.x, point.y - marqueeState.start.y) < 3) return; marqueeState.moved = true; marquee.hidden = false; marquee.style.left = `${Math.min(point.x, marqueeState.start.x)}px`; marquee.style.top = `${Math.min(point.y, marqueeState.start.y)}px`; marquee.style.width = `${Math.abs(point.x - marqueeState.start.x)}px`; marquee.style.height = `${Math.abs(point.y - marqueeState.start.y)}px`; };
  const cancelMarquee = (): void => { const active = marqueeState; marqueeState = null; marquee.hidden = true; if (active && viewport.hasPointerCapture(active.pointerId)) viewport.releasePointerCapture(active.pointerId); };
  const finishMarquee = (event: PointerEvent): void => {
    const active = marqueeState; if (!active || event.pointerId !== active.pointerId) return; marqueeState = null; marquee.hidden = true; if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    if (!active.moved) { if (!active.additive && !active.subtractive) selectionStore.clear(); return; }
    const rectangle = normalizeRectangle(screenToWorld(active.start, state), screenToWorld(viewportPoint(event), state));
    const hits = activeWorkspace === 'factoryLayout'
      ? resourceStore.getPlacedResources().filter((item) => item.visible && rectanglesIntersect(rectangle, polygonAabb(footprintPolygon(item)))).map((item) => ({ kind: 'resource' as const, id: item.id }))
      : [...operationStore.getOperations().filter((item) => item.visible && rectanglesIntersect(rectangle, { minX: item.worldX - item.width / 2, minY: item.worldY - item.height / 2, maxX: item.worldX + item.width / 2, maxY: item.worldY + item.height / 2 })).map((item) => ({ kind: 'operation' as const, id: item.id })), ...connectionStore.getConnections().filter((item) => item.visible && polylineIntersectsRectangle(item.routePoints, rectangle)).map((item) => ({ kind: 'connection' as const, id: item.id }))];
    if (active.subtractive) hits.forEach((item) => selectionStore.remove(item)); else if (active.additive) hits.forEach((item) => selectionStore.add(item)); else selectionStore.set(hits, hits.at(-1)); callbacks.onStatusChange(`Selected ${selectionStore.getState().items.length} items`);
  };
  const handleMarqueeCancel = (event: PointerEvent): void => { if (marqueeState?.pointerId === event.pointerId) cancelMarquee(); };
  viewport.addEventListener('pointerdown', handleBackgroundSelection); viewport.addEventListener('pointermove', handleMarqueeMove); viewport.addEventListener('pointerup', finishMarquee); viewport.addEventListener('pointercancel', handleMarqueeCancel);
  const isTyping = (target: EventTarget | null): boolean => target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable);
  const handleObjectKeyDown = (event: KeyboardEvent): void => {
    if (isTyping(event.target) || !application.contains(document.activeElement)) return;
    const commandKey = event.ctrlKey || event.metaKey; const key = event.key.toLowerCase();
    if (commandKey && ['c', 'x', 'v', 'd', 'a'].includes(key)) { event.preventDefault(); const result = key === 'c' ? editing.copy() : key === 'x' ? editing.cut((message) => window.confirm(message)) : key === 'v' ? editing.paste() : key === 'd' ? editing.duplicate() : editing.selectAll(); callbacks.onStatusChange(result.message); return; }
    if (activeWorkspace === 'factoryLayout' && ['[', ']', '{', '}'].includes(event.key)) { const resource = resourceStore.getSelectedResource(); if (!resource || resource.locked) { callbacks.onStatusChange(resource?.locked ? 'Resource is locked' : 'Select one resource to rotate'); return; } event.preventDefault(); const step = commandKey ? 90 : event.shiftKey ? 15 : 5; const rotatesLeft = event.key === '[' || event.key === '{'; commands.updateResource(resource.id, { rotationDegrees: resource.rotationDegrees + (rotatesLeft ? -step : step) }, `Rotate resource ${resource.id}`); callbacks.onStatusChange(`Resource rotated to ${resourceStore.getResource(resource.id)?.rotationDegrees}°`); requestRender(); return; }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) { const step = commandKey ? geometryEditing.gridInterval() : event.shiftKey ? 10 : 1; const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0; const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0; const result = geometryEditing.nudge(dx, dy); if (result.ok) event.preventDefault(); callbacks.onStatusChange(result.message); requestRender(); return; }
    if (event.key === 'Delete' || event.key === 'Backspace') { if (selectionStore.getState().items.length) event.preventDefault(); runCommand('delete-selection'); return; }
    if (event.key === 'Escape' && marqueeState) { cancelMarquee(); callbacks.onStatusChange('Marquee selection cancelled'); return; }
    if (event.key === 'Escape' && selectionStore.getState().items.length) { selectionStore.clear(); callbacks.onStatusChange('Selection cleared'); }
  };
  document.addEventListener('keydown', handleObjectKeyDown);
  const closeEditingMenu = (): void => { editingMenu.hidden = true; editingMenu.replaceChildren(); };
  const handleEditingContextMenu = (event: MouseEvent): void => { const target = event.target instanceof Element ? event.target : null; if (target?.closest('[data-resource-id], [data-connection-id]')) return; const operationId = target?.closest<SVGGElement>('[data-operation-id]')?.dataset.operationId; if (operationId) { const ref = { kind: 'operation' as const, id: operationId }; if (!selectionStore.contains(ref)) selectionStore.select(ref); } else if (target?.closest('button, input, textarea, select')) return; event.preventDefault(); closeEditingMenu(); const add = (label: string, action: () => { readonly message: string }, disabled = false): void => { const button = element('button', 'resource-context-menu__item', label); button.type = 'button'; button.disabled = disabled; button.setAttribute('role', 'menuitem'); button.addEventListener('click', () => { callbacks.onStatusChange(action().message); closeEditingMenu(); viewport.focus({ preventScroll: true }); }); editingMenu.append(button); }; if (operationId) { add('Cut', () => editing.cut((message) => window.confirm(message))); add('Copy', () => editing.copy()); } add('Paste', () => editing.paste()); if (operationId) { add('Duplicate', () => editing.duplicate()); add('Delete', () => editing.deleteSelection((message) => window.confirm(message))); add('Clear Selection', () => { selectionStore.clear(); return { message: 'Selection cleared' }; }); const arrangements: readonly [string, GeometryCommand][] = [['Align Left', 'align-left'], ['Align Right', 'align-right'], ['Align Top', 'align-top'], ['Align Bottom', 'align-bottom'], ['Distribute Horizontally', 'distribute-x'], ['Distribute Vertically', 'distribute-y'], ['Equal Horizontal Gaps', 'equal-gaps-x'], ['Equal Vertical Gaps', 'equal-gaps-y'], ['Match Width', 'match-width'], ['Match Height', 'match-height'], ['Match Size', 'match-size']]; for (const [label, command] of arrangements) add(label, () => geometryEditing.run(command), !geometryEditing.isAvailable(command)); } const bounds = viewport.getBoundingClientRect(); editingMenu.style.left = `${Math.min(event.clientX - bounds.left, Math.max(0, viewport.clientWidth - 190))}px`; editingMenu.style.top = `${Math.min(event.clientY - bounds.top, Math.max(0, viewport.clientHeight - 380))}px`; editingMenu.hidden = false; editingMenu.querySelector<HTMLButtonElement>('button')?.focus(); };
  const handleEditingMenuOutside = (event: PointerEvent): void => { if (!editingMenu.hidden && event.target instanceof Node && !editingMenu.contains(event.target)) closeEditingMenu(); };
  const handleEditingMenuEscape = (event: KeyboardEvent): void => { if (event.key === 'Escape' && !editingMenu.hidden) { event.preventDefault(); closeEditingMenu(); viewport.focus({ preventScroll: true }); } };
  viewport.addEventListener('contextmenu', handleEditingContextMenu); document.addEventListener('pointerdown', handleEditingMenuOutside, true); document.addEventListener('keydown', handleEditingMenuEscape);

  const resizeObserver = new ResizeObserver((entries) => {
    const bounds = entries[0]?.contentRect;
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;
    size = { width: bounds.width, height: bounds.height };
    if (!initialised) {
      centreOrigin(state, size);
      initialised = true;
    }
    requestRender();
  });
  resizeObserver.observe(viewport);

  const handleGlobalCommand = (event: Event): void => {
    runCommand((event as CustomEvent<CanvasCommand>).detail);
  };
  document.addEventListener(CANVAS_COMMAND_EVENT, handleGlobalCommand);
  const activateWorkspace = (workspaceId: WorkspaceId): void => workspaceStore.activate(workspaceId);
  processTab.addEventListener('click', () => activateWorkspace('processFlow')); layoutTab.addEventListener('click', () => activateWorkspace('factoryLayout'));
  const cancelActiveInteractions = (): void => { cancelMarquee(); resizeInteraction?.cancel(); rotationInteraction?.cancel(); guides.clear(); resourceInteraction?.cancelActiveDrag(); operationInteraction?.cancelActiveDrag(); connectionInteraction?.cancelCreation(); document.dispatchEvent(new Event(CANCEL_ACTIVE_INTERACTIONS_EVENT)); if (state.tool === 'connect' || state.tool === 'delete-link') { state.tool = 'select'; connectionInteraction?.toolChanged(); requestRender(); } };
  const renderWorkspace = (workspaceId: WorkspaceId): void => {
    if (workspaceId !== activeWorkspace) cancelActiveInteractions();
    saveViewport(); activeWorkspace = workspaceId; loadViewport(workspaceId); selectionStore.setWorkspace(workspaceId); grid.setWorkspace(workspaceId); connectionInteraction?.toolChanged();
    const processActive = workspaceId === 'processFlow'; toolbar.setConnectionToolsEnabled(processActive); toolbar.setFactoryToolsEnabled(!processActive); processTab.setAttribute('aria-selected', String(processActive)); layoutTab.setAttribute('aria-selected', String(!processActive)); processTab.tabIndex = processActive ? 0 : -1; layoutTab.tabIndex = processActive ? -1 : 0; canvasTitle.textContent = processActive ? 'Process Flow — Operations' : 'Factory Layout — Physical Resources'; viewport.setAttribute('aria-label', `${processActive ? 'Process Flow' : 'Factory Layout'} engineering canvas. Use the mouse wheel to zoom and middle mouse or Space plus drag to pan.`); callbacks.onWorkspaceChange(workspaceId); callbacks.onStatusChange(`Workspace: ${processActive ? 'Process Flow' : 'Factory Layout'}`); requestRender();
  };
  const unsubscribeWorkspace = workspaceStore.subscribe(renderWorkspace); grid.setWorkspace(activeWorkspace); renderWorkspace(activeWorkspace);
  requestRender();

  return {
    element: workspace,
    cancelActiveInteractions,
    dispose: () => {
      interaction.dispose();
      resourceInteraction?.dispose();
      resourceInteraction = null;
      rotationInteraction?.dispose(); rotationInteraction = null;
      resourceRenderer.dispose();
      operationInteraction?.dispose(); operationInteraction = null; operationRenderer.dispose();
      connectionInteraction?.dispose(); connectionInteraction = null; connectionRenderer.dispose();
      resizeInteraction?.dispose(); resizeInteraction = null; selectionOverlay?.dispose(); selectionOverlay = null; guides.dispose();
      resizeObserver.disconnect();
      unsubscribeWorkspace();
      document.removeEventListener(CANVAS_COMMAND_EVENT, handleGlobalCommand);
      document.removeEventListener(RESOURCE_DRAG_STARTED_EVENT, handleResourceDrag);
      document.removeEventListener(RESOURCE_DRAG_MOVED_EVENT, handleResourceDrag);
      document.removeEventListener(RESOURCE_DRAG_ENDED_EVENT, handleResourceDrag);
      document.removeEventListener(RESOURCE_KEYBOARD_PLACE_EVENT, handleKeyboardPlacement);
      document.removeEventListener(OPERATION_DRAG_STARTED_EVENT, handleOperationDrag); document.removeEventListener(OPERATION_DRAG_MOVED_EVENT, handleOperationDrag); document.removeEventListener(OPERATION_DRAG_ENDED_EVENT, handleOperationDrag);
      document.removeEventListener(OPERATION_KEYBOARD_PLACE_EVENT, handleOperationKeyboardPlacement); document.removeEventListener(OPERATION_REVEAL_EVENT, handleOperationReveal);
      document.removeEventListener(CONNECTION_REVEAL_EVENT, handleConnectionReveal);
      document.removeEventListener(RESOURCE_REVEAL_EVENT, handleResourceReveal);
      viewport.removeEventListener('pointerdown', handleBackgroundSelection); viewport.removeEventListener('pointermove', handleMarqueeMove); viewport.removeEventListener('pointerup', finishMarquee); viewport.removeEventListener('pointercancel', handleMarqueeCancel); document.removeEventListener('keydown', handleObjectKeyDown);
      viewport.removeEventListener('contextmenu', handleEditingContextMenu); document.removeEventListener('pointerdown', handleEditingMenuOutside, true); document.removeEventListener('keydown', handleEditingMenuEscape); editingMenu.remove();
      if (renderFrame !== 0) cancelAnimationFrame(renderFrame);
    },
  };
}

