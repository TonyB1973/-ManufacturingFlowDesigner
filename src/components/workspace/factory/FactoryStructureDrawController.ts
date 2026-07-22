import type { CanvasState, CanvasTool } from '../../../models/canvas/CanvasState';
import type { CommandFactory } from '../../../services/history/CommandFactory';
import type { SnapService } from '../../../services/SnapService';
import { screenToWorld } from '../canvas/ViewportTransform';
import type { GeometryPoint } from '../../../services/geometry/FactoryFootprintGeometry';
import type { FactoryStructureStore } from '../../../services/FactoryStructureStore';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const svg = <K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] => document.createElementNS(SVG_NAMESPACE, tag);
const drawingTools = new Set<CanvasTool>(['draw-boundary-rect', 'draw-boundary-orthogonal', 'draw-wall', 'draw-area', 'draw-aisle']);

export class FactoryStructureDrawController {
  private drag: { readonly pointerId: number; readonly start: GeometryPoint; current: GeometryPoint; readonly tool: 'draw-boundary-rect' | 'draw-wall' | 'draw-area' } | null = null;
  private points: GeometryPoint[] = [];
  private hover: GeometryPoint | null = null;

  public constructor(
    private readonly viewport: HTMLElement,
    private readonly state: CanvasState,
    private readonly snap: SnapService,
    private readonly commands: CommandFactory,
    private readonly structure: FactoryStructureStore,
    private readonly previewLayer: SVGGElement,
    private readonly onStatus: (message: string) => void,
    private readonly selectTool: () => void,
  ) {
    viewport.addEventListener('pointerdown', this.pointerDown, true); viewport.addEventListener('pointermove', this.pointerMove, true); viewport.addEventListener('pointerup', this.pointerUp, true); viewport.addEventListener('pointercancel', this.pointerCancel, true); document.addEventListener('keydown', this.keyDown);
  }

  public toolChanged(): void { if (!drawingTools.has(this.state.tool)) this.cancel(false); else this.onStatus(this.prompt()); }
  public cancel(report = true): void { const hadDrawing = Boolean(this.drag || this.points.length); if (this.drag && this.viewport.hasPointerCapture(this.drag.pointerId)) this.viewport.releasePointerCapture(this.drag.pointerId); this.drag = null; this.points = []; this.hover = null; this.previewLayer.replaceChildren(); if (report && hadDrawing) this.onStatus('Drawing cancelled'); }
  public dispose(): void { this.cancel(false); this.viewport.removeEventListener('pointerdown', this.pointerDown, true); this.viewport.removeEventListener('pointermove', this.pointerMove, true); this.viewport.removeEventListener('pointerup', this.pointerUp, true); this.viewport.removeEventListener('pointercancel', this.pointerCancel, true); document.removeEventListener('keydown', this.keyDown); }

  private readonly pointerDown = (event: PointerEvent): void => {
    if (!drawingTools.has(this.state.tool) || event.button !== 0) return; if ((event.target as Element | null)?.closest('button, input, textarea, select')) return;
    event.preventDefault(); event.stopImmediatePropagation(); const point = this.world(event, event.altKey);
    if (this.state.tool === 'draw-boundary-rect' || this.state.tool === 'draw-wall' || this.state.tool === 'draw-area') { this.drag = { pointerId: event.pointerId, start: point, current: point, tool: this.state.tool }; this.viewport.setPointerCapture(event.pointerId); this.render(); return; }
    const orthogonal = this.points.length ? this.constrain(this.points.at(-1)!, point) : point;
    if (this.state.tool === 'draw-boundary-orthogonal' && this.points.length >= 4 && Math.hypot(point.x - this.points[0].x, point.y - this.points[0].y) <= 12 / this.state.zoom) { this.finishPolyline(); return; }
    if (!this.points.length || orthogonal.x !== this.points.at(-1)!.x || orthogonal.y !== this.points.at(-1)!.y) this.points.push(orthogonal); this.hover = orthogonal; this.onStatus(this.prompt()); this.render();
  };
  private readonly pointerMove = (event: PointerEvent): void => { if (!drawingTools.has(this.state.tool)) return; const point = this.world(event, event.altKey); if (this.drag && event.pointerId === this.drag.pointerId) { this.drag.current = this.drag.tool === 'draw-wall' ? this.constrain(this.drag.start, point, event.shiftKey) : point; this.render(); event.preventDefault(); } else if (this.points.length) { this.hover = this.constrain(this.points.at(-1)!, point); this.render(); } };
  private readonly pointerUp = (event: PointerEvent): void => { const drag = this.drag; if (!drag || event.pointerId !== drag.pointerId) return; event.preventDefault(); event.stopImmediatePropagation(); this.drag = null; if (this.viewport.hasPointerCapture(event.pointerId)) this.viewport.releasePointerCapture(event.pointerId); const dx = drag.current.x - drag.start.x; const dy = drag.current.y - drag.start.y; if (drag.tool === 'draw-wall') { if (Math.hypot(dx, dy) < 100) { this.onStatus('Wall must be at least 100 project units long'); this.previewLayer.replaceChildren(); return; } const created = this.commands.createWall(drag.start, drag.current); this.onStatus(created ? `Wall created: ${created.id}` : 'Wall could not be created'); }
    else { const width = Math.abs(dx); const depth = Math.abs(dy); if (width < 100 || depth < 100) { this.onStatus('Draw at least 100 × 100 project units'); this.previewLayer.replaceChildren(); return; } if (drag.tool === 'draw-area') { const created = this.commands.createArea((drag.start.x + drag.current.x) / 2, (drag.start.y + drag.current.y) / 2, width, depth); this.onStatus(created ? `Area created: ${created.id}` : 'Area could not be created'); } else { const corners = this.rectangle(drag.start, drag.current); const existing = this.structure.getActiveBoundary(); const replace = Boolean(existing && window.confirm('Replace the existing Factory Layout boundary?')); if (existing && !replace) { this.onStatus('Boundary creation cancelled'); this.previewLayer.replaceChildren(); return; } const created = this.commands.createBoundary(corners, replace); this.onStatus(created ? `${replace ? 'Boundary replaced' : 'Boundary created'}: ${created.id}` : 'Boundary creation cancelled or invalid'); } }
    this.previewLayer.replaceChildren();
  };
  private readonly pointerCancel = (event: PointerEvent): void => { if (this.drag?.pointerId === event.pointerId) this.cancel(); };
  private readonly keyDown = (event: KeyboardEvent): void => { if (!drawingTools.has(this.state.tool) || this.editable(event.target)) return; if (['Escape', 'Backspace', 'Enter'].includes(event.key)) event.stopImmediatePropagation(); if (event.key === 'Escape') { event.preventDefault(); this.cancel(); this.selectTool(); } else if (event.key === 'Backspace' && this.points.length) { event.preventDefault(); this.points.pop(); this.hover = this.points.at(-1) ?? null; this.render(); } else if (event.key === 'Enter' && this.points.length) { event.preventDefault(); this.finishPolyline(); } };

