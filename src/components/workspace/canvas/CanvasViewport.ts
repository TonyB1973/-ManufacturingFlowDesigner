import { CANVAS_COMMAND_EVENT, type CanvasCommand, reportPlaceholder } from '../../../core/events/uiEvents';
import { createCanvasState } from '../../../models/canvas/CanvasState';
import { element } from '../../../ui/dom';
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
}

export interface CanvasViewportController {
  readonly element: HTMLElement;
  dispose(): void;
}

export function createCanvasViewport(application: HTMLElement, callbacks: CanvasViewportCallbacks): CanvasViewportController {
  const state = createCanvasState();
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
      toolbar.setFocusMode(focusMode);
      viewport.classList.toggle('canvas-viewport--pan-tool', state.tool === 'pan' || temporaryPan);
      callbacks.onZoomChange(state.zoom);
      callbacks.onGridVisibilityChange(state.gridVisible);
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
        reportPlaceholder('Canvas selection');
        break;
      case 'pan':
        state.tool = state.tool === 'pan' ? 'select' : 'pan';
        callbacks.onStatusChange(state.tool === 'pan' ? 'Pan tool active' : 'Select tool active');
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
        centreOrigin(state, size, 1);
        callbacks.onStatusChange('Drawing origin fitted to viewport');
        break;
      case 'grid':
        state.gridVisible = !state.gridVisible;
        callbacks.onStatusChange(`Grid ${state.gridVisible ? 'enabled' : 'disabled'}`);
        break;
      case 'origin':
        state.originVisible = !state.originVisible;
        callbacks.onStatusChange(`Origin ${state.originVisible ? 'shown' : 'hidden'}`);
        break;
      case 'focus':
        focusMode = !focusMode;
        callbacks.onFocusModeChange(focusMode);
        callbacks.onStatusChange(`Canvas Focus ${focusMode ? 'enabled' : 'disabled'}`);
        break;
    }
    requestRender();
  };

  const toolbar = createCanvasToolbar(runCommand);
  workspace.append(toolbar.element, viewport);

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
      resizeObserver.disconnect();
      document.removeEventListener(CANVAS_COMMAND_EVENT, handleGlobalCommand);
      if (renderFrame !== 0) cancelAnimationFrame(renderFrame);
    },
  };
}

