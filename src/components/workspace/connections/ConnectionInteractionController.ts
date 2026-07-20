import type { CanvasState, CanvasTool } from '../../../models/canvas/CanvasState';
import type { OperationAnchor, WorldPoint } from '../../../models/connections/ProcessConnection';
import type { ConnectionStore, ConnectionMutationResult, ConnectionRoute } from '../../../services/ConnectionStore';
import { anchorWorldPosition, nearestOperationAnchor, operationBounds } from '../../../services/ConnectionAnchors';
import type { OperationStore } from '../../../services/OperationStore';
import { screenToWorld } from '../canvas/ViewportTransform';
import { createConnectionContextMenu, type ConnectionContextMenuController } from './ConnectionContextMenu';
import type { CommandFactory } from '../../../services/history/CommandFactory';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
function svg<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] { return document.createElementNS(SVG_NAMESPACE, tag); }
function typing(target: EventTarget | null): boolean { return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable); }

export interface ConnectionInteractionCallbacks {
  readonly setTool: (tool: CanvasTool) => void; readonly onStatus: (message: string) => void;
  readonly routePreview: (sourceId: string, targetId: string, sourceAnchor: OperationAnchor, targetAnchor: OperationAnchor) => ConnectionRoute;
}

export class ConnectionInteractionController {
  private readonly portGroup = svg('g'); private readonly portHit = svg('circle'); private readonly portVisible = svg('circle'); private readonly preview = svg('path');
  private source: { operationId: string; anchor: OperationAnchor; explicit: boolean } | null = null; private hovered: { operationId: string; anchor: OperationAnchor; explicit: boolean } | null = null; private activePointer: number | null = null; private frame = 0; private pendingPoint: WorldPoint | null = null; private readonly menu: ConnectionContextMenuController; private longPressTimer = 0;
  public constructor(private readonly viewport: HTMLElement, private readonly application: HTMLElement, private readonly state: CanvasState, private readonly operations: OperationStore, private readonly connections: ConnectionStore, private readonly commands: CommandFactory, overlay: SVGGElement, private readonly callbacks: ConnectionInteractionCallbacks) {
    this.portGroup.classList.add('dynamic-operation-port'); this.portHit.classList.add('dynamic-operation-port__hit'); this.portVisible.classList.add('dynamic-operation-port__visible'); this.portGroup.append(this.portHit, this.portVisible); this.portGroup.setAttribute('display', 'none');
    this.preview.classList.add('connection-preview'); this.preview.setAttribute('display', 'none'); this.preview.setAttribute('marker-end', 'url(#process-arrowhead)'); overlay.append(this.preview, this.portGroup);
    this.menu = createConnectionContextMenu(viewport);
    viewport.addEventListener('pointermove', this.pointerMove); viewport.addEventListener('pointerdown', this.pointerDown); viewport.addEventListener('pointerup', this.pointerUp); viewport.addEventListener('pointercancel', this.pointerCancel); viewport.addEventListener('contextmenu', this.contextMenu); document.addEventListener('keydown', this.keyDown);
  }
  public toolChanged(): void {
    this.cancel(false); this.viewport.classList.toggle('canvas-viewport--connect-tool', this.state.tool === 'connect'); this.viewport.classList.toggle('canvas-viewport--delete-link-tool', this.state.tool === 'delete-link');
    if (this.state.tool === 'connect') { const selected = this.operations.getSelectedOperation(); if (selected?.visible) this.showPort(selected.id, { side: 'right', offset: 0.5 }); this.callbacks.onStatus('Connect: select source'); } else this.hidePort();
  }
  public viewportChanged(): void {
    if (this.state.tool !== 'connect') return;
    if (this.hovered) this.showPort(this.hovered.operationId, this.hovered.anchor);
    else if (this.source) this.showPort(this.source.operationId, this.source.anchor);
    else { const selected = this.operations.getSelectedOperation(); if (selected?.visible) this.showPort(selected.id, { side: 'right', offset: 0.5 }); }
  }
  public deleteSelection(): void { const selected = this.connections.getSelectedConnection(); const result = selected ? this.commands.deleteConnection(selected.id) : 'none'; this.statusForDelete(result); }
  public reverseSelection(): void { const connection = this.connections.getSelectedConnection(); if (!connection) { this.callbacks.onStatus('No connection selected'); return; } const result = this.commands.reverseConnection(connection.id); this.callbacks.onStatus(result === 'updated' ? 'Connection reversed' : result === 'duplicate' ? 'Cannot reverse: reverse Standard connection already exists' : result === 'locked' ? 'Connection is locked' : 'Connection not found'); }
  public cancelCreation(): void { this.cancel(true); }
  public dispose(): void { this.cancel(false); this.menu.dispose(); this.viewport.removeEventListener('pointermove', this.pointerMove); this.viewport.removeEventListener('pointerdown', this.pointerDown); this.viewport.removeEventListener('pointerup', this.pointerUp); this.viewport.removeEventListener('pointercancel', this.pointerCancel); this.viewport.removeEventListener('contextmenu', this.contextMenu); document.removeEventListener('keydown', this.keyDown); this.preview.remove(); this.portGroup.remove(); }