  private finishPolyline(): void { if (this.state.tool === 'draw-boundary-orthogonal') { if (this.points.length < 4) { this.onStatus('Boundary needs at least four valid vertices'); return; } const existing = this.structure.getActiveBoundary(); const replace = Boolean(existing && window.confirm('Replace the existing Factory Layout boundary?')); if (existing && !replace) return; const created = this.commands.createBoundary(this.points, replace); this.onStatus(created ? `Boundary ${replace ? 'replaced' : 'created'}: ${created.id}` : 'Boundary geometry is invalid'); } else { if (this.points.length < 2) { this.onStatus('Aisle needs at least two points'); return; } const created = this.commands.createAisle(this.points); this.onStatus(created ? `Aisle created: ${created.id}` : 'Aisle geometry is invalid'); } this.points = []; this.hover = null; this.previewLayer.replaceChildren(); }
  private world(event: PointerEvent, bypass: boolean): GeometryPoint { const bounds = this.viewport.getBoundingClientRect(); return this.snap.snapPoint(screenToWorld({ x: event.clientX - bounds.left, y: event.clientY - bounds.top }, this.state), bypass); }
  private constrain(start: GeometryPoint, point: GeometryPoint, lock = false): GeometryPoint { const horizontal = Math.abs(point.x - start.x) >= Math.abs(point.y - start.y); return horizontal || lock && Math.abs(point.x - start.x) > 0 ? { x: point.x, y: start.y } : { x: start.x, y: point.y }; }
  private rectangle(start: GeometryPoint, end: GeometryPoint): GeometryPoint[] { return [{ x: start.x, y: start.y }, { x: end.x, y: start.y }, { x: end.x, y: end.y }, { x: start.x, y: end.y }]; }
  private render(): void { this.previewLayer.replaceChildren(); if (this.drag) { const shape = this.drag.tool === 'draw-wall' ? svg('line') : svg('rect'); shape.classList.add('factory-drawing-preview'); if (shape instanceof SVGLineElement) { shape.setAttribute('x1', String(this.drag.start.x)); shape.setAttribute('y1', String(this.drag.start.y)); shape.setAttribute('x2', String(this.drag.current.x)); shape.setAttribute('y2', String(this.drag.current.y)); shape.setAttribute('stroke-width', '100'); } else { shape.setAttribute('x', String(Math.min(this.drag.start.x, this.drag.current.x))); shape.setAttribute('y', String(Math.min(this.drag.start.y, this.drag.current.y))); shape.setAttribute('width', String(Math.abs(this.drag.current.x - this.drag.start.x))); shape.setAttribute('height', String(Math.abs(this.drag.current.y - this.drag.start.y))); } this.previewLayer.append(shape); return; } if (this.points.length) { const preview = svg(this.state.tool === 'draw-boundary-orthogonal' ? 'polygon' : 'polyline'); const values = [...this.points, ...(this.hover ? [this.hover] : [])]; preview.setAttribute('points', values.map((point) => `${point.x},${point.y}`).join(' ')); preview.classList.add('factory-drawing-preview'); this.previewLayer.append(preview); for (const point of this.points) { const handle = svg('circle'); handle.setAttribute('cx', String(point.x)); handle.setAttribute('cy', String(point.y)); handle.setAttribute('r', String(6 / this.state.zoom)); handle.classList.add('factory-drawing-point'); this.previewLayer.append(handle); } } }
  private prompt(): string { return this.state.tool === 'draw-boundary-rect' ? 'Boundary: drag between opposite corners' : this.state.tool === 'draw-boundary-orthogonal' ? (this.points.length ? 'Boundary: click next orthogonal point; Enter to finish' : 'Boundary: select first corner') : this.state.tool === 'draw-wall' ? 'Wall: drag from start to end' : this.state.tool === 'draw-area' ? 'Area: drag a rectangle' : (this.points.length ? 'Aisle: click next route point; Enter to finish' : 'Aisle: select start point'); }
  private editable(target: EventTarget | null): boolean { return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target instanceof HTMLElement && target.isContentEditable; }
}
