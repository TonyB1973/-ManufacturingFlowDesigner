import type { CanvasState } from '../../../models/canvas/CanvasState';
import type { ResourceStore } from '../../../services/ResourceStore';
import type { CommandFactory } from '../../../services/history/CommandFactory';
import { screenToWorld } from '../canvas/ViewportTransform';

interface ActiveRotation { readonly pointerId: number; readonly resourceId: string; readonly original: number; readonly startPointerAngle: number; }

export class ResourceRotationController {
  private active: ActiveRotation | null = null;
  public constructor(private readonly viewport: HTMLElement, private readonly state: CanvasState, private readonly resources: ResourceStore, private readonly commands: CommandFactory, private readonly onStatus: (message: string) => void) {
    viewport.addEventListener('pointerdown', this.pointerDown); viewport.addEventListener('pointermove', this.pointerMove); viewport.addEventListener('pointerup', this.pointerUp); viewport.addEventListener('pointercancel', this.pointerCancel); viewport.addEventListener('lostpointercapture', this.pointerCancel); document.addEventListener('keydown', this.keyDown);
  }
  public cancel(): void { this.finish(false); }
  public dispose(): void { this.cancel(); this.viewport.removeEventListener('pointerdown', this.pointerDown); this.viewport.removeEventListener('pointermove', this.pointerMove); this.viewport.removeEventListener('pointerup', this.pointerUp); this.viewport.removeEventListener('pointercancel', this.pointerCancel); this.viewport.removeEventListener('lostpointercapture', this.pointerCancel); document.removeEventListener('keydown', this.keyDown); }
  private world(event: PointerEvent) { const bounds = this.viewport.getBoundingClientRect(); return screenToWorld({ x: event.clientX - bounds.left, y: event.clientY - bounds.top }, this.state); }
  private angle(event: PointerEvent, resourceId: string): number { const resource = this.resources.getResource(resourceId)!; const point = this.world(event); return Math.atan2(point.y - resource.worldY, point.x - resource.worldX) * 180 / Math.PI; }
  private readonly pointerDown = (event: PointerEvent): void => { if (event.button !== 0) return; const id = event.target instanceof Element ? event.target.closest<SVGElement>('[data-rotation-handle]')?.dataset.rotationHandle : undefined; if (!id) return; const resource = this.resources.getResource(id); if (!resource || resource.locked) return; event.preventDefault(); event.stopImmediatePropagation(); this.active = { pointerId: event.pointerId, resourceId: id, original: resource.rotationDegrees, startPointerAngle: this.angle(event, id) }; this.viewport.setPointerCapture(event.pointerId); this.onStatus('Rotating resource — 5° snap, Shift 15°, Alt free'); };
  private readonly pointerMove = (event: PointerEvent): void => { const active = this.active; if (!active || active.pointerId !== event.pointerId) return; event.preventDefault(); event.stopImmediatePropagation(); const raw = active.original + this.angle(event, active.resourceId) - active.startPointerAngle; const increment = event.altKey ? 0 : event.shiftKey ? 15 : 5; const value = increment ? Math.round(raw / increment) * increment : raw; this.resources.updateResource(active.resourceId, { rotationDegrees: value }); };
  private readonly pointerUp = (event: PointerEvent): void => { if (this.active?.pointerId === event.pointerId) { event.stopImmediatePropagation(); this.finish(true); } };
  private readonly pointerCancel = (event: PointerEvent): void => { if (this.active?.pointerId === event.pointerId) this.finish(false); };
  private readonly keyDown = (event: KeyboardEvent): void => { if (event.key === 'Escape' && this.active) { event.preventDefault(); this.finish(false); } };
  private finish(commit: boolean): void { const active = this.active; if (!active) return; const resource = this.resources.getResource(active.resourceId); const final = resource?.rotationDegrees ?? active.original; this.active = null; if (this.viewport.hasPointerCapture(active.pointerId)) this.viewport.releasePointerCapture(active.pointerId); if (!commit) { this.resources.updateResource(active.resourceId, { rotationDegrees: active.original }); this.onStatus('Rotation cancelled'); return; } if (final !== active.original) { this.commands.commitResourceRotation(active.resourceId, active.original, final); this.onStatus(`Resource rotated to ${final.toFixed(1)}°`); } else this.onStatus('Rotation unchanged'); }
}
