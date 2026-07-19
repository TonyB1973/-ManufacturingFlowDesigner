import type { CanvasState } from '../../../models/canvas/CanvasState';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface ViewportSize {
  readonly width: number;
  readonly height: number;
}

export function clampZoom(zoom: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, zoom));
}

export function worldToScreen(point: Point, state: Pick<CanvasState, 'panX' | 'panY' | 'zoom'>): Point {
  return {
    x: point.x * state.zoom + state.panX,
    y: point.y * state.zoom + state.panY,
  };
}

export function screenToWorld(point: Point, state: Pick<CanvasState, 'panX' | 'panY' | 'zoom'>): Point {
  return {
    x: (point.x - state.panX) / state.zoom,
    y: (point.y - state.panY) / state.zoom,
  };
}

export function zoomAroundPoint(state: CanvasState, requestedZoom: number, anchor: Point): void {
  const worldAnchor = screenToWorld(anchor, state);
  state.zoom = clampZoom(requestedZoom, state.minZoom, state.maxZoom);
  state.panX = anchor.x - worldAnchor.x * state.zoom;
  state.panY = anchor.y - worldAnchor.y * state.zoom;
}

export function centreOrigin(state: CanvasState, size: ViewportSize, zoom = 1): void {
  state.zoom = clampZoom(zoom, state.minZoom, state.maxZoom);
  state.panX = size.width / 2;
  state.panY = size.height / 2;
}

