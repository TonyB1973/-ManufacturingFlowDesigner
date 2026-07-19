import type { Point } from '../components/workspace/canvas/ViewportTransform';

export const BASE_GRID_INTERVAL = 20;

export class SnapService {
  public enabled = true;

  public constructor(public readonly interval = BASE_GRID_INTERVAL) {}

  public snapPoint(point: Point, bypass = false): Point {
    if (!this.enabled || bypass) return point;
    return {
      x: this.snapValue(point.x),
      y: this.snapValue(point.y),
    };
  }

  public snapValue(value: number): number {
    return Math.round(value / this.interval) * this.interval;
  }

  public toggle(): boolean {
    this.enabled = !this.enabled;
    return this.enabled;
  }
}
