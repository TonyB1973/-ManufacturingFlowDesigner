import type { CanvasTool } from '../../../models/canvas/CanvasState';
import { actionButton, element } from '../../../ui/dom';

export type CanvasToolbarCommand = 'select' | 'pan' | 'zoom-in' | 'zoom-out' | 'actual-size' | 'fit' | 'grid' | 'origin' | 'snap' | 'delete-selection' | 'clear-selection' | 'focus';

export interface CanvasToolbarController {
  readonly element: HTMLElement;
  setZoom(zoom: number): void;
  setTool(tool: CanvasTool): void;
  setGridVisible(visible: boolean): void;
  setOriginVisible(visible: boolean): void;
  setSnapEnabled(enabled: boolean): void;
  setFocusMode(active: boolean): void;
}

interface CommandDefinition {
  readonly command: CanvasToolbarCommand;
  readonly label: string;
  readonly title: string;
  readonly toggle?: boolean;
}

const COMMANDS: readonly CommandDefinition[] = [
  { command: 'select', label: 'Select', title: 'Select (placeholder)', toggle: true },
  { command: 'pan', label: 'Pan', title: 'Pan tool', toggle: true },
  { command: 'zoom-in', label: '+', title: 'Zoom in (+)' },
  { command: 'zoom-out', label: '−', title: 'Zoom out (-)' },
  { command: 'actual-size', label: '100%', title: 'Reset zoom to 100% (0)' },
  { command: 'fit', label: 'Fit', title: 'Fit origin in viewport (F)' },
  { command: 'grid', label: 'Grid', title: 'Toggle engineering grid', toggle: true },
  { command: 'origin', label: 'Origin', title: 'Toggle origin and axes', toggle: true },
  { command: 'snap', label: 'Snap', title: 'Toggle Snap to Grid', toggle: true },
  { command: 'delete-selection', label: 'Delete', title: 'Delete selected resource' },
  { command: 'clear-selection', label: 'Clear', title: 'Clear resource selection' },
  { command: 'focus', label: 'Canvas Focus', title: 'Toggle Canvas Focus mode', toggle: true },
];

export function createCanvasToolbar(onCommand: (command: CanvasToolbarCommand) => void): CanvasToolbarController {
  const toolbar = element('div', 'canvas-toolbar');
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', 'Engineering canvas navigation');
  const buttons = new Map<CanvasToolbarCommand, HTMLButtonElement>();

  for (const definition of COMMANDS) {
    const button = actionButton(definition.title, 'tool-button');
    button.textContent = definition.label;
    button.title = definition.title;
    button.dataset.command = definition.command;
    if (definition.toggle) button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => onCommand(definition.command));
    buttons.set(definition.command, button);
    toolbar.append(button);
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
    },
    setGridVisible: (visible) => setPressed('grid', visible),
    setOriginVisible: (visible) => setPressed('origin', visible),
    setSnapEnabled: (enabled) => setPressed('snap', enabled),
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

