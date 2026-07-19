import type { StatusBarController } from '../statusbar/StatusBar';
import { createCanvasViewport, type CanvasViewportController } from './canvas/CanvasViewport';

export interface WorkspaceOptions {
  readonly application: HTMLElement;
  readonly statusBar: StatusBarController;
  readonly onFocusModeChange: (active: boolean) => void;
}

export function createWorkspace(options: WorkspaceOptions): CanvasViewportController {
  return createCanvasViewport(options.application, {
    onZoomChange: options.statusBar.setZoom,
    onGridVisibilityChange: options.statusBar.setGridVisible,
    onCoordinatesChange: options.statusBar.setCoordinates,
    onFocusModeChange: options.onFocusModeChange,
    onStatusChange: options.statusBar.setMessage,
  });
}
