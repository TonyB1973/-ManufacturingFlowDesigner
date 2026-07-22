import type { CanvasState } from '../../../models/canvas/CanvasState';
import type { SelectionController, SelectionItem } from '../../../models/selection/Selection';
import type { FactoryStructureStore } from '../../../services/FactoryStructureStore';
import type { GeometryPoint } from '../../../services/geometry/FactoryFootprintGeometry';
import type { CommandFactory } from '../../../services/history/CommandFactory';
import type { SnapService } from '../../../services/SnapService';
import { screenToWorld } from '../canvas/ViewportTransform';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const svg = <K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] => document.createElementNS(SVG_NAMESPACE, tag);
type StructureItem = Extract<SelectionItem, { readonly kind: 'boundary' | 'wall' | 'area' | 'aisle' }>;
type Snapshot =
  | { readonly kind: 'boundary'; readonly id: string; readonly points: readonly GeometryPoint[] }
  | { readonly kind: 'wall'; readonly id: string; readonly start: GeometryPoint; readonly end: GeometryPoint }
  | { readonly kind: 'area'; readonly id: string; readonly worldX: number; readonly worldY: number; readonly width: number; readonly depth: number }
  | { readonly kind: 'aisle'; readonly id: string; readonly points: readonly GeometryPoint[] };
interface Gesture { readonly pointerId: number; readonly item: StructureItem; readonly mode: 'move' | 'vertex' | 'resize'; readonly index: number; readonly startPointer: GeometryPoint; readonly before: Snapshot; }

export class FactoryStructureEditController {
  private gesture: Gesture | null = null;
  private readonly unsubscribers: (() => void)[];

  public constructor(
    private readonly viewport: HTMLElement,
    private readonly layer: SVGGElement,
    private readonly state: CanvasState,
    private readonly store: FactoryStructureStore,
    private readonly selection: SelectionController,
    private readonly snap: SnapService,
    private readonly commands: CommandFactory,
    private readonly onStatus: (message: string) => void,
  ) {
    viewport.addEventListener('pointerdown', this.pointerDown, true); viewport.addEventListener('pointermove', this.pointerMove, true); viewport.addEventListener('pointerup', this.pointerUp, true); viewport.addEventListener('pointercancel', this.pointerCancel, true); document.addEventListener('keydown', this.keyDown);
    this.unsubscribers = [store.subscribe(() => this.render()), selection.subscribe(() => this.render())]; this.render();
  }

  public viewportChanged(): void { this.render(); }
  public cancel(report = false): void { const active = this.gesture; if (!active) return; this.restore(active.before); if (this.viewport.hasPointerCapture(active.pointerId)) this.viewport.releasePointerCapture(active.pointerId); this.gesture = null; if (report) this.onStatus('Structure edit cancelled'); this.render(); }
  public dispose(): void { this.cancel(); this.unsubscribers.forEach((unsubscribe) => unsubscribe()); this.viewport.removeEventListener('pointerdown', this.pointerDown, true); this.viewport.removeEventListener('pointermove', this.pointerMove, true); this.viewport.removeEventListener('pointerup', this.pointerUp, true); this.viewport.removeEventListener('pointercancel', this.pointerCancel, true); document.removeEventListener('keydown', this.keyDown); this.layer.replaceChildren(); }

