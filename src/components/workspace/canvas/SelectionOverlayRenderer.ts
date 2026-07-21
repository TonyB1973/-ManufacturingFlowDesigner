import type { CanvasState, CanvasTool } from '../../../models/canvas/CanvasState';
import type { SelectionController } from '../../../models/selection/Selection';
import type { OperationStore } from '../../../services/OperationStore';
import type { ResourceStore } from '../../../services/ResourceStore';
import { aggregateBounds } from '../../../services/geometry/GeometryBounds';
import type { GeometrySelectionService } from '../../../services/geometry/GeometrySelectionService';
import type { ResizeHandle } from '../../../services/geometry/ResizeGeometry';

export type { ResizeHandle } from '../../../services/geometry/ResizeGeometry';
const SVG_NS = 'http://www.w3.org/2000/svg';
const svg = <K extends keyof SVGElementTagNameMap>(name: K): SVGElementTagNameMap[K] => document.createElementNS(SVG_NS, name);
const handles: readonly ResizeHandle[] = ['left', 'right', 'top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];

export class SelectionOverlayRenderer {
  private readonly group = svg('g'); private readonly boundsOuter = svg('rect'); private readonly boundsInner = svg('rect'); private readonly handleGroup = svg('g'); private tool: CanvasTool = 'select'; private readonly unsubscribe: readonly (() => void)[];
  public constructor(layer: SVGGElement, private readonly state: CanvasState, private readonly geometry: GeometrySelectionService, selection: SelectionController, operations: OperationStore, resources: ResourceStore) { this.group.classList.add('selection-overlay'); this.boundsOuter.classList.add('selection-bounds', 'selection-bounds--outer'); this.boundsInner.classList.add('selection-bounds', 'selection-bounds--inner'); this.handleGroup.classList.add('resize-handles'); this.group.append(this.boundsOuter, this.boundsInner, this.handleGroup); layer.append(this.group); this.unsubscribe = [selection.subscribe(() => this.render()), operations.subscribe(() => this.render()), resources.subscribe(() => this.render())]; this.render(); }
  public setTool(tool: CanvasTool): void { this.tool = tool; this.render(); }
  public viewportChanged(): void { this.render(); }
  public render(): void { const selection = this.geometry.getSelection(); const bounds = aggregateBounds(selection.nodes); const showBounds = Boolean(bounds && selection.nodes.length >= 2); for (const node of [this.boundsOuter, this.boundsInner]) { node.setAttribute('display', showBounds ? 'inline' : 'none'); if (showBounds && bounds) { node.setAttribute('x', String(bounds.left)); node.setAttribute('y', String(bounds.top)); node.setAttribute('width', String(bounds.width)); node.setAttribute('height', String(bounds.height)); } }
    this.handleGroup.replaceChildren(); const single = selection.nodes.length === 1 ? selection.nodes[0] : null; if (!single || single.locked || this.tool !== 'select') return; const half = 4 / this.state.zoom; const hitHalf = 9 / this.state.zoom; const positions: Record<ResizeHandle, { x: number; y: number }> = { left: { x: single.x - single.width / 2, y: single.y }, right: { x: single.x + single.width / 2, y: single.y }, top: { x: single.x, y: single.y - single.height / 2 }, bottom: { x: single.x, y: single.y + single.height / 2 }, 'top-left': { x: single.x - single.width / 2, y: single.y - single.height / 2 }, 'top-right': { x: single.x + single.width / 2, y: single.y - single.height / 2 }, 'bottom-left': { x: single.x - single.width / 2, y: single.y + single.height / 2 }, 'bottom-right': { x: single.x + single.width / 2, y: single.y + single.height / 2 } };
    for (const handle of handles) { const group = svg('g'); group.classList.add('resize-handle'); group.dataset.resizeHandle = handle; group.setAttribute('role', 'button'); group.setAttribute('aria-label', `Resize ${handle.replace('-', ' ')}`); const hit = svg('rect'); hit.classList.add('resize-handle__hit'); hit.setAttribute('x', String(positions[handle].x - hitHalf)); hit.setAttribute('y', String(positions[handle].y - hitHalf)); hit.setAttribute('width', String(hitHalf * 2)); hit.setAttribute('height', String(hitHalf * 2)); const visible = svg('rect'); visible.classList.add('resize-handle__visible'); visible.setAttribute('x', String(positions[handle].x - half)); visible.setAttribute('y', String(positions[handle].y - half)); visible.setAttribute('width', String(half * 2)); visible.setAttribute('height', String(half * 2)); group.append(hit, visible); this.handleGroup.append(group); }
  }
  public dispose(): void { this.unsubscribe.forEach((unsubscribe) => unsubscribe()); this.group.remove(); }
}
