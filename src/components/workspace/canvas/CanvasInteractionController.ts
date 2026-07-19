import type { Point } from './ViewportTransform';

export interface CanvasInteractionCallbacks {
  readonly getZoom: () => number;
  readonly shouldPanWithPrimaryButton: () => boolean;
  readonly onPan: (delta: Point) => void;
  readonly onZoom: (requestedZoom: number, anchor: Point) => void;
  readonly onPointerWorldPosition: (viewportPoint: Point | null) => void;
  readonly onTemporaryPanChange: (active: boolean) => void;
  readonly onKeyboardCommand: (command: 'zoom-in' | 'zoom-out' | 'actual-size' | 'fit') => void;
}

function distance(first: Point, second: Point): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function midpoint(first: Point, second: Point): Point {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || (target instanceof HTMLElement && target.isContentEditable);
}

export class CanvasInteractionController {
  private readonly pointers = new Map<number, Point>();
  private activeMousePointer: number | null = null;
  private lastPanPoint: Point | null = null;
  private pinchDistance = 0;
  private pinchCentre: Point | null = null;
  private spaceHeld = false;
  private pointerWasInside = false;

  public constructor(
    private readonly surface: HTMLElement,
    private readonly application: HTMLElement,
    private readonly callbacks: CanvasInteractionCallbacks,
  ) {
    surface.addEventListener('wheel', this.handleWheel, { passive: false });
    surface.addEventListener('pointerdown', this.handlePointerDown);
    surface.addEventListener('pointermove', this.handlePointerMove);
    surface.addEventListener('pointerup', this.handlePointerEnd);
    surface.addEventListener('pointercancel', this.handlePointerEnd);
    surface.addEventListener('pointerleave', this.handlePointerLeave);
    surface.addEventListener('pointerout', this.handlePointerOut);
    document.addEventListener('pointermove', this.handleDocumentPointerMove);
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.cancelInteraction);
  }

  public dispose(): void {
    this.surface.removeEventListener('wheel', this.handleWheel);
    this.surface.removeEventListener('pointerdown', this.handlePointerDown);
    this.surface.removeEventListener('pointermove', this.handlePointerMove);
    this.surface.removeEventListener('pointerup', this.handlePointerEnd);
    this.surface.removeEventListener('pointercancel', this.handlePointerEnd);
    this.surface.removeEventListener('pointerleave', this.handlePointerLeave);
    this.surface.removeEventListener('pointerout', this.handlePointerOut);
    document.removeEventListener('pointermove', this.handleDocumentPointerMove);
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.cancelInteraction);
    this.cancelInteraction();
  }

  private readonly localPoint = (event: PointerEvent | WheelEvent): Point => {
    const bounds = this.surface.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  };

  private readonly handleWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const intensity = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 0.045 : 0.0015;
    const factor = Math.exp(-event.deltaY * intensity);
    this.callbacks.onZoom(this.callbacks.getZoom() * factor, this.localPoint(event));
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    this.surface.focus({ preventScroll: true });
    const point = this.localPoint(event);
    this.pointerWasInside = true;
    this.callbacks.onPointerWorldPosition(point);

    if (event.pointerType === 'touch') {
      event.preventDefault();
      this.pointers.set(event.pointerId, point);
      this.capturePointer(event.pointerId);
      this.prepareTouchGesture();
      this.setDragging(true);
      return;
    }

    const canPan = event.button === 1 || (event.button === 0 && (this.spaceHeld || this.callbacks.shouldPanWithPrimaryButton()));
    if (!canPan) return;
    event.preventDefault();
    this.activeMousePointer = event.pointerId;
    this.lastPanPoint = point;
    this.capturePointer(event.pointerId);
    this.setDragging(true);
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    const point = this.localPoint(event);
    this.pointerWasInside = true;
    this.callbacks.onPointerWorldPosition(point);

    if (event.pointerType === 'touch' && this.pointers.has(event.pointerId)) {
      event.preventDefault();
      this.pointers.set(event.pointerId, point);
      this.updateTouchGesture();
      return;
    }

    if (this.activeMousePointer !== event.pointerId || !this.lastPanPoint) return;
    event.preventDefault();
    this.callbacks.onPan({ x: point.x - this.lastPanPoint.x, y: point.y - this.lastPanPoint.y });
    this.lastPanPoint = point;
  };

  private readonly handlePointerEnd = (event: PointerEvent): void => {
    if (this.pointers.delete(event.pointerId)) {
      this.releasePointer(event.pointerId);
      this.prepareTouchGesture();
      if (this.pointers.size === 0) this.setDragging(false);
    }
    if (this.activeMousePointer === event.pointerId) {
      this.releasePointer(event.pointerId);
      this.activeMousePointer = null;
      this.lastPanPoint = null;
      this.setDragging(false);
    }
  };

  private readonly handlePointerLeave = (): void => {
    if (this.activeMousePointer === null && this.pointers.size === 0) {
      this.pointerWasInside = false;
      this.callbacks.onPointerWorldPosition(null);
    }
  };

  private readonly handlePointerOut = (event: PointerEvent): void => {
    if (event.relatedTarget instanceof Node && this.surface.contains(event.relatedTarget)) return;
    this.handlePointerLeave();
  };

  private readonly handleDocumentPointerMove = (event: PointerEvent): void => {
    if (!this.pointerWasInside || event.composedPath().includes(this.surface)) return;
    this.handlePointerLeave();
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (isTypingTarget(event.target) || !this.application.contains(document.activeElement)) return;
    if (event.code === 'Space') {
      event.preventDefault();
      if (!this.spaceHeld) {
        this.spaceHeld = true;
        this.callbacks.onTemporaryPanChange(true);
      }
      return;
    }
    if (event.key === 'Escape') {
      this.cancelInteraction();
      return;
    }
    if (event.key === '+' || event.key === '=') this.callbacks.onKeyboardCommand('zoom-in');
    else if (event.key === '-' || event.key === '_') this.callbacks.onKeyboardCommand('zoom-out');
    else if (event.key === '0') this.callbacks.onKeyboardCommand('actual-size');
    else if (event.key.toLowerCase() === 'f' && this.surface.contains(document.activeElement)) this.callbacks.onKeyboardCommand('fit');
    else return;
    event.preventDefault();
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    if (event.code === 'Space' && this.spaceHeld) {
      this.spaceHeld = false;
      this.callbacks.onTemporaryPanChange(false);
    }
  };

  private readonly cancelInteraction = (): void => {
    for (const pointerId of this.pointers.keys()) this.releasePointer(pointerId);
    if (this.activeMousePointer !== null) this.releasePointer(this.activeMousePointer);
    this.pointers.clear();
    this.activeMousePointer = null;
    this.lastPanPoint = null;
    this.pinchDistance = 0;
    this.pinchCentre = null;
    this.spaceHeld = false;
    this.callbacks.onTemporaryPanChange(false);
    this.setDragging(false);
  };

  private prepareTouchGesture(): void {
    const points = [...this.pointers.values()];
    if (points.length >= 2) {
      this.pinchDistance = distance(points[0], points[1]);
      this.pinchCentre = midpoint(points[0], points[1]);
      this.lastPanPoint = null;
    } else {
      this.pinchDistance = 0;
      this.pinchCentre = null;
      this.lastPanPoint = points[0] ?? null;
    }
  }

  private updateTouchGesture(): void {
    const points = [...this.pointers.values()];
    if (points.length >= 2) {
      const nextCentre = midpoint(points[0], points[1]);
      const nextDistance = distance(points[0], points[1]);
      if (this.pinchCentre) {
        this.callbacks.onPan({ x: nextCentre.x - this.pinchCentre.x, y: nextCentre.y - this.pinchCentre.y });
      }
      if (this.pinchDistance > 0) {
        this.callbacks.onZoom(this.callbacks.getZoom() * (nextDistance / this.pinchDistance), nextCentre);
      }
      this.pinchCentre = nextCentre;
      this.pinchDistance = nextDistance;
      return;
    }
    if (points.length === 1 && this.lastPanPoint) {
      this.callbacks.onPan({ x: points[0].x - this.lastPanPoint.x, y: points[0].y - this.lastPanPoint.y });
      this.lastPanPoint = points[0];
    }
  }

  private capturePointer(pointerId: number): void {
    try { this.surface.setPointerCapture(pointerId); } catch { /* Pointer may have ended before capture. */ }
  }

  private releasePointer(pointerId: number): void {
    if (this.surface.hasPointerCapture(pointerId)) this.surface.releasePointerCapture(pointerId);
  }

  private setDragging(active: boolean): void {
    this.surface.classList.toggle('canvas-viewport--dragging', active);
  }
}
