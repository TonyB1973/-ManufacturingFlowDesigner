import { element } from '../../ui/dom';

export interface StatusBarController {
  readonly element: HTMLElement;
  setMessage(message: string): void;
  setZoom(zoom: number): void;
  setGridVisible(visible: boolean): void;
  setCoordinates(point: { readonly x: number; readonly y: number } | null): void;
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
  bar.append(project, zoom, grid, coordinateX, coordinateY, element('span', '', 'Selected: 0'), element('span', '', 'Canvas Foundation'));
  return {
    element: bar,
    setMessage: (text) => { message.textContent = text; },
    setZoom: (value) => { zoom.textContent = `${Math.round(value * 100)}%`; },
    setGridVisible: (visible) => { grid.textContent = `Grid: ${visible ? 'On' : 'Off'}`; },
    setCoordinates: (point) => {
      coordinateX.textContent = point ? `X: ${point.x.toFixed(3)}` : 'X: —';
      coordinateY.textContent = point ? `Y: ${point.y.toFixed(3)}` : 'Y: —';
    },
  };
}

