import type { CanvasState } from '../../../models/canvas/CanvasState';
import type { ResourceStore } from '../../../services/ResourceStore';
import type { SnapService } from '../../../services/SnapService';
import { positionFromPointer } from '../../../services/ResourcePlacement';
import { screenToWorld, type Point } from '../canvas/ViewportTransform';

interface ActiveResourceDrag {
  readonly pointerId: number;
  readonly resourceId: string;
  readonly offset: Point;
  readonly original: Point;
  pending: Point | null;
  frame: number;
}

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || (target instanceof HTMLElement && target.isContentEditable);
}

export class ResourceInteractionController {
  private active: ActiveResourceDrag | null = null;

  public constructor(
    private readonly viewport: HTMLElement,
    _application: HTMLElement,
    private readonly state: CanvasState,
    private readonly store: ResourceStore,
    private readonly snap: SnapService,
    private readonly onStatus: (message: string) => void,
  ) {
    viewport.addEventListener('pointerdown', this.handlePointerDown);
    viewport.addEventListener('pointermove', this.handlePointerMove);
    viewport.addEventListener('pointerup', this.handlePointerUp);
    viewport.addEventListener('pointercancel', this.handlePointerCancel);
    viewport.addEventListener('lostpointercapture', this.handleLostCapture);
    document.addEventListener('keydown', this.handleKeyDown);
  }

  public deleteSelection(): void {
    const result = this.store.deleteSelected();
    if (result === 'deleted') this.onStatus('Resource deleted');
    else if (result === 'locked') this.onStatus('Resource is locked');
    else this.onStatus('No resource selected');
  }

  public cancelActiveDrag(): void { this.cancelDrag(); }

  public dispose(): void {
    this.cancelDrag();
    this.viewport.removeEventListener('pointerdown', this.handlePointerDown);
    this.viewport.removeEventListener('pointermove', this.handlePointerMove);
    this.viewport.removeEventListener('pointerup', this.handlePointerUp);
    this.viewport.removeEventListener('pointercancel', this.handlePointerCancel);
    this.viewport.removeEventListener('lostpointercapture', this.handleLostCapture);
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  private readonly localPoint = (event: PointerEvent): Point => {
    const bounds = this.viewport.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || this.state.tool !== 'select') return;
    const target = event.target instanceof Element ? event.target.closest<SVGGElement>('[data-resource-id]') : null;
    const resourceId = target?.dataset.resourceId;
    if (!resourceId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.viewport.focus({ preventScroll: true });
    this.store.selectResource(resourceId);
    const resource = this.store.getResource(resourceId);
    if (!resource) return;
    if (resource.locked) {
      this.onStatus('Resource is locked');
      return;
    }
    const pointerWorld = screenToWorld(this.localPoint(event), this.state);
    this.active = {
      pointerId: event.pointerId,
      resourceId,
      offset: { x: pointerWorld.x - resource.worldX, y: pointerWorld.y - resource.worldY },
      original: { x: resource.worldX, y: resource.worldY },
      pending: null,
      frame: 0,
    };
    this.viewport.setPointerCapture(event.pointerId);
    target.classList.add('placed-resource--moving');
    this.onStatus('Moving resource');
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (!this.active || event.pointerId !== this.active.pointerId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const pointerWorld = screenToWorld(this.localPoint(event), this.state);
    this.active.pending = this.snap.snapPoint(positionFromPointer(pointerWorld, this.active.offset), event.altKey);
    if (this.active.frame === 0) this.active.frame = requestAnimationFrame(this.flushPendingMove);
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (this.active?.pointerId !== event.pointerId) return;
    event.stopImmediatePropagation();
    this.finishDrag(true);
  };

  private readonly handlePointerCancel = (event: PointerEvent): void => {
    if (this.active?.pointerId === event.pointerId) this.finishDrag(false);
  };

  private readonly handleLostCapture = (event: PointerEvent): void => {
    if (this.active?.pointerId === event.pointerId) this.finishDrag(false);
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.active) {
      event.preventDefault();
      this.finishDrag(false);
      return;
    }
    if (isTypingTarget(event.target)) return;
    if ((event.key === 'Enter' || event.key === ' ') && event.target instanceof Element) {
      const resourceId = event.target.closest<SVGGElement>('[data-resource-id]')?.dataset.resourceId;
      if (resourceId) {
        event.preventDefault();
        this.store.selectResource(resourceId);
      }
    }
  };

  private readonly flushPendingMove = (): void => {
    if (!this.active) return;
    this.active.frame = 0;
    const pending = this.active.pending;
    this.active.pending = null;
    if (pending) this.store.moveResource(this.active.resourceId, pending.x, pending.y);
  };

  private finishDrag(commit: boolean): void {
    const active = this.active;
    if (!active) return;
    if (active.frame !== 0) cancelAnimationFrame(active.frame);
    if (commit && active.pending) this.store.moveResource(active.resourceId, active.pending.x, active.pending.y);
    if (!commit) this.store.moveResource(active.resourceId, active.original.x, active.original.y);
    this.active = null;
    const node = this.viewport.querySelector<HTMLElement>(`[data-resource-id="${active.resourceId}"]`);
    node?.classList.remove('placed-resource--moving');
    if (this.viewport.hasPointerCapture(active.pointerId)) this.viewport.releasePointerCapture(active.pointerId);
    this.onStatus(commit ? 'Resource position updated' : 'Resource move cancelled');
  }

  private cancelDrag(): void {
    this.finishDrag(false);
  }
}
