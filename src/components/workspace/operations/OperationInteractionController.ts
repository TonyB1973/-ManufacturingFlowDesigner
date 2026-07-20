import type { CanvasState } from '../../../models/canvas/CanvasState';
import type { OperationStore } from '../../../services/OperationStore';
import { operationPositionFromPointer } from '../../../services/OperationPlacement';
import type { SnapService } from '../../../services/SnapService';
import { screenToWorld, type Point } from '../canvas/ViewportTransform';

interface ActiveDrag { readonly pointerId: number; readonly operationId: string; readonly offset: Point; readonly original: Point; pending: Point | null; frame: number; }
export class OperationInteractionController {
  private active: ActiveDrag | null = null;
  public constructor(private readonly viewport: HTMLElement, private readonly state: CanvasState, private readonly store: OperationStore, private readonly snap: SnapService, private readonly onStatus: (message: string) => void) {
    viewport.addEventListener('pointerdown', this.pointerDown); viewport.addEventListener('pointermove', this.pointerMove); viewport.addEventListener('pointerup', this.pointerUp); viewport.addEventListener('pointercancel', this.pointerCancel); viewport.addEventListener('lostpointercapture', this.lostCapture); document.addEventListener('keydown', this.keyDown);
  }
  public deleteSelection(): void { const result = this.store.deleteSelected(); this.onStatus(result === 'deleted' ? 'Operation deleted' : result === 'locked' ? 'Operation is locked' : 'No operation selected'); }
  public cancelActiveDrag(): void { this.finish(false); }
  public dispose(): void { this.cancelActiveDrag(); this.viewport.removeEventListener('pointerdown', this.pointerDown); this.viewport.removeEventListener('pointermove', this.pointerMove); this.viewport.removeEventListener('pointerup', this.pointerUp); this.viewport.removeEventListener('pointercancel', this.pointerCancel); this.viewport.removeEventListener('lostpointercapture', this.lostCapture); document.removeEventListener('keydown', this.keyDown); }
  private local(event: PointerEvent): Point { const bounds = this.viewport.getBoundingClientRect(); return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }; }
  private readonly pointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || this.state.tool !== 'select') return; const target = event.target instanceof Element ? event.target.closest<SVGGElement>('[data-operation-id]') : null; const id = target?.dataset.operationId; if (!id) return;
    event.preventDefault(); event.stopImmediatePropagation(); this.viewport.focus({ preventScroll: true }); this.store.selectOperation(id); const operation = this.store.getOperation(id); if (!operation) return;
    if (operation.locked) { this.onStatus('Operation is locked'); return; } const world = screenToWorld(this.local(event), this.state);
    this.active = { pointerId: event.pointerId, operationId: id, offset: { x: world.x - operation.worldX, y: world.y - operation.worldY }, original: { x: operation.worldX, y: operation.worldY }, pending: null, frame: 0 };
    this.viewport.setPointerCapture(event.pointerId); target.classList.add('placed-operation--moving'); this.onStatus('Moving operation');
  };
  private readonly pointerMove = (event: PointerEvent): void => { if (!this.active || event.pointerId !== this.active.pointerId) return; event.preventDefault(); event.stopImmediatePropagation(); const world = screenToWorld(this.local(event), this.state); this.active.pending = this.snap.snapPoint(operationPositionFromPointer(world, this.active.offset), event.altKey); if (!this.active.frame) this.active.frame = requestAnimationFrame(this.flush); };
  private readonly pointerUp = (event: PointerEvent): void => { if (this.active?.pointerId === event.pointerId) { event.stopImmediatePropagation(); this.finish(true); } };
  private readonly pointerCancel = (event: PointerEvent): void => { if (this.active?.pointerId === event.pointerId) this.finish(false); };
  private readonly lostCapture = (event: PointerEvent): void => { if (this.active?.pointerId === event.pointerId) this.finish(false); };
  private readonly keyDown = (event: KeyboardEvent): void => { if (event.key === 'Escape' && this.active) { event.preventDefault(); this.finish(false); } else if ((event.key === 'Enter' || event.key === ' ') && event.target instanceof Element) { const id = event.target.closest<SVGGElement>('[data-operation-id]')?.dataset.operationId; if (id) { event.preventDefault(); this.store.selectOperation(id); } } };
  private readonly flush = (): void => { if (!this.active) return; this.active.frame = 0; const pending = this.active.pending; this.active.pending = null; if (pending) this.store.moveOperation(this.active.operationId, pending.x, pending.y); };
  private finish(commit: boolean): void { const active = this.active; if (!active) return; if (active.frame) cancelAnimationFrame(active.frame); if (commit && active.pending) this.store.moveOperation(active.operationId, active.pending.x, active.pending.y); if (!commit) this.store.moveOperation(active.operationId, active.original.x, active.original.y); this.active = null; this.viewport.querySelector(`[data-operation-id="${active.operationId}"]`)?.classList.remove('placed-operation--moving'); if (this.viewport.hasPointerCapture(active.pointerId)) this.viewport.releasePointerCapture(active.pointerId); this.onStatus(commit ? 'Operation position updated' : 'Operation move cancelled'); }
}
