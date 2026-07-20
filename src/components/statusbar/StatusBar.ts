import { element } from '../../ui/dom';
import type { HistoryState } from '../../services/history/CommandHistoryService';

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
  setConnectionCount(count: number): void;
  setActiveTool(tool: string): void;
  setSelectionLabel(label: string): void;
  setHealth(errors: number, warnings: number): void;
  setWorkspace(workspace: string): void;
  setProject(name: string, dirty: boolean): void;
  setHistory(state: HistoryState): void;
}

export function createStatusBar(): StatusBarController {
  const bar = element('footer', 'statusbar');
  const message = element('span', 'statusbar__message', 'Ready');
  message.setAttribute('role', 'status');
  message.setAttribute('aria-live', 'polite');
  bar.append(message);
  const project = element('span', '', 'Untitled Project');
  const workspace = element('span', 'statusbar__workspace', 'Workspace: Process Flow');
  const zoom = element('span', 'statusbar__zoom', '100%');
  const grid = element('span', 'statusbar__grid', 'Grid: On');
  const coordinateX = element('span', 'statusbar__coordinate', 'X: —');
  const coordinateY = element('span', 'statusbar__coordinate', 'Y: —');
  const snap = element('span', 'statusbar__snap', 'Snap: On');
  const selection = element('span', 'statusbar__selection', 'Selected: 0');
  const resources = element('span', 'statusbar__resources', 'Resources: 0');
  const operations = element('span', 'statusbar__operations', 'Operations: 0');
  const connections = element('span', 'statusbar__connections', 'Connections: 0');
  const activeTool = element('span', 'statusbar__tool', 'Tool: Select');
  const health = element('span', 'statusbar__health', 'Health: Healthy');
  const history = element('span', 'statusbar__history', 'Undo: 0 · Redo: 0');
  bar.append(project, workspace, activeTool, zoom, grid, snap, coordinateX, coordinateY, selection, resources, operations, connections, health, history);
  return {
    element: bar,
    setMessage: (text) => { message.textContent = text; },
    setProject: (name, dirty) => { project.textContent = `${name}${dirty ? ' *' : ''}`; },
    setWorkspace: (value) => { workspace.textContent = `Workspace: ${value}`; },
    setZoom: (value) => { zoom.textContent = `${Math.round(value * 100)}%`; },
    setGridVisible: (visible) => { grid.textContent = `Grid: ${visible ? 'On' : 'Off'}`; },
    setSnapEnabled: (enabled) => { snap.textContent = `Snap: ${enabled ? 'On' : 'Off'}`; },
    setSelectionCount: (value) => { selection.textContent = `Selected: ${value}`; },
    setResourceCount: (value) => { resources.textContent = `Resources: ${value}`; },
    setOperationCount: (value) => { operations.textContent = `Operations: ${value}`; },
    setConnectionCount: (value) => { connections.textContent = `Connections: ${value}`; },
    setActiveTool: (value) => { activeTool.textContent = `Tool: ${value}`; },
    setSelectionLabel: (value) => { selection.textContent = `Selected: ${value}`; },
    setHealth: (errors, warnings) => { health.textContent = errors ? `Health: ${errors} error${errors === 1 ? '' : 's'}` : warnings ? `Health: ${warnings} warning${warnings === 1 ? '' : 's'}` : 'Health: Healthy'; },
    setHistory: (state) => { history.textContent = `Undo: ${state.undoCount} · Redo: ${state.redoCount}`; history.title = [state.undoDescription ? `Undo ${state.undoDescription}` : 'Nothing to undo', state.redoDescription ? `Redo ${state.redoDescription}` : 'Nothing to redo', state.lastAction].filter(Boolean).join(' · '); },
    setCoordinates: (point) => {
      coordinateX.textContent = point ? `X: ${point.x.toFixed(3)}` : 'X: —';
      coordinateY.textContent = point ? `Y: ${point.y.toFixed(3)}` : 'Y: —';
    },
  };
}

