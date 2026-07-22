export type CanvasTool = 'select' | 'pan' | 'connect' | 'delete-link' | 'draw-boundary-rect' | 'draw-boundary-orthogonal' | 'draw-wall' | 'draw-area' | 'draw-aisle' | 'draw-route';

export interface CanvasState {
  panX: number;
  panY: number;
  zoom: number;
  readonly minZoom: number;
  readonly maxZoom: number;
  gridVisible: boolean;
  originVisible: boolean;
  tool: CanvasTool;
}

export function createCanvasState(): CanvasState {
  return {
    panX: 0,
    panY: 0,
    zoom: 1,
    minZoom: 0.1,
    maxZoom: 4,
    gridVisible: true,
    originVisible: true,
    tool: 'select',
  };
}