  private readonly pointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || this.state.tool !== 'select') return; const target = event.target instanceof Element ? event.target : null; if (!target) return;
    const handle = target.closest<SVGElement>('[data-structure-handle]'); const item = this.itemFromTarget(target); if (!item) return; const before = this.snapshot(item); if (!before || this.locked(item)) return;
    if (!this.selection.contains(item)) this.selection.select(item);
    const mode = handle?.dataset.structureHandle === 'vertex' ? 'vertex' : handle?.dataset.structureHandle === 'resize' ? 'resize' : item.kind === 'boundary' ? null : 'move'; if (!mode) return;
    event.preventDefault(); event.stopImmediatePropagation(); this.gesture = { pointerId: event.pointerId, item, mode, index: Number(handle?.dataset.index ?? -1), startPointer: this.world(event, event.altKey), before }; this.viewport.setPointerCapture(event.pointerId);
  };
  private readonly pointerMove = (event: PointerEvent): void => { const active = this.gesture; if (!active || event.pointerId !== active.pointerId) return; event.preventDefault(); const point = this.world(event, event.altKey); const dx = point.x - active.startPointer.x; const dy = point.y - active.startPointer.y; this.preview(active, point, dx, dy); };
  private readonly pointerUp = (event: PointerEvent): void => { const active = this.gesture; if (!active || event.pointerId !== active.pointerId) return; event.preventDefault(); event.stopImmediatePropagation(); const after = this.snapshot(active.item); this.restore(active.before); if (this.viewport.hasPointerCapture(event.pointerId)) this.viewport.releasePointerCapture(event.pointerId); this.gesture = null; const committed = after ? this.commit(active.item, after) : false; this.onStatus(committed ? `${active.item.kind} geometry updated` : `${active.item.kind} geometry unchanged or invalid`); this.render(); };
  private readonly pointerCancel = (event: PointerEvent): void => { if (this.gesture?.pointerId === event.pointerId) this.cancel(true); };
  private readonly keyDown = (event: KeyboardEvent): void => { if (event.key === 'Escape' && this.gesture) { event.preventDefault(); event.stopImmediatePropagation(); this.cancel(true); } };

  private preview(active: Gesture, point: GeometryPoint, dx: number, dy: number): void {
    const before = active.before;
    if (active.mode === 'move') {
      if (before.kind === 'wall') this.store.updateWall(before.id, { start: { x: before.start.x + dx, y: before.start.y + dy }, end: { x: before.end.x + dx, y: before.end.y + dy } });
      else if (before.kind === 'area') this.store.updateArea(before.id, { worldX: before.worldX + dx, worldY: before.worldY + dy });
      else if (before.kind === 'aisle') this.store.updateAisle(before.id, { points: before.points.map((value) => ({ x: value.x + dx, y: value.y + dy })) });
      return;
    }
    if (before.kind === 'boundary') this.store.updateBoundary(before.id, { points: this.moveOrthogonalVertex(before.points, active.index, point, true) });
    else if (before.kind === 'wall') { const horizontal = before.start.y === before.end.y; const constrained = horizontal ? { x: point.x, y: active.index === 0 ? before.end.y : before.start.y } : { x: active.index === 0 ? before.end.x : before.start.x, y: point.y }; this.store.updateWall(before.id, active.index === 0 ? { start: constrained } : { end: constrained }); }
    else if (before.kind === 'aisle') this.store.updateAisle(before.id, { points: this.moveOrthogonalVertex(before.points, active.index, point, false) });
    else if (before.kind === 'area') { const signs = [[-1, -1], [1, -1], [1, 1], [-1, 1]][active.index] ?? [1, 1]; const opposite = { x: before.worldX - signs[0] * before.width / 2, y: before.worldY - signs[1] * before.depth / 2 }; const width = Math.max(100, Math.abs(point.x - opposite.x)); const depth = Math.max(100, Math.abs(point.y - opposite.y)); this.store.updateArea(before.id, { worldX: (point.x + opposite.x) / 2, worldY: (point.y + opposite.y) / 2, width, depth }); }
  }

  private moveOrthogonalVertex(source: readonly GeometryPoint[], index: number, point: GeometryPoint, closed: boolean): GeometryPoint[] {
    const values = source.map((value) => ({ ...value })); if (!values[index]) return values; const previous = index > 0 ? index - 1 : closed ? values.length - 1 : -1; const next = index < values.length - 1 ? index + 1 : closed ? 0 : -1; const original = values[index]; values[index] = { ...point };
    if (previous >= 0) { if (values[previous].x === original.x) values[previous].x = point.x; else values[previous].y = point.y; }
    if (next >= 0) { if (values[next].x === original.x) values[next].x = point.x; else values[next].y = point.y; }
    return values;
  }
  private commit(item: StructureItem, after: Snapshot): boolean { if (after.kind === 'boundary') return this.commands.updateBoundary(item.id, { points: [...after.points] }, `Edit boundary ${item.id}`); if (after.kind === 'wall') return this.commands.updateWall(item.id, { start: after.start, end: after.end }, `Edit wall ${item.id}`); if (after.kind === 'area') return this.commands.updateArea(item.id, { worldX: after.worldX, worldY: after.worldY, width: after.width, depth: after.depth }, `Edit area ${item.id}`); return this.commands.updateAisle(item.id, { points: [...after.points] }, `Edit aisle ${item.id}`); }
  private restore(snapshot: Snapshot): void { if (snapshot.kind === 'boundary') this.store.updateBoundary(snapshot.id, { points: [...snapshot.points] }); else if (snapshot.kind === 'wall') this.store.updateWall(snapshot.id, { start: snapshot.start, end: snapshot.end }); else if (snapshot.kind === 'area') this.store.updateArea(snapshot.id, { worldX: snapshot.worldX, worldY: snapshot.worldY, width: snapshot.width, depth: snapshot.depth }); else this.store.updateAisle(snapshot.id, { points: [...snapshot.points] }); }
  private snapshot(item: StructureItem): Snapshot | null { if (item.kind === 'boundary') { const value = this.store.getBoundary(item.id); return value ? { kind: item.kind, id: item.id, points: value.points.map((point) => ({ ...point })) } : null; } if (item.kind === 'wall') { const value = this.store.getWall(item.id); return value ? { kind: item.kind, id: item.id, start: { ...value.start }, end: { ...value.end } } : null; } if (item.kind === 'area') { const value = this.store.getArea(item.id); return value ? { kind: item.kind, id: item.id, worldX: value.worldX, worldY: value.worldY, width: value.width, depth: value.depth } : null; } const value = this.store.getAisle(item.id); return value ? { kind: item.kind, id: item.id, points: value.points.map((point) => ({ ...point })) } : null; }
  private locked(item: StructureItem): boolean { return item.kind === 'boundary' ? Boolean(this.store.getBoundary(item.id)?.locked) : item.kind === 'wall' ? Boolean(this.store.getWall(item.id)?.locked) : item.kind === 'area' ? Boolean(this.store.getArea(item.id)?.locked) : Boolean(this.store.getAisle(item.id)?.locked); }
  private itemFromTarget(target: Element): StructureItem | null { const entity = target.closest<SVGElement>('[data-boundary-id], [data-wall-id], [data-area-id], [data-aisle-id], [data-structure-entity-kind]'); const kind = entity?.dataset.structureEntityKind; const id = kind ? entity?.dataset.structureEntityId : entity?.dataset.boundaryId ?? entity?.dataset.wallId ?? entity?.dataset.areaId ?? entity?.dataset.aisleId; const resolvedKind = kind ?? (entity?.dataset.boundaryId ? 'boundary' : entity?.dataset.wallId ? 'wall' : entity?.dataset.areaId ? 'area' : entity?.dataset.aisleId ? 'aisle' : ''); return id && ['boundary', 'wall', 'area', 'aisle'].includes(resolvedKind) ? { kind: resolvedKind as StructureItem['kind'], id } : null; }
  private world(event: PointerEvent, bypass: boolean): GeometryPoint { const bounds = this.viewport.getBoundingClientRect(); return this.snap.snapPoint(screenToWorld({ x: event.clientX - bounds.left, y: event.clientY - bounds.top }, this.state), bypass); }

  private render(): void { if (this.gesture) return; this.layer.replaceChildren(); if (this.state.tool !== 'select') return; const item = this.selection.getState().items.length === 1 ? this.selection.getState().primary : null; if (!item || !['boundary', 'wall', 'area', 'aisle'].includes(item.kind) || this.locked(item as StructureItem)) return; const selected = item as StructureItem; const points = selected.kind === 'boundary' ? this.store.getBoundary(selected.id)?.points : selected.kind === 'wall' ? [this.store.getWall(selected.id)?.start, this.store.getWall(selected.id)?.end].filter((point): point is GeometryPoint => Boolean(point)) : selected.kind === 'aisle' ? this.store.getAisle(selected.id)?.points : selected.kind === 'area' ? this.areaCorners(selected.id) : []; for (const [index, point] of (points ?? []).entries()) { const handle = svg('circle'); handle.setAttribute('cx', String(point.x)); handle.setAttribute('cy', String(point.y)); handle.setAttribute('r', String(7 / this.state.zoom)); handle.classList.add('factory-structure-handle'); handle.dataset.structureHandle = selected.kind === 'area' ? 'resize' : 'vertex'; handle.dataset.index = String(index); handle.dataset.structureEntityKind = selected.kind; handle.dataset.structureEntityId = selected.id; handle.setAttribute('aria-label', `${selected.kind} ${selected.id} ${selected.kind === 'area' ? 'resize' : 'vertex'} ${index + 1}`); this.layer.append(handle); } }
  private areaCorners(id: string): GeometryPoint[] { const item = this.store.getArea(id); if (!item) return []; const halfWidth = item.width / 2; const halfDepth = item.depth / 2; return [{ x: item.worldX - halfWidth, y: item.worldY - halfDepth }, { x: item.worldX + halfWidth, y: item.worldY - halfDepth }, { x: item.worldX + halfWidth, y: item.worldY + halfDepth }, { x: item.worldX - halfWidth, y: item.worldY + halfDepth }]; }
}
