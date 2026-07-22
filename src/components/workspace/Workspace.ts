import type { StatusBarController } from '../statusbar/StatusBar';
import type { ResourceStore } from '../../services/ResourceStore';
import type { OperationStore } from '../../services/OperationStore';
import type { SelectionController } from '../../models/selection/Selection';
import type { ConnectionStore } from '../../services/ConnectionStore';
import { createCanvasViewport, type CanvasViewportController } from './canvas/CanvasViewport';
import type { WorkspaceStore } from '../../services/WorkspaceStore';
import type { CommandFactory } from '../../services/history/CommandFactory';
import type { ApplicationClipboardService } from '../../services/editing/ApplicationClipboardService';
import type { GeometrySelectionService } from '../../services/geometry/GeometrySelectionService';
import type { GeometryEditingService } from '../../services/geometry/GeometryEditingService';
import type { GeometryCommandFactory } from '../../services/history/GeometryCommandFactory';
import type { FactoryStructureStore } from '../../services/FactoryStructureStore';
import type { FactoryRouteStore } from '../../services/FactoryRouteStore';
import type { FactoryRouteCommandFactory } from '../../services/history/FactoryRouteCommandFactory';

export interface WorkspaceOptions {
  readonly application: HTMLElement;
  readonly statusBar: StatusBarController;
  readonly resourceStore: ResourceStore;
  readonly operationStore: OperationStore;
  readonly connectionStore: ConnectionStore;
  readonly structureStore: FactoryStructureStore;
  readonly routeStore: FactoryRouteStore;
  readonly selectionStore: SelectionController;
  readonly workspaceStore: WorkspaceStore;
  readonly requestResourceDeletion: (resourceId: string) => void;
  readonly onFocusModeChange: (active: boolean) => void;
  readonly commands: CommandFactory;
  readonly routeCommands: FactoryRouteCommandFactory;
  readonly editing: ApplicationClipboardService;
  readonly geometrySelection: GeometrySelectionService;
  readonly geometryEditing: GeometryEditingService;
  readonly geometryCommands: GeometryCommandFactory;
}

export function createWorkspace(options: WorkspaceOptions): CanvasViewportController {
  return createCanvasViewport(options.application, options.resourceStore, options.operationStore, options.connectionStore, options.structureStore, options.routeStore, options.workspaceStore, options.selectionStore, options.commands, options.routeCommands, options.editing, options.geometrySelection, options.geometryEditing, options.geometryCommands, {
    onZoomChange: options.statusBar.setZoom,
    onGridVisibilityChange: options.statusBar.setGridVisible,
    onCoordinatesChange: options.statusBar.setCoordinates,
    onFocusModeChange: options.onFocusModeChange,
    onStatusChange: options.statusBar.setMessage,
    onSnapChange: options.statusBar.setSnapEnabled,
    onToolChange: options.statusBar.setActiveTool,
    onWorkspaceChange: (workspace) => options.statusBar.setWorkspace(workspace === 'processFlow' ? 'Process Flow' : 'Factory Layout'),
    requestResourceDeletion: options.requestResourceDeletion,
  });
}
