import { element } from '../../ui/dom';

export interface StatusBarController {
  readonly element: HTMLElement;
  setMessage(message: string): void;
  setZoom(zoom: number): void;
  setGridVisible(visible: boolean): void;
  setCoordinates(point: { readonly x: number; readonly y: number } | null): void;
  setSnapEnabled(enabled: boolean): void;
  setSelectionCount(count: number): void;
  setResourceCount(count: number): void;
  setOperationCount(count: number): void;
  setSelectionLabel(label: string): void;
  setHealth(errors: number, warnings: number): void;
}

export function createStatusBar(): StatusBarController {
  const bar = element('footer', 'statusbar');
  const message = element('span', 'statusbar__message', 'Ready');
  message.setAttribute('role', 'status');
  message.setAttribute('aria-live', 'polite');
  bar.append(message);
  const project = element('span', '', 'Untitled Project');
  const zoom = element('span', 'statusbar__zoom', '100%');
  const grid = element('span', 'statusbar__grid', 'Grid: On');
  const coordinateX = element('span', 'statusbar__coordinate', 'X: —');
  const coordinateY = element('span', 'statusbar__coordinate', 'Y: —');
  const snap = element('span', 'statusbar__snap', 'Snap: On');
  const selection = element('span', 'statusbar__selection', 'Selected: 0');
  const resources = element('span', 'statusbar__resources', 'Resources: 0');
  const operations = element('span', 'statusbar__operations', 'Operations: 0');
  const health = element('span', 'statusbar__health', 'Health: Healthy');
  bar.append(project, zoom, grid, snap, coordinateX, coordinateY, selection, resources, operations, health, element('span', '', 'Process Foundation'));
  return {
    element: bar,
    setMessage: (text) => { message.textContent = text; },
    setZoom: (value) => { zoom.textContent = `${Math.round(value * 100)}%`; },
    setGridVisible: (visible) => { grid.textContent = `Grid: ${visible ? 'On' : 'Off'}`; },
    setSnapEnabled: (enabled) => { snap.textContent = `Snap: ${enabled ? 'On' : 'Off'}`; },
    setSelectionCount: (value) => { selection.textContent = `Selected: ${value}`; },
    setResourceCount: (value) => { resources.textContent = `Resources: ${value}`; },
    setOperationCount: (value) => { operations.textContent = `Operations: ${value}`; },
    setSelectionLabel: (value) => { selection.textContent = `Selected: ${value}`; },
    setHealth: (errors, warnings) => { health.textContent = errors ? `Health: ${errors} error${errors === 1 ? '' : 's'}` : warnings ? `Health: ${warnings} warning${warnings === 1 ? '' : 's'}` : 'Health: Healthy'; },
    setCoordinates: (point) => {
      coordinateX.textContent = point ? `X: ${point.x.toFixed(3)}` : 'X: —';
      coordinateY.textContent = point ? `Y: ${point.y.toFixed(3)}` : 'Y: —';
    },
  };
}