  private readonly pointerDown = (event: PointerEvent): void => {
    const connectionId = this.connectionId(event.target); if (connectionId && event.button === 0) {
      if (this.state.tool === 'delete-link') { event.preventDefault(); event.stopImmediatePropagation(); this.statusForDelete(this.commands.deleteConnection(connectionId)); return; }
      if (this.state.tool === 'select') { event.preventDefault(); event.stopImmediatePropagation(); this.connections.selectConnection(connectionId); this.callbacks.onStatus(`Connection selected: ${connectionId}`); if (event.pointerType === 'touch') this.scheduleLongPress(event, connectionId); return; }
    }
    if (this.state.tool !== 'connect' || event.button !== 0) return;
    const target = this.operationNear(event); if (!target) { this.callbacks.onStatus(this.source ? 'Connect: select target operation' : 'Connect: select source operation'); return; }
    event.preventDefault(); event.stopImmediatePropagation(); this.viewport.focus({ preventScroll: true });
    const pointer = this.world(event); const anchor = nearestOperationAnchor(target.operation, pointer); const explicit = this.isNearPerimeter(target.operation, pointer);
    if (this.source) {
      if (this.source.operationId === target.operation.id) { this.callbacks.onStatus('Self-connection not permitted'); return; }
      this.create(target.operation.id, anchor, explicit); return;
    }
    this.source = { operationId: target.operation.id, anchor, explicit }; this.activePointer = event.pointerId; this.viewport.setPointerCapture(event.pointerId); this.showPort(target.operation.id, anchor); this.callbacks.onStatus(`Connecting OP ${target.operation.sequence} → …`);
  };
  private readonly pointerMove = (event: PointerEvent): void => {
    if (this.state.tool !== 'connect') return; const target = this.operationNear(event); const pointer = this.world(event); this.hovered = target ? { operationId: target.operation.id, anchor: nearestOperationAnchor(target.operation, pointer), explicit: this.isNearPerimeter(target.operation, pointer) } : null;
    if (this.hovered) { const resolved = this.source && this.hovered.operationId !== this.source.operationId ? this.resolveAnchors(this.hovered.operationId, this.hovered.anchor, this.hovered.explicit) : null; this.showPort(this.hovered.operationId, resolved?.targetAnchor ?? this.hovered.anchor); } else if (!this.source) this.hidePort();
    if (!this.source) return; this.pendingPoint = this.world(event); if (!this.frame) this.frame = requestAnimationFrame(this.flushPreview);
    if (target && target.operation.id !== this.source.operationId) this.callbacks.onStatus(`Target OP ${target.operation.sequence}`);
  };
  private readonly pointerUp = (event: PointerEvent): void => {
    this.clearLongPress(); if (this.state.tool !== 'connect' || this.activePointer !== event.pointerId) return; event.preventDefault(); event.stopImmediatePropagation();
    const target = this.operationNear(event); const pointer = this.world(event); if (target && this.source && target.operation.id !== this.source.operationId) this.create(target.operation.id, nearestOperationAnchor(target.operation, pointer), this.isNearPerimeter(target.operation, pointer));
    else { this.activePointer = null; if (this.viewport.hasPointerCapture(event.pointerId)) this.viewport.releasePointerCapture(event.pointerId); this.callbacks.onStatus(this.source ? 'Connect: select target operation' : 'Connection cancelled'); }
  };
  private readonly pointerCancel = (event: PointerEvent): void => { this.clearLongPress(); if (this.activePointer === event.pointerId) this.cancel(true); };
  private readonly contextMenu = (event: MouseEvent): void => {
    const id = this.connectionId(event.target); if (this.state.tool === 'connect' && this.source) { event.preventDefault(); this.cancel(true); return; } if (!id) return;
    event.preventDefault(); this.openMenu(event.clientX, event.clientY, id);
  };
  private readonly keyDown = (event: KeyboardEvent): void => {
    if (typing(event.target) || !this.application.contains(document.activeElement)) return; const key = event.key.toLowerCase();
    if (key === 'c') { event.preventDefault(); this.callbacks.setTool('connect'); }
    else if (key === 'v') { event.preventDefault(); this.callbacks.setTool('select'); }
    else if (event.key === 'Escape') { if (this.state.tool === 'connect' || this.state.tool === 'delete-link') { event.preventDefault(); this.callbacks.setTool('select'); } else this.menu.close(); }
    else if (key === 'r' && this.connections.getSelectedConnection()) { event.preventDefault(); this.reverseSelection(); }
  };
  private readonly flushPreview = (): void => {
    this.frame = 0; if (!this.source || !this.pendingPoint) return; const sourceOperation = this.operations.getOperation(this.source.operationId); if (!sourceOperation) return; let points: readonly WorldPoint[];
    if (this.hovered && this.hovered.operationId !== this.source.operationId) { const resolved = this.resolveAnchors(this.hovered.operationId, this.hovered.anchor, this.hovered.explicit); points = this.callbacks.routePreview(this.source.operationId, this.hovered.operationId, resolved.sourceAnchor, resolved.targetAnchor).points; }
    else { const sourcePoint = anchorWorldPosition(sourceOperation, this.source.anchor); points = [sourcePoint, { x: this.pendingPoint.x, y: sourcePoint.y }, this.pendingPoint]; }
    this.preview.setAttribute('d', points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')); this.preview.setAttribute('display', 'inline');
  };
  private create(targetId: string, targetAnchor: OperationAnchor, targetExplicit: boolean): void {
    if (!this.source) return; const resolved = this.resolveAnchors(targetId, targetAnchor, targetExplicit); const result = this.commands.createConnection(this.source.operationId, targetId, resolved.sourceAnchor, resolved.targetAnchor); const id = result.connection?.id;
    this.callbacks.onStatus(result.result === 'created' && id ? `Connection created: ${id}` : result.result === 'duplicate' ? 'Duplicate connection not permitted' : result.result === 'self' ? 'Self-connection not permitted' : 'Connection could not be created'); this.cancel(false); if (result.result === 'created') this.callbacks.setTool('select');
  }
  private cancel(report: boolean): void { if (this.frame) cancelAnimationFrame(this.frame); this.frame = 0; this.preview.setAttribute('display', 'none'); this.pendingPoint = null; this.hovered = null; this.source = null; if (this.activePointer !== null && this.viewport.hasPointerCapture(this.activePointer)) this.viewport.releasePointerCapture(this.activePointer); this.activePointer = null; this.clearLongPress(); if (report) this.callbacks.onStatus('Connection cancelled'); }
  private showPort(operationId: string, anchor: OperationAnchor): void { const operation = this.operations.getOperation(operationId); if (!operation?.visible) { this.hidePort(); return; } const point = anchorWorldPosition(operation, anchor); const radius = 5 / this.state.zoom; this.portGroup.dataset.operationId = operationId; this.portGroup.setAttribute('transform', `translate(${point.x} ${point.y})`); this.portVisible.setAttribute('r', String(radius)); this.portHit.setAttribute('r', String(13 / this.state.zoom)); this.portGroup.setAttribute('display', 'inline'); this.portGroup.setAttribute('aria-label', `${anchor.side} connection port for OP ${operation.sequence}`); }
  private hidePort(): void { this.portGroup.setAttribute('display', 'none'); delete this.portGroup.dataset.operationId; }
  private operationNear(event: PointerEvent): { operation: NonNullable<ReturnType<OperationStore['getOperation']>> } | null {
    const directId = event.target instanceof Element ? event.target.closest<SVGElement>('[data-operation-id]')?.dataset.operationId : undefined; const direct = directId ? this.operations.getOperation(directId) : undefined; if (direct?.visible) return { operation: direct };
    const point = this.world(event); const margin = 18 / this.state.zoom; const nearby = this.operations.getOperations().filter((operation) => operation.visible).find((operation) => { const bounds = operationBounds(operation); return point.x >= bounds.left - margin && point.x <= bounds.right + margin && point.y >= bounds.top - margin && point.y <= bounds.bottom + margin; }); return nearby ? { operation: nearby } : null;
  }
  private resolveAnchors(targetId: string, targetAnchor: OperationAnchor, targetExplicit: boolean): { sourceAnchor: OperationAnchor; targetAnchor: OperationAnchor } {
    if (!this.source) return { sourceAnchor: targetAnchor, targetAnchor }; const sourceOperation = this.operations.getOperation(this.source.operationId); const targetOperation = this.operations.getOperation(targetId); if (!sourceOperation || !targetOperation) return { sourceAnchor: this.source.anchor, targetAnchor };
    const dx = targetOperation.worldX - sourceOperation.worldX; const dy = targetOperation.worldY - sourceOperation.worldY; const horizontal = Math.abs(dx) >= Math.abs(dy);
    const preferredSource: OperationAnchor = horizontal ? { side: dx >= 0 ? 'right' : 'left', offset: 0.5 } : { side: dy >= 0 ? 'bottom' : 'top', offset: 0.5 };
    const preferredTarget: OperationAnchor = horizontal ? { side: dx >= 0 ? 'left' : 'right', offset: 0.5 } : { side: dy >= 0 ? 'top' : 'bottom', offset: 0.5 };
    return { sourceAnchor: this.source.explicit ? this.source.anchor : preferredSource, targetAnchor: targetExplicit ? targetAnchor : preferredTarget };
  }
  private isNearPerimeter(operation: NonNullable<ReturnType<OperationStore['getOperation']>>, point: WorldPoint): boolean { const bounds = operationBounds(operation); return Math.min(Math.abs(point.x - bounds.left), Math.abs(point.x - bounds.right), Math.abs(point.y - bounds.top), Math.abs(point.y - bounds.bottom)) <= 18; }
  private world(event: PointerEvent): WorldPoint { const bounds = this.viewport.getBoundingClientRect(); return screenToWorld({ x: event.clientX - bounds.left, y: event.clientY - bounds.top }, this.state); }
  private connectionId(target: EventTarget | null): string | undefined { return target instanceof Element ? target.closest<SVGElement>('[data-connection-id]')?.dataset.connectionId : undefined; }
  private statusForDelete(result: ConnectionMutationResult): void { this.callbacks.onStatus(result === 'deleted' ? 'Connection deleted' : result === 'locked' ? 'Connection is locked' : 'No connection selected'); }
  private openMenu(clientX: number, clientY: number, id: string): void { const connection = this.connections.getConnection(id); if (!connection) return; this.connections.selectConnection(id); const bounds = this.viewport.getBoundingClientRect(); this.menu.open(clientX - bounds.left, clientY - bounds.top, id, { onDelete: () => this.statusForDelete(this.commands.deleteConnection(id)), onReverse: () => { const result = this.commands.reverseConnection(id); this.callbacks.onStatus(result === 'updated' ? 'Connection reversed' : result === 'duplicate' ? 'Cannot reverse: duplicate connection' : 'Connection is locked'); }, onSelectSource: () => this.operations.selectOperation(connection.sourceOperationId), onSelectTarget: () => this.operations.selectOperation(connection.targetOperationId) }); }
  private scheduleLongPress(event: PointerEvent, id: string): void { this.clearLongPress(); const x = event.clientX; const y = event.clientY; this.longPressTimer = window.setTimeout(() => this.openMenu(x, y, id), 600); }
  private clearLongPress(): void { if (this.longPressTimer) window.clearTimeout(this.longPressTimer); this.longPressTimer = 0; }
}
