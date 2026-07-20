import type { OperationInstance } from '../models/operations/OperationInstance';
import type { ConnectionType, OperationAnchor, ProcessConnection, ProcessConnectionPatch, RouteStatus, WorldPoint } from '../models/connections/ProcessConnection';
import type { SelectionController } from '../models/selection/Selection';
import type { ConnectionIdProvider } from '../utilities/ConnectionIdGenerator';

export type ConnectionStoreChange =
  | { readonly kind: 'created'; readonly connection: ProcessConnection }
  | { readonly kind: 'updated'; readonly connection: ProcessConnection }
  | { readonly kind: 'deleted'; readonly connectionId: string }
  | { readonly kind: 'selection'; readonly connectionId: string | null }
  | { readonly kind: 'validation' }
  | { readonly kind: 'reset' };
export type ConnectionStoreListener = (change: ConnectionStoreChange) => void;
export type ConnectionMutationResult = 'created' | 'updated' | 'deleted' | 'duplicate' | 'self' | 'locked' | 'missing' | 'none';
export interface ConnectionRoute { readonly points: readonly WorldPoint[]; readonly status: RouteStatus; }
export type ConnectionRouteProvider = (connection: ProcessConnection) => ConnectionRoute;

class LocalSelectionController implements SelectionController {
  private selection: ReturnType<SelectionController['getSelection']> = { kind: 'none' };
  private readonly listeners = new Set<Parameters<SelectionController['subscribe']>[0]>();
  public getSelection(): ReturnType<SelectionController['getSelection']> { return this.selection; }
  public select(selection: Parameters<SelectionController['select']>[0]): void { this.selection = selection; this.notify(); }
  public clear(): void { this.selection = { kind: 'none' }; this.notify(); }
  public subscribe(listener: Parameters<SelectionController['subscribe']>[0]): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private notify(): void { for (const listener of this.listeners) listener(this.selection); }
}

