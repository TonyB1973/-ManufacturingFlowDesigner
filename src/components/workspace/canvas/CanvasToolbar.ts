import type { CanvasTool } from '../../../models/canvas/CanvasState';
import { actionButton, element } from '../../../ui/dom';
import { FACTORY_ROUTE_TYPES, type FactoryRouteType } from '../../../models/factory/FactoryRoute';

export type CanvasToolbarCommand = 'select' | 'pan' | 'connect' | 'delete-link' | 'draw-boundary-rect' | 'draw-boundary-orthogonal' | 'draw-wall' | 'draw-area' | 'draw-aisle' | 'draw-route' | 'measure' | 'dimension-horizontal' | 'dimension-vertical' | 'dimension-aligned' | 'coordinate-marker' | 'text-note' | 'leader' | 'create-measured-horizontal' | 'create-measured-vertical' | 'create-measured-aligned' | 'clear-measurement' | 'reverse-route' | 'insert-route-waypoint' | 'delete-route-waypoint' | 'zoom-in' | 'zoom-out' | 'actual-size' | 'fit' | 'fit-boundary' | 'fit-all-layout' | 'fit-routes' | 'fit-all-routes' | 'fit-annotations' | 'fit-all-annotations' | 'toggle-clearance' | 'layer-boundary' | 'layer-floor-fill' | 'layer-walls' | 'layer-areas' | 'layer-aisles' | 'layer-routes' | 'layer-route-labels' | 'layer-route-arrows' | 'layer-resources' | 'layer-labels' | 'layer-annotations' | 'layer-dimensions' | 'layer-coordinates' | 'layer-notes' | 'grid' | 'origin' | 'snap' | 'copy' | 'paste' | 'duplicate' | 'delete-selection' | 'clear-selection' | 'focus';

export interface CanvasToolbarController {
  readonly element: HTMLElement;
  setZoom(zoom: number): void;
  setTool(tool: CanvasTool): void;
  setGridVisible(visible: boolean): void;
  setOriginVisible(visible: boolean): void;
  setSnapEnabled(enabled: boolean): void;
  setFocusMode(active: boolean): void;
  setConnectionToolsEnabled(enabled: boolean): void;
  setFactoryToolsEnabled(enabled: boolean): void;
  setClearanceVisible(visible: boolean): void;
  setLayerVisible(command: Extract<CanvasToolbarCommand, `layer-${string}`>, visible: boolean): void;
  setRouteType(type: FactoryRouteType): void;
  getRouteType(): FactoryRouteType;
  setRouteActionsEnabled(enabled: boolean): void;
}

interface CommandDefinition {
  readonly command: CanvasToolbarCommand;
  readonly label: string;
  readonly title: string;
  readonly toggle?: boolean;
}

