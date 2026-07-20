import type { StatusBarController } from '../statusbar/StatusBar';
import type { ResourceStore } from '../../services/ResourceStore';
import type { OperationStore } from '../../services/OperationStore';
import type { SelectionController } from '../../models/selection/Selection';
import { createCanvasViewport, type CanvasViewportController } from './canvas/CanvasViewport';

export interface WorkspaceOptions {
  readonly application: HTMLElement;
  readonly statusBar: StatusBarController;
  readonly resourceStore: ResourceStore;
  readonly operationStore: OperationStore;
  readonly selectionStore: SelectionController;
  readonly onFocusModeChange: (active: boolean) => void;
}

export function createWorkspace(options: WorkspaceOptions): CanvasViewportController {
  return createCanvasViewport(options.application, options.resourceStore, options.operationStore, options.selectionStore, {
    onZoomChange: options.statusBar.setZoom,
    onGridVisibilityChange: options.statusBar.setGridVisible,
    onCoordinatesChange: options.statusBar.setCoordinates,
    onFocusModeChange: options.onFocusModeChange,
    onStatusChange: options.statusBar.setMessage,
    onSnapChange: options.statusBar.setSnapEnabled,
  });
}
