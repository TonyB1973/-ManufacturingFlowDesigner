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
  private readonly menu = document.createElement('div');

  public constructor(
    private readonly viewport: HTMLElement,
    _application: HTMLElement,
    private readonly state: CanvasState,
    private readonly store: ResourceStore,
    private readonly snap: SnapService,
    private readonly onStatus: (message: string) => void,
    private readonly requestDelete?: (resourceId: string) => void,
  ) {
    this.menu.className = 'resource-context-menu'; this.menu.setAttribute('role', 'menu'); this.menu.hidden = true; viewport.append(this.menu);
    viewport.addEventListener('pointerdown', this.handlePointerDown);
    viewport.addEventListener('pointermove', this.handlePointerMove);
    viewport.addEventListener('pointerup', this.handlePointerUp);
    viewport.addEventListener('pointercancel', this.handlePointerCancel);
    viewport.addEventListener('lostpointercapture', this.handleLostCapture);
    document.addEventListener('keydown', this.handleKeyDown);
    viewport.addEventListener('contextmenu', this.handleContextMenu); document.addEventListener('pointerdown', this.handleOutsideMenu, true);
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
    this.viewport.removeEventListener('contextmenu', this.handleContextMenu); document.removeEventListener('pointerdown', this.handleOutsideMenu, true); this.menu.remove();
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
    if (event.key === 'Escape' && !this.menu.hidden) { event.preventDefault(); this.closeMenu(); return; }
    if (event.key === 'Escape' && this.active) {
      event.preventDefault();
      this.finishDrag(false);
      return;
    }
    if (isTypingTarget(event.target)) return;
    if ((event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) && event.target instanceof Element) { const id = event.target.closest<SVGGElement>('[data-resource-id]')?.dataset.resourceId; if (id) { event.preventDefault(); const bounds = this.viewport.getBoundingClientRect(); this.openMenu(id, bounds.width / 2, bounds.height / 2); return; } }
    if ((event.key === 'Enter' || event.key === ' ') && event.target instanceof Element) {
      const resourceId = event.target.closest<SVGGElement>('[data-resource-id]')?.dataset.resourceId;
      if (resourceId) {
        event.preventDefault();
        this.store.selectResource(resourceId);
      }
    }
  };

  private readonly handleContextMenu = (event: MouseEvent): void => { const id = event.target instanceof Element ? event.target.closest<SVGGElement>('[data-resource-id]')?.dataset.resourceId : undefined; if (!id) return; event.preventDefault(); const bounds = this.viewport.getBoundingClientRect(); this.openMenu(id, event.clientX - bounds.left, event.clientY - bounds.top); };
  private readonly handleOutsideMenu = (event: PointerEvent): void => { if (!this.menu.hidden && event.target instanceof Node && !this.menu.contains(event.target)) this.closeMenu(); };
  private openMenu(id: string, x: number, y: number): void { this.store.selectResource(id); this.menu.replaceChildren(); const add = (label: string, action: () => void): void => { const button = document.createElement('button'); button.type = 'button'; button.className = 'resource-context-menu__item'; button.setAttribute('role', 'menuitem'); button.textContent = label; button.addEventListener('click', () => { action(); this.closeMenu(); }); this.menu.append(button); }; add('Duplicate Resource', () => { const copy = this.store.duplicateResource(id); this.onStatus(copy ? `Resource duplicated: ${copy.id}` : 'Resource could not be duplicated'); }); add('Delete Resource', () => this.requestDelete?.(id)); this.menu.hidden = false; this.menu.style.left = `${Math.min(Math.max(0, x), Math.max(0, this.viewport.clientWidth - 185))}px`; this.menu.style.top = `${Math.min(Math.max(0, y), Math.max(0, this.viewport.clientHeight - 90))}px`; this.menu.querySelector<HTMLButtonElement>('button')?.focus(); }
  private closeMenu(): void { this.menu.hidden = true; this.menu.replaceChildren(); this.viewport.focus({ preventScroll: true }); }

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
