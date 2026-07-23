export type CanvasWorkspaceId = 'processFlow' | 'factoryLayout';
export type WorkspaceId = CanvasWorkspaceId | 'standardWork' | 'availability' | 'scenarios';

export interface WorkspaceViewportState {
  panX: number;
  panY: number;
  zoom: number;
  gridVisible: boolean;
  originVisible: boolean;
  snapEnabled: boolean;
}

export const DEFAULT_FACTORY_LAYOUT_ID = 'factory-layout-default';