const COMMANDS: readonly CommandDefinition[] = [
  { command: 'select', label: 'Select', title: 'Select objects', toggle: true },
  { command: 'pan', label: 'Pan', title: 'Pan tool', toggle: true },
  { command: 'connect', label: 'Connect', title: 'Connect operations (C)', toggle: true },
  { command: 'delete-link', label: 'Delete Link', title: 'Delete process connections', toggle: true },
  { command: 'draw-boundary-rect', label: 'Boundary', title: 'Draw rectangular factory boundary (B)', toggle: true },
  { command: 'draw-boundary-orthogonal', label: 'Ortho Boundary', title: 'Draw orthogonal factory boundary', toggle: true },
  { command: 'draw-wall', label: 'Wall', title: 'Draw factory wall (W)', toggle: true },
  { command: 'draw-area', label: 'Area', title: 'Draw factory area (A)', toggle: true },
  { command: 'draw-aisle', label: 'Aisle', title: 'Draw orthogonal aisle (I)', toggle: true },
  { command: 'draw-route', label: 'Route', title: 'Draw Factory Route (T)', toggle: true },
  { command: 'measure', label: 'Measure', title: 'Temporary point-to-point measurement (M)', toggle: true },
  { command: 'dimension-horizontal', label: 'H Dim', title: 'Place horizontal dimension (H)', toggle: true },
  { command: 'dimension-vertical', label: 'V Dim', title: 'Place vertical dimension (V)', toggle: true },
  { command: 'dimension-aligned', label: 'Aligned Dim', title: 'Place aligned dimension (D)', toggle: true },
  { command: 'coordinate-marker', label: 'Coordinate', title: 'Place coordinate marker (Shift+C)', toggle: true },
  { command: 'text-note', label: 'Note', title: 'Place text note (N)', toggle: true },
  { command: 'leader', label: 'Leader', title: 'Place leader annotation (L)', toggle: true },
  { command: 'create-measured-horizontal', label: 'Measure→H', title: 'Create horizontal dimension from completed measurement' },
  { command: 'create-measured-vertical', label: 'Measure→V', title: 'Create vertical dimension from completed measurement' },
  { command: 'create-measured-aligned', label: 'Measure→D', title: 'Create aligned dimension from completed measurement' },
  { command: 'clear-measurement', label: 'Clear Measure', title: 'Clear temporary measurement' },
  { command: 'reverse-route', label: 'Reverse Route', title: 'Reverse selected Factory Route (R)' },
  { command: 'insert-route-waypoint', label: 'Insert Point', title: 'Insert route waypoint' },
  { command: 'delete-route-waypoint', label: 'Delete Point', title: 'Delete selected route waypoint' },
  { command: 'zoom-in', label: '+', title: 'Zoom in (+)' },
  { command: 'zoom-out', label: '−', title: 'Zoom out (-)' },
  { command: 'actual-size', label: '100%', title: 'Reset zoom to 100% (0)' },
  { command: 'fit', label: 'Fit', title: 'Fit visible engineering geometry (F)' },
  { command: 'fit-boundary', label: 'Fit Boundary', title: 'Fit Factory Boundary' },
  { command: 'fit-all-layout', label: 'Fit All Layout', title: 'Fit all visible Factory Layout entities' },
  { command: 'fit-routes', label: 'Fit Routes', title: 'Fit visible Factory Routes' },
  { command: 'fit-all-routes', label: 'Fit All + Routes', title: 'Fit all Factory Layout entities including routes' },
  { command: 'fit-annotations', label: 'Fit Annotations', title: 'Fit visible Factory Annotations' },
  { command: 'fit-all-annotations', label: 'Fit All + Annotations', title: 'Fit all Factory Layout entities including routes and annotations' },
  { command: 'toggle-clearance', label: 'Clearance', title: 'Show or hide factory clearance envelopes', toggle: true },
  { command: 'layer-boundary', label: 'Boundary Layer', title: 'Show or hide boundary', toggle: true },
  { command: 'layer-floor-fill', label: 'Floor Fill', title: 'Show or hide floor fill', toggle: true },
  { command: 'layer-walls', label: 'Walls', title: 'Show or hide walls', toggle: true },
  { command: 'layer-areas', label: 'Areas', title: 'Show or hide factory areas', toggle: true },
  { command: 'layer-aisles', label: 'Aisles', title: 'Show or hide aisles', toggle: true },
  { command: 'layer-routes', label: 'Routes', title: 'Show or hide Factory Routes', toggle: true },
  { command: 'layer-route-labels', label: 'Route Labels', title: 'Show or hide Factory Route labels', toggle: true },
  { command: 'layer-route-arrows', label: 'Route Arrows', title: 'Show or hide Factory Route direction arrows', toggle: true },
  { command: 'layer-resources', label: 'Resources', title: 'Show or hide physical resources', toggle: true },
  { command: 'layer-labels', label: 'Labels', title: 'Show or hide factory structure labels', toggle: true },
  { command: 'layer-annotations', label: 'Annotations', title: 'Show or hide all Factory Annotations', toggle: true },
  { command: 'layer-dimensions', label: 'Dimensions', title: 'Show or hide dimension annotations', toggle: true },
  { command: 'layer-coordinates', label: 'Coordinates', title: 'Show or hide coordinate annotations', toggle: true },
  { command: 'layer-notes', label: 'Notes', title: 'Show or hide text and leader annotations', toggle: true },
  { command: 'grid', label: 'Grid', title: 'Toggle engineering grid', toggle: true },
  { command: 'origin', label: 'Origin', title: 'Toggle origin and axes', toggle: true },
  { command: 'snap', label: 'Snap', title: 'Toggle Snap to Grid', toggle: true },
  { command: 'copy', label: 'Copy', title: 'Copy selected objects (Ctrl+C)' },
  { command: 'paste', label: 'Paste', title: 'Paste application clipboard (Ctrl+V)' },
  { command: 'duplicate', label: 'Duplicate', title: 'Duplicate selected objects (Ctrl+D)' },
  { command: 'delete-selection', label: 'Delete', title: 'Delete selected objects' },
  { command: 'clear-selection', label: 'Clear', title: 'Clear object selection' },
  { command: 'focus', label: 'Canvas Focus', title: 'Toggle Canvas Focus mode', toggle: true },
];

