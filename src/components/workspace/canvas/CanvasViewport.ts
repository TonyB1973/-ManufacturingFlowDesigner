import { CANVAS_COMMAND_EVENT, type CanvasCommand } from '../../../core/events/uiEvents';
import { createCanvasState } from '../../../models/canvas/CanvasState';
import type { ResourceStore } from '../../../services/ResourceStore';
import type { OperationStore } from '../../../services/OperationStore';
import type { SelectionController } from '../../../models/selection/Selection';
import type { ConnectionStore } from '../../../services/ConnectionStore';
import { SnapService } from '../../../services/SnapService';
import { element } from '../../../ui/dom';
import {
  RESOURCE_DRAG_ENDED_EVENT,
  RESOURCE_DRAG_MOVED_EVENT,
  RESOURCE_DRAG_STARTED_EVENT,
  RESOURCE_KEYBOARD_PLACE_EVENT,
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

export interface CanvasViewportCallbacks {
  readonly onZoomChange: (zoom: number) => void;
  readonly onGridVisibilityChange: (visible: boolean) => void;
  readonly onCoordinatesChange: (point: Point | null) => void;
  readonly onFocusModeChange: (active: boolean) => void;
  readonly onStatusChange: (message: string) => void;
  readonly onSnapChange: (enabled: boolean) => void;
  readonly onToolChange: (tool: string) => void;
}

export interface CanvasViewportController {
  readonly element: HTMLElement;
  dispose(): void;
}

export function createCanvasViewport(application: HTMLElement, resourceStore: ResourceStore, operationStore: OperationStore, connectionStore: ConnectionStore, selectionStore: SelectionController, callbacks: CanvasViewportCallbacks): CanvasViewportController {
  const state = createCanvasState();
  const snap = new SnapService();
  const workspace = element('main', 'workspace');
  const viewport = element('section', 'canvas-viewport');
  viewport.tabIndex = 0;
  viewport.setAttribute('role', 'application');
  viewport.setAttribute('aria-label', 'Manufacturing engineering canvas. Use the mouse wheel to zoom and middle mouse or Space plus drag to pan.');
  const grid = new EngineeringGrid();
  const scaleReference = element('output', 'canvas-scale', 'World origin centred');
  viewport.append(grid.svg, scaleReference);

  let size: ViewportSize = { width: 1, height: 1 };
  let initialised = false;
  let renderFrame = 0;
  let focusMode = false;
  let temporaryPan = false;

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
      connectionInteraction?.viewportChanged();
      viewport.classList.toggle('canvas-viewport--pan-tool', state.tool === 'pan' || temporaryPan);
      callbacks.onZoomChange(state.zoom);
      callbacks.onGridVisibilityChange(state.gridVisible);
      callbacks.onSnapChange(snap.enabled);
      callbacks.onToolChange(state.tool === 'delete-link' ? 'Delete Link' : `${state.tool.charAt(0).toUpperCase()}${state.tool.slice(1)}`);
    });
  };

  const zoomBy = (factor: number, anchor: Point = { x: size.width / 2, y: size.height / 2 }): void => {
    zoomAroundPoint(state, state.zoom * factor, anchor);
    callbacks.onStatusChange(`Canvas zoom ${Math.round(state.zoom * 100)}%`);
    requestRender();
  };

  const runCommand = (command: CanvasToolbarCommand | CanvasCommand): void => {
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
        state.tool = state.tool === 'connect' ? 'select' : 'connect';
        break;
      case 'delete-link':
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
        fitVisibleObjects();
        callbacks.onStatusChange('Visible project fitted to viewport');
        break;
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
        if (selectionStore.getSelection().kind === 'connection') connectionInteraction?.deleteSelection();
        else if (selectionStore.getSelection().kind === 'operation') operationInteraction?.deleteSelection(); else resourceInteraction?.deleteSelection();
        break;
      case 'clear-selection':
        selectionStore.clear();
        callbacks.onStatusChange('Selection cleared');
        break;
      case 'add-operation':
        placeOperation(operationStore.getTemplates()[0]?.id ?? '', { x: size.width / 2, y: size.height / 2 }, false);
        viewport.focus({ preventScroll: true });
        break;
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
  workspace.append(toolbar.element, viewport);

  const resourceRenderer = new ResourceRenderer(grid.getObjectLayer(), resourceStore);
  const operationRenderer = new OperationRenderer(grid.getOperationLayer(), operationStore, resourceStore);
  const connectionRenderer = new ConnectionRenderer(grid.getConnectionLayer(), connectionStore, operationStore);
  let resourceInteraction: ResourceInteractionController | null = new ResourceInteractionController(
    viewport,
    application,
    state,
    resourceStore,
    snap,
    callbacks.onStatusChange,
  );
  let operationInteraction: OperationInteractionController | null = new OperationInteractionController(viewport, state, operationStore, snap, callbacks.onStatusChange);
  const previewRoute = (sourceId: string, targetId: string, sourceAnchor: import('../../../models/connections/ProcessConnection').OperationAnchor, targetAnchor: import('../../../models/connections/ProcessConnection').OperationAnchor) => {
    const source = operationStore.getOperation(sourceId); const target = operationStore.getOperation(targetId); if (!source || !target) return { points: [], status: 'fallback' as const };
    const obstacles = [...operationStore.getOperations().filter((operation) => operation.visible && operation.id !== sourceId && operation.id !== targetId).map(operationBounds), ...resourceStore.getPlacedResources().filter((resource) => resource.visible).map(operationBounds)];
    const route = routeOrthogonal({ source: anchorWorldPosition(source, sourceAnchor), sourceDirection: anchorDirection(sourceAnchor), target: anchorWorldPosition(target, targetAnchor), targetDirection: anchorDirection(targetAnchor), obstacles, clearance: 16 }); return { points: route.points, status: route.fallback ? 'fallback' as const : 'clear' as const };
  };
  let connectionInteraction: ConnectionInteractionController | null = new ConnectionInteractionController(viewport, application, state, operationStore, connectionStore, grid.getInteractionLayer(), { setTool: (tool) => { if (state.tool !== tool) runCommand(tool); }, onStatus: callbacks.onStatusChange, routePreview: previewRoute });

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

  function fitVisibleObjects(): void {
    const points: Point[] = [];
    resourceStore.getPlacedResources().filter((resource) => resource.visible).forEach((resource) => { points.push({ x: resource.worldX - resource.width / 2, y: resource.worldY - resource.height / 2 }, { x: resource.worldX + resource.width / 2, y: resource.worldY + resource.height / 2 }); });
    operationStore.getOperations().filter((operation) => operation.visible).forEach((operation) => { points.push({ x: operation.worldX - operation.width / 2, y: operation.worldY - operation.height / 2 }, { x: operation.worldX + operation.width / 2, y: operation.worldY + operation.height / 2 }); });
    connectionStore.getConnections().filter((connection) => connection.visible).forEach((connection) => points.push(...connection.routePoints));
    if (!points.length) { centreOrigin(state, size, 1); return; } const minX = Math.min(...points.map((point) => point.x)); const maxX = Math.max(...points.map((point) => point.x)); const minY = Math.min(...points.map((point) => point.y)); const maxY = Math.max(...points.map((point) => point.y)); const padding = 70;
    state.zoom = Math.min(state.maxZoom, Math.max(state.minZoom, Math.min((size.width - padding * 2) / Math.max(1, maxX - minX), (size.height - padding * 2) / Math.max(1, maxY - minY)))); state.panX = size.width / 2 - ((minX + maxX) / 2) * state.zoom; state.panY = size.height / 2 - ((minY + maxY) / 2) * state.zoom;
  }

  const isInsideViewport = (clientX: number, clientY: number): boolean => {
    const bounds = viewport.getBoundingClientRect();
    return clientX >= bounds.left && clientX <= bounds.right && clientY >= bounds.top && clientY <= bounds.bottom;
  };

  const placeTemplate = (templateId: string, viewportPoint: Point, bypassSnap: boolean): void => {
    const worldPoint = snap.snapPoint(screenToWorld(viewportPoint, state), bypassSnap);
    const resource = resourceStore.addResource(templateId, worldPoint.x, worldPoint.y);
    if (resource) callbacks.onStatusChange(`Resource placed: ${resource.name}`);
  };
  function placeOperation(templateId: string, viewportPoint: Point, bypassSnap: boolean): void {
    const worldPoint = snap.snapPoint(screenToWorld(viewportPoint, state), bypassSnap);
    const operation = operationStore.addOperation(templateId, worldPoint.x, worldPoint.y);
    if (operation) callbacks.onStatusChange(`Operation placed: OP ${operation.sequence} ${operation.name}`);
  }

  const handleResourceDrag = (event: Event): void => {
    const detail = (event as CustomEvent<ResourceDragDetail>).detail;
    const inside = !detail.cancelled && isInsideViewport(detail.clientX, detail.clientY);
    viewport.classList.toggle('canvas-viewport--drop-target', inside);
    if (event.type !== RESOURCE_DRAG_ENDED_EVENT) return;
    viewport.classList.remove('canvas-viewport--drop-target');
    if (!inside) return;
    const bounds = viewport.getBoundingClientRect();
    placeTemplate(detail.templateId, { x: detail.clientX - bounds.left, y: detail.clientY - bounds.top }, detail.altKey);
  };

  const handleKeyboardPlacement = (event: Event): void => {
    placeTemplate((event as CustomEvent<string>).detail, { x: size.width / 2, y: size.height / 2 }, false);
    viewport.focus({ preventScroll: true });
  };
  document.addEventListener(RESOURCE_DRAG_STARTED_EVENT, handleResourceDrag);
  document.addEventListener(RESOURCE_DRAG_MOVED_EVENT, handleResourceDrag);
  document.addEventListener(RESOURCE_DRAG_ENDED_EVENT, handleResourceDrag);
  document.addEventListener(RESOURCE_KEYBOARD_PLACE_EVENT, handleKeyboardPlacement);
  const handleOperationDrag = (event: Event): void => {
    const detail = (event as CustomEvent<OperationDragDetail>).detail;
    const inside = !detail.cancelled && isInsideViewport(detail.clientX, detail.clientY);
    viewport.classList.toggle('canvas-viewport--drop-target', inside);
    if (event.type !== OPERATION_DRAG_ENDED_EVENT) return;
    viewport.classList.remove('canvas-viewport--drop-target'); if (!inside) return;
    const bounds = viewport.getBoundingClientRect(); placeOperation(detail.templateId, { x: detail.clientX - bounds.left, y: detail.clientY - bounds.top }, detail.altKey);
  };
  const handleOperationKeyboardPlacement = (event: Event): void => { placeOperation((event as CustomEvent<string>).detail, { x: size.width / 2, y: size.height / 2 }, false); viewport.focus({ preventScroll: true }); };
  const handleOperationReveal = (event: Event): void => {
    const operation = operationStore.getOperation((event as CustomEvent<string>).detail); if (!operation) return;
    state.panX = size.width / 2 - operation.worldX * state.zoom; state.panY = size.height / 2 - operation.worldY * state.zoom; requestRender(); callbacks.onStatusChange(`Revealed OP ${operation.sequence}`);
  };
  document.addEventListener(OPERATION_DRAG_STARTED_EVENT, handleOperationDrag); document.addEventListener(OPERATION_DRAG_MOVED_EVENT, handleOperationDrag); document.addEventListener(OPERATION_DRAG_ENDED_EVENT, handleOperationDrag);
  document.addEventListener(OPERATION_KEYBOARD_PLACE_EVENT, handleOperationKeyboardPlacement); document.addEventListener(OPERATION_REVEAL_EVENT, handleOperationReveal);
  const handleConnectionReveal = (event: Event): void => { const connection = connectionStore.getConnection((event as CustomEvent<string>).detail); if (!connection?.routePoints.length) return; const minX = Math.min(...connection.routePoints.map((point) => point.x)); const maxX = Math.max(...connection.routePoints.map((point) => point.x)); const minY = Math.min(...connection.routePoints.map((point) => point.y)); const maxY = Math.max(...connection.routePoints.map((point) => point.y)); state.panX = size.width / 2 - ((minX + maxX) / 2) * state.zoom; state.panY = size.height / 2 - ((minY + maxY) / 2) * state.zoom; requestRender(); callbacks.onStatusChange(`Revealed ${connection.id}`); };
  document.addEventListener(CONNECTION_REVEAL_EVENT, handleConnectionReveal);

  const handleBackgroundSelection = (event: PointerEvent): void => {
    if (event.button !== 0 || state.tool !== 'select') return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest('[data-resource-id], [data-operation-id], [data-connection-id]')) selectionStore.clear();
  };
  viewport.addEventListener('pointerdown', handleBackgroundSelection);
  const isTyping = (target: EventTarget | null): boolean => target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable);
  const handleObjectKeyDown = (event: KeyboardEvent): void => {
    if (isTyping(event.target) || !application.contains(document.activeElement)) return;
    if (event.key === 'Delete' || event.key === 'Backspace') { if (selectionStore.getSelection().kind !== 'none') event.preventDefault(); runCommand('delete-selection'); }
  };
  document.addEventListener('keydown', handleObjectKeyDown);

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
  requestRender();

  return {
    element: workspace,
    dispose: () => {
      interaction.dispose();
      resourceInteraction?.dispose();
      resourceInteraction = null;
      resourceRenderer.dispose();
      operationInteraction?.dispose(); operationInteraction = null; operationRenderer.dispose();
      connectionInteraction?.dispose(); connectionInteraction = null; connectionRenderer.dispose();
      resizeObserver.disconnect();
      document.removeEventListener(CANVAS_COMMAND_EVENT, handleGlobalCommand);
      document.removeEventListener(RESOURCE_DRAG_STARTED_EVENT, handleResourceDrag);
      document.removeEventListener(RESOURCE_DRAG_MOVED_EVENT, handleResourceDrag);
      document.removeEventListener(RESOURCE_DRAG_ENDED_EVENT, handleResourceDrag);
      document.removeEventListener(RESOURCE_KEYBOARD_PLACE_EVENT, handleKeyboardPlacement);
      document.removeEventListener(OPERATION_DRAG_STARTED_EVENT, handleOperationDrag); document.removeEventListener(OPERATION_DRAG_MOVED_EVENT, handleOperationDrag); document.removeEventListener(OPERATION_DRAG_ENDED_EVENT, handleOperationDrag);
      document.removeEventListener(OPERATION_KEYBOARD_PLACE_EVENT, handleOperationKeyboardPlacement); document.removeEventListener(OPERATION_REVEAL_EVENT, handleOperationReveal);
      document.removeEventListener(CONNECTION_REVEAL_EVENT, handleConnectionReveal);
      viewport.removeEventListener('pointerdown', handleBackgroundSelection); document.removeEventListener('keydown', handleObjectKeyDown);
      if (renderFrame !== 0) cancelAnimationFrame(renderFrame);
    },
  };
}