export class ConnectionStore {
  private readonly connections = new Map<string, ProcessConnection>(); private readonly listeners = new Set<ConnectionStoreListener>();
  private readonly selection: SelectionController; private readonly unsubscribeSelection: () => void;
  public constructor(private readonly idProvider: ConnectionIdProvider, private readonly getOperation: (id: string) => OperationInstance | undefined, private readonly routeProvider: ConnectionRouteProvider, selection?: SelectionController) {
    this.selection = selection ?? new LocalSelectionController(); this.unsubscribeSelection = this.selection.subscribe(() => this.syncSelection());
  }
  public getConnections(): readonly ProcessConnection[] { return [...this.connections.values()]; }
  public getConnection(id: string): ProcessConnection | undefined { return this.connections.get(id); }
  public getConnectionCount(): number { return this.connections.size; }
  public getConnectionsForOperation(operationId: string): readonly ProcessConnection[] { return [...this.connections.values()].filter((connection) => connection.sourceOperationId === operationId || connection.targetOperationId === operationId); }
  public getSelectedConnection(): ProcessConnection | null { const selected = this.selection.getSelection(); return selected.kind === 'connection' ? this.connections.get(selected.id) ?? null : null; }
  public createConnection(sourceOperationId: string, targetOperationId: string, sourceAnchor: OperationAnchor, targetAnchor: OperationAnchor, connectionType: ConnectionType = 'Standard'): { readonly result: ConnectionMutationResult; readonly connection?: ProcessConnection } {
    if (sourceOperationId === targetOperationId) return { result: 'self' };
    if (!this.getOperation(sourceOperationId) || !this.getOperation(targetOperationId)) return { result: 'missing' };
    if (this.isDuplicate(sourceOperationId, targetOperationId, connectionType)) return { result: 'duplicate' };
    const connection: ProcessConnection = { id: this.idProvider.next(), sourceOperationId, targetOperationId, sourceAnchor: { ...sourceAnchor }, targetAnchor: { ...targetAnchor }, routePoints: [], label: '', connectionType, selected: false, visible: true, locked: false, routeStatus: 'clear' };
    this.connections.set(connection.id, connection); this.recalculate(connection); this.notify({ kind: 'created', connection }); this.selection.select({ kind: 'connection', id: connection.id }); this.notify({ kind: 'validation' });
    return { result: 'created', connection };
  }
  public restoreConnection(connection: ProcessConnection): boolean {
    if (this.connections.has(connection.id) || !this.getOperation(connection.sourceOperationId) || !this.getOperation(connection.targetOperationId) || this.isDuplicate(connection.sourceOperationId, connection.targetOperationId, connection.connectionType)) return false;
    const restored: ProcessConnection = { ...connection, sourceAnchor: { ...connection.sourceAnchor }, targetAnchor: { ...connection.targetAnchor }, routePoints: [], routeStatus: 'clear', selected: false };
    this.connections.set(restored.id, restored); this.recalculate(restored); this.notify({ kind: 'created', connection: restored }); this.notify({ kind: 'validation' }); return true;
  }
  public selectConnection(id: string): boolean { if (!this.connections.has(id)) return false; this.selection.select({ kind: 'connection', id }); return true; }
  public updateConnection(id: string, patch: ProcessConnectionPatch): boolean {
    const connection = this.connections.get(id); if (!connection || !this.validPatch(patch)) return false;
    if (patch.connectionType === 'Standard' && connection.connectionType !== 'Standard' && this.isDuplicate(connection.sourceOperationId, connection.targetOperationId, 'Standard', id)) return false; Object.assign(connection, patch);
    if (patch.sourceAnchor || patch.targetAnchor) this.recalculate(connection); this.notify({ kind: 'updated', connection }); this.notify({ kind: 'validation' }); return true;
  }
  public deleteSelected(): ConnectionMutationResult { const selected = this.getSelectedConnection(); return selected ? this.deleteConnection(selected.id) : 'none'; }
  public deleteConnection(id: string): ConnectionMutationResult {
    const connection = this.connections.get(id); if (!connection) return 'none'; if (connection.locked) return 'locked'; this.connections.delete(id);
    const selected = this.selection.getSelection(); if (selected.kind === 'connection' && selected.id === id) this.selection.clear(); this.notify({ kind: 'deleted', connectionId: id }); this.notify({ kind: 'validation' }); return 'deleted';
  }
  public reverseConnection(id: string): ConnectionMutationResult {
    const connection = this.connections.get(id); if (!connection) return 'none'; if (connection.locked) return 'locked';
    if (this.isDuplicate(connection.targetOperationId, connection.sourceOperationId, connection.connectionType, id)) return 'duplicate';
    [connection.sourceOperationId, connection.targetOperationId] = [connection.targetOperationId, connection.sourceOperationId];
    [connection.sourceAnchor, connection.targetAnchor] = [connection.targetAnchor, connection.sourceAnchor]; this.recalculate(connection); this.notify({ kind: 'updated', connection }); this.notify({ kind: 'validation' }); return 'updated';
  }
  public deleteForOperation(operationId: string): void {
    const ids = [...this.connections.values()].filter((connection) => connection.sourceOperationId === operationId || connection.targetOperationId === operationId).map((connection) => connection.id);
    ids.forEach((id) => { this.connections.delete(id); this.notify({ kind: 'deleted', connectionId: id }); });
    const selected = this.selection.getSelection(); if (selected.kind === 'connection' && ids.includes(selected.id)) this.selection.clear(); if (ids.length) this.notify({ kind: 'validation' });
  }
  public recalculateAll(): void { for (const connection of this.connections.values()) { this.recalculate(connection); this.notify({ kind: 'updated', connection }); } this.notify({ kind: 'validation' }); }
  public sortedConnections(): readonly ProcessConnection[] {
    return [...this.connections.values()].sort((left, right) => (this.getOperation(left.sourceOperationId)?.sequence ?? Infinity) - (this.getOperation(right.sourceOperationId)?.sequence ?? Infinity)
      || (this.getOperation(left.targetOperationId)?.sequence ?? Infinity) - (this.getOperation(right.targetOperationId)?.sequence ?? Infinity) || left.id.localeCompare(right.id));
  }
  public subscribe(listener: ConnectionStoreListener): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  public replaceAll(connections: readonly ProcessConnection[], notify = true): void {
    this.connections.clear();
    connections.forEach((connection) => {
      const copy: ProcessConnection = { ...connection, sourceAnchor: { ...connection.sourceAnchor }, targetAnchor: { ...connection.targetAnchor }, routePoints: [], selected: false, routeStatus: 'clear' };
      this.connections.set(copy.id, copy);
      this.recalculate(copy);
    });
    if (notify) this.publishReset();
  }
  public publishReset(): void { this.notify({ kind: 'reset' }); }
  public dispose(): void { this.unsubscribeSelection(); }
  private recalculate(connection: ProcessConnection): void { const route = this.routeProvider(connection); connection.routePoints = [...route.points]; connection.routeStatus = route.status; }
  private isDuplicate(source: string, target: string, type: ConnectionType, ignoreId?: string): boolean { return type === 'Standard' && [...this.connections.values()].some((connection) => connection.id !== ignoreId && connection.connectionType === 'Standard' && connection.sourceOperationId === source && connection.targetOperationId === target); }
  private validPatch(patch: ProcessConnectionPatch): boolean { return patch.label === undefined || patch.label.length <= 120; }
  private syncSelection(): void { const selected = this.selection.getSelection(); for (const connection of this.connections.values()) connection.selected = selected.kind === 'connection' && selected.id === connection.id; this.notify({ kind: 'selection', connectionId: selected.kind === 'connection' ? selected.id : null }); }
  private notify(change: ConnectionStoreChange): void { for (const listener of this.listeners) listener(change); }
}