export function createCanvasToolbar(onCommand: (command: CanvasToolbarCommand) => void, onRouteTypeChange: (type: FactoryRouteType) => void = () => {}): CanvasToolbarController {
  const toolbar = element('div', 'canvas-toolbar');
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', 'Engineering canvas navigation');
  const buttons = new Map<CanvasToolbarCommand, HTMLButtonElement>();
  const routeType = element('select', 'route-type-selector'); routeType.setAttribute('aria-label', 'Active Factory Route type'); routeType.title = 'Factory Route type';
  for (const type of FACTORY_ROUTE_TYPES) { const option = element('option', '', type); option.value = type; routeType.append(option); }
  routeType.addEventListener('change', () => { const value = routeType.value as FactoryRouteType; routeType.setAttribute('aria-label', `Active Factory Route type: ${value}`); onRouteTypeChange(value); });

  for (const definition of COMMANDS) {
    const button = actionButton(definition.title, 'tool-button');
    button.textContent = definition.label;
    button.title = definition.title;
    button.dataset.command = definition.command;
    if (definition.toggle) button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => onCommand(definition.command));
    buttons.set(definition.command, button);
    toolbar.append(button);
    if (definition.command === 'draw-route') toolbar.append(routeType);
  }
  const spacer = element('span', 'toolbar-spacer');
  const zoom = element('output', 'zoom-display', '100%');
  zoom.setAttribute('aria-label', 'Current canvas zoom');
  toolbar.append(spacer, zoom);

  const setPressed = (command: CanvasToolbarCommand, pressed: boolean): void => {
    const button = buttons.get(command);
    button?.setAttribute('aria-pressed', String(pressed));
    button?.classList.toggle('tool-button--active', pressed);
  };

  return {
    element: toolbar,
    setZoom: (value) => { zoom.textContent = `${Math.round(value * 100)}%`; },
    setTool: (tool) => {
      setPressed('select', tool === 'select');
      setPressed('pan', tool === 'pan');
      setPressed('connect', tool === 'connect');
      setPressed('delete-link', tool === 'delete-link');
      for (const command of ['draw-boundary-rect', 'draw-boundary-orthogonal', 'draw-wall', 'draw-area', 'draw-aisle', 'draw-route'] as const) setPressed(command, tool === command);
      for (const command of ['measure', 'dimension-horizontal', 'dimension-vertical', 'dimension-aligned', 'coordinate-marker', 'text-note', 'leader'] as const) setPressed(command, tool === command);
    },
    setGridVisible: (visible) => setPressed('grid', visible),
    setOriginVisible: (visible) => setPressed('origin', visible),
    setSnapEnabled: (enabled) => setPressed('snap', enabled),
    setConnectionToolsEnabled: (enabled) => {
      for (const command of ['connect', 'delete-link'] as const) {
        const button = buttons.get(command);
        if (button) button.disabled = !enabled;
      }
    },
    setFactoryToolsEnabled: (enabled) => { routeType.disabled = !enabled; for (const command of ['draw-boundary-rect', 'draw-boundary-orthogonal', 'draw-wall', 'draw-area', 'draw-aisle', 'draw-route', 'measure', 'dimension-horizontal', 'dimension-vertical', 'dimension-aligned', 'coordinate-marker', 'text-note', 'leader', 'create-measured-horizontal', 'create-measured-vertical', 'create-measured-aligned', 'clear-measurement', 'fit-boundary', 'fit-all-layout', 'fit-routes', 'fit-all-routes', 'fit-annotations', 'fit-all-annotations', 'toggle-clearance', 'layer-boundary', 'layer-floor-fill', 'layer-walls', 'layer-areas', 'layer-aisles', 'layer-routes', 'layer-route-labels', 'layer-route-arrows', 'layer-resources', 'layer-labels', 'layer-annotations', 'layer-dimensions', 'layer-coordinates', 'layer-notes'] as const) { const button = buttons.get(command); if (button) button.disabled = !enabled; } },
    setClearanceVisible: (visible) => setPressed('toggle-clearance', visible),
    setLayerVisible: (command, visible) => setPressed(command, visible),
    setRouteType: (value) => { routeType.value = value; routeType.setAttribute('aria-label', `Active Factory Route type: ${value}`); },
    getRouteType: () => routeType.value as FactoryRouteType,
    setRouteActionsEnabled: (enabled) => { for (const command of ['reverse-route', 'insert-route-waypoint', 'delete-route-waypoint'] as const) { const button = buttons.get(command); if (button) button.disabled = !enabled; } },
    setFocusMode: (active) => {
      setPressed('focus', active);
      const button = buttons.get('focus');
      if (button) {
        button.textContent = active ? 'Exit Focus' : 'Canvas Focus';
        button.title = active ? 'Exit Canvas Focus mode' : 'Toggle Canvas Focus mode';
      }
    },
  };
}

