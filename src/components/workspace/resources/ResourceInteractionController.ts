import type { CanvasState } from '../../../models/canvas/CanvasState';
import type { ResourceStore } from '../../../services/ResourceStore';
import type { SnapService } from '../../../services/SnapService';
import { positionFromPointer } from '../../../services/ResourcePlacement';
import { screenToWorld, type Point } from '../canvas/ViewportTransform';
import type { CommandFactory } from '../../../services/history/CommandFactory';
import type { SelectionController } from '../../../models/selection/Selection';
import type { ApplicationClipboardService } from '../../../services/editing/ApplicationClipboardService';

interface ActiveResourceDrag {
  readonly pointerId: number;
  readonly resourceId: string;
  readonly offset: Point;
  readonly original: Point;
  readonly originals: readonly { readonly id: string; readonly point: Point }[];
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
    private readonly commands: CommandFactory,
    private readonly selection: SelectionController,
    private readonly editing: ApplicationClipboardService,
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
    const selected = this.store.getSelectedResource(); const result = selected ? this.commands.deleteResource(selected.id) : 'none';
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
    const ref = { kind: 'resource' as const, id: resourceId };
    if (event.ctrlKey || event.metaKey) { const selected = this.selection.contains(ref); this.selection.toggle(ref); if (selected) { this.onStatus('Resource removed from selection'); return; } }
    else if (event.shiftKey) this.selection.add(ref); else if (this.selection.contains(ref)) this.selection.set(this.selection.getState().items, ref); else this.selection.select(ref);
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
      originals: this.selection.getState().items.filter((item) => item.kind === 'resource').map((item) => this.store.getResource(item.id)).filter((item): item is NonNullable<typeof item> => Boolean(item && !item.locked)).map((item) => ({ id: item.id, point: { x: item.worldX, y: item.worldY } })),
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
  private openMenu(id: string, x: number, y: number): void { const ref = { kind: 'resource' as const, id }; if (!this.selection.contains(ref)) this.selection.select(ref); this.menu.replaceChildren(); const add = (label: string, action: () => void): void => { const button = document.createElement('button'); button.type = 'button'; button.className = 'resource-context-menu__item'; button.setAttribute('role', 'menuitem'); button.textContent = label; button.addEventListener('click', () => { action(); this.closeMenu(); }); this.menu.append(button); }; add('Cut', () => this.onStatus(this.editing.cut((message) => window.confirm(message)).message)); add('Copy', () => this.onStatus(this.editing.copy().message)); add('Paste', () => this.onStatus(this.editing.paste().message)); add('Duplicate', () => this.onStatus(this.editing.duplicate().message)); add('Delete', () => this.onStatus(this.editing.deleteSelection((message) => window.confirm(message)).message)); this.menu.hidden = false; this.menu.style.left = `${Math.min(Math.max(0, x), Math.max(0, this.viewport.clientWidth - 185))}px`; this.menu.style.top = `${Math.min(Math.max(0, y), Math.max(0, this.viewport.clientHeight - 190))}px`; this.menu.querySelector<HTMLButtonElement>('button')?.focus(); }
  private closeMenu(): void { this.menu.hidden = true; this.menu.replaceChildren(); this.viewport.focus({ preventScroll: true }); }

  private readonly flushPendingMove = (): void => {
    if (!this.active) return;
    this.active.frame = 0;
    const pending = this.active.pending;
    this.active.pending = null;
    if (pending) { const dx = pending.x - this.active.original.x; const dy = pending.y - this.active.original.y; for (const item of this.active.originals) this.store.moveResource(item.id, item.point.x + dx, item.point.y + dy); }
  };

  private finishDrag(commit: boolean): void {
    const active = this.active;
    if (!active) return;
    if (active.frame !== 0) cancelAnimationFrame(active.frame);
    if (commit && active.pending) { const dx = active.pending.x - active.original.x; const dy = active.pending.y - active.original.y; for (const item of active.originals) this.store.moveResource(item.id, item.point.x + dx, item.point.y + dy); }
    if (!commit) for (const item of active.originals) this.store.moveResource(item.id, item.point.x, item.point.y);
    const final = this.store.getResource(active.resourceId); const changed = Boolean(commit && final && (final.worldX !== active.original.x || final.worldY !== active.original.y));
    if (changed && final) this.commands.commitResourceGroupMove(active.originals.map((item) => ({ id: item.id, before: item.point, after: { x: this.store.getResource(item.id)?.worldX ?? item.point.x, y: this.store.getResource(item.id)?.worldY ?? item.point.y } })));
    this.active = null;
    const node = this.viewport.querySelector<HTMLElement>(`[data-resource-id="${active.resourceId}"]`);
    node?.classList.remove('placed-resource--moving');
    if (this.viewport.hasPointerCapture(active.pointerId)) this.viewport.releasePointerCapture(active.pointerId);
    this.onStatus(commit ? changed ? `${active.originals.length} resource${active.originals.length === 1 ? '' : 's'} moved` : 'Resource position unchanged' : 'Resource move cancelled');
  }

  private cancelDrag(): void {
    this.finishDrag(false);
  }
}
