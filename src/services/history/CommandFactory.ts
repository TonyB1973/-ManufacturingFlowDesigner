import type { ProcessConnection, ProcessConnectionPatch, OperationAnchor, ConnectionType } from '../../models/connections/ProcessConnection';
import type { OperationInstance, OperationInstancePatch } from '../../models/operations/OperationInstance';
import type { ProjectMetadata, ProjectSettings } from '../../models/project/ProjectDocument';
import type { PlacedResource, PlacedResourcePatch } from '../../models/resources/PlacedResource';
import type { CommandExecutionContext } from './ApplicationCommand';
import { ReversibleCommand } from './ApplicationCommand';
import type { CommandHistoryService } from './CommandHistoryService';
import type { ConnectionMutationResult } from '../ConnectionStore';
import type { DeleteResult } from '../ResourceStore';
import type { OperationDeleteResult } from '../OperationStore';
import type { SelectionItem } from '../../models/selection/Selection';

type MetadataPatch = Partial<Pick<ProjectMetadata, 'name' | 'description' | 'author' | 'company'>>;
export interface PositionChange { readonly id: string; readonly before: { readonly x: number; readonly y: number }; readonly after: { readonly x: number; readonly y: number }; }

const cloneResource = (resource: PlacedResource): PlacedResource => ({ ...resource, selected: false });
const cloneOperation = (operation: OperationInstance): OperationInstance => ({ ...operation, selected: false });
const cloneConnection = (connection: ProcessConnection): ProcessConnection => ({ ...connection, sourceAnchor: { ...connection.sourceAnchor }, targetAnchor: { ...connection.targetAnchor }, routePoints: connection.routePoints.map((point) => ({ ...point })), selected: false });
const same = (left: unknown, right: unknown): boolean => Object.is(left, right);
const changedPatch = <T extends object>(source: T, patch: Partial<T>): Partial<T> => Object.fromEntries(Object.entries(patch).filter(([key, value]) => !same(source[key as keyof T], value))) as Partial<T>;
const beforePatch = <T extends object>(source: T, patch: Partial<T>): Partial<T> => Object.fromEntries(Object.keys(patch).map((key) => [key, source[key as keyof T]])) as Partial<T>;

export class CommandFactory {
  public constructor(private readonly history: CommandHistoryService, private readonly context: CommandExecutionContext) {}

  public addResource(templateId: string, worldX: number, worldY: number): PlacedResource | null {
    let snapshot: PlacedResource | null = null;
    const command = new ReversibleCommand(() => `Add resource ${snapshot?.id ?? templateId}`, () => snapshot ? [snapshot.id] : [], 'factoryLayout',
      ({ resources }) => { if (!snapshot) { const created = resources.addResource(templateId, worldX, worldY); if (!created) throw new Error('Resource could not be added.'); snapshot = cloneResource(created); } else { if (!resources.restoreResource(snapshot)) throw new Error('Resource could not be restored.'); resources.selectResource(snapshot.id); } },
      ({ resources }) => { if (!snapshot || resources.deleteResource(snapshot.id) !== 'deleted') throw new Error('Resource addition could not be undone.'); });
    return this.run(command) ? snapshot : null;
  }

  public duplicateResource(resourceId: string, offset = 20): PlacedResource | null {
    let snapshot: PlacedResource | null = null;
    const command = new ReversibleCommand(() => `Duplicate resource ${snapshot?.id ?? resourceId}`, () => snapshot ? [resourceId, snapshot.id] : [resourceId], 'factoryLayout',
      ({ resources }) => { if (!snapshot) { const created = resources.duplicateResource(resourceId, offset); if (!created) throw new Error('Resource could not be duplicated.'); snapshot = cloneResource(created); } else { if (!resources.restoreResource(snapshot)) throw new Error('Duplicated resource could not be restored.'); resources.selectResource(snapshot.id); } },
      ({ resources }) => { if (!snapshot || resources.deleteResource(snapshot.id) !== 'deleted') throw new Error('Resource duplication could not be undone.'); });
    return this.run(command) ? snapshot : null;
  }

  public toggleResourceTemplateFavourite(templateId: string): boolean | null {
    const template = this.context.resources.getTemplate(templateId); if (!template) return null; const adding = !template.isFavourite;
    const command = new ReversibleCommand(`${adding ? 'Favourite' : 'Unfavourite'} resource template ${templateId}`, [templateId], undefined,
      ({ resources }) => { if (resources.toggleFavourite(templateId) === null) throw new Error('Resource template favourite could not be changed.'); },
      ({ resources }) => { if (resources.toggleFavourite(templateId) === null) throw new Error('Resource template favourite could not be restored.'); });
    return this.run(command) ? adding : null;
  }

  public deleteResource(resourceId: string): DeleteResult {
    const resource = this.context.resources.getResource(resourceId); if (!resource) return 'none'; if (resource.locked) return 'locked';
    const snapshot = cloneResource(resource); const assignments = this.context.operations.getOperations().filter((operation) => operation.assignedResourceId === resourceId).map((operation) => operation.id);
    const command = new ReversibleCommand(`Delete resource ${resourceId}`, [resourceId, ...assignments], 'factoryLayout',
      ({ resources, operations }) => { if (resources.deleteResource(resourceId) !== 'deleted') throw new Error('Resource could not be deleted.'); operations.unassignResource(resourceId); },
      ({ resources, operations }) => { if (!resources.restoreResource(snapshot)) throw new Error('Resource could not be restored.'); for (const operationId of assignments) if (!operations.updateOperation(operationId, { assignedResourceId: resourceId })) throw new Error(`Assignment for ${operationId} could not be restored.`); resources.selectResource(resourceId); });
    return this.run(command) ? 'deleted' : 'none';
  }

  public updateResource(resourceId: string, patch: PlacedResourcePatch, description?: string): boolean {
    const resource = this.context.resources.getResource(resourceId); if (!resource) return false; const after = changedPatch(resource, patch) as PlacedResourcePatch; if (!Object.keys(after).length) return false; const before = beforePatch(resource, after) as PlacedResourcePatch;
    return this.run(new ReversibleCommand(description ?? this.resourceDescription(resourceId, after), [resourceId], 'factoryLayout',
      ({ resources }) => { if (!resources.updateResource(resourceId, after)) throw new Error('Resource update was rejected.'); },
      ({ resources }) => { if (!resources.updateResource(resourceId, before)) throw new Error('Resource update could not be undone.'); }));
  }

  public commitResourceMove(resourceId: string, before: { readonly x: number; readonly y: number }, after: { readonly x: number; readonly y: number }): boolean {
    if (same(before.x, after.x) && same(before.y, after.y)) return false;
    return this.run(new ReversibleCommand(`Move resource ${resourceId}`, [resourceId], 'factoryLayout',
      ({ resources }) => { if (!resources.moveResource(resourceId, after.x, after.y)) throw new Error('Resource move was rejected.'); },
      ({ resources }) => { if (!resources.moveResource(resourceId, before.x, before.y)) throw new Error('Resource move could not be undone.'); }));
  }

  public commitResourceGroupMove(changes: readonly PositionChange[]): boolean {
    const moved = changes.filter((item) => item.before.x !== item.after.x || item.before.y !== item.after.y); if (!moved.length) return false;
    const apply = (where: 'before' | 'after', resources: CommandExecutionContext['resources']): void => { for (const item of moved) { const point = item[where]; if (!resources.moveResource(item.id, point.x, point.y)) throw new Error(`Resource ${item.id} could not be moved.`); } };
    return this.run(new ReversibleCommand(`Move ${moved.length} resources`, moved.map((item) => item.id), 'factoryLayout', ({ resources }) => apply('after', resources), ({ resources }) => apply('before', resources)));
  }

  public addOperation(templateId: string, worldX: number, worldY: number): OperationInstance | null {
    let snapshot: OperationInstance | null = null;
    const command = new ReversibleCommand(() => `Add operation ${snapshot ? `OP-${String(snapshot.sequence).padStart(4, '0')}` : templateId}`, () => snapshot ? [snapshot.id] : [], 'processFlow',
      ({ operations }) => { if (!snapshot) { const created = operations.addOperation(templateId, worldX, worldY); if (!created) throw new Error('Operation could not be added.'); snapshot = cloneOperation(created); } else { if (!operations.restoreOperation(snapshot)) throw new Error('Operation could not be restored.'); operations.selectOperation(snapshot.id); } },
      ({ operations, connections }) => { if (!snapshot || operations.deleteOperation(snapshot.id) !== 'deleted') throw new Error('Operation addition could not be undone.'); connections.deleteForOperation(snapshot.id); });
    return this.run(command) ? snapshot : null;
  }

  public deleteOperation(operationId: string): OperationDeleteResult {
    const operation = this.context.operations.getOperation(operationId); if (!operation) return 'none'; if (operation.locked) return 'locked';
    const snapshot = cloneOperation(operation); const attached = this.context.connections.getConnectionsForOperation(operationId).map(cloneConnection);
    const command = new ReversibleCommand(`Delete operation OP-${String(operation.sequence).padStart(4, '0')}`, [operationId, ...attached.map((item) => item.id)], 'processFlow',
      ({ operations, connections }) => { if (operations.deleteOperation(operationId) !== 'deleted') throw new Error('Operation could not be deleted.'); connections.deleteForOperation(operationId); },
      ({ operations, connections }) => { if (!operations.restoreOperation(snapshot)) throw new Error('Operation could not be restored.'); for (const connection of attached) if (!connections.restoreConnection(connection)) throw new Error(`Connection ${connection.id} could not be restored.`); operations.selectOperation(operationId); connections.recalculateAll(); });
    return this.run(command) ? 'deleted' : 'none';
  }

  public updateOperation(operationId: string, patch: OperationInstancePatch, description?: string): boolean {
    const operation = this.context.operations.getOperation(operationId); if (!operation) return false; const after = changedPatch(operation, patch) as OperationInstancePatch; if (!Object.keys(after).length) return false; const before = beforePatch(operation, after) as OperationInstancePatch;
    return this.run(new ReversibleCommand(description ?? this.operationDescription(operation, after), [operationId], 'processFlow',
      ({ operations }) => { if (!operations.updateOperation(operationId, after)) throw new Error('Operation update was rejected.'); },
      ({ operations }) => { if (!operations.updateOperation(operationId, before)) throw new Error('Operation update could not be undone.'); }));
  }

  public commitOperationMove(operationId: string, before: { readonly x: number; readonly y: number }, after: { readonly x: number; readonly y: number }): boolean {
    if (same(before.x, after.x) && same(before.y, after.y)) return false;
    const operation = this.context.operations.getOperation(operationId); const label = operation ? `OP-${String(operation.sequence).padStart(4, '0')}` : operationId;
    return this.run(new ReversibleCommand(`Move operation ${label}`, [operationId], 'processFlow',
      ({ operations }) => { if (!operations.moveOperation(operationId, after.x, after.y)) throw new Error('Operation move was rejected.'); },
      ({ operations }) => { if (!operations.moveOperation(operationId, before.x, before.y)) throw new Error('Operation move could not be undone.'); }));
  }

  public commitOperationGroupMove(changes: readonly PositionChange[]): boolean {
    const moved = changes.filter((item) => item.before.x !== item.after.x || item.before.y !== item.after.y); if (!moved.length) return false;
    const apply = (where: 'before' | 'after', operations: CommandExecutionContext['operations']): void => { for (const item of moved) { const point = item[where]; if (!operations.moveOperation(item.id, point.x, point.y)) throw new Error(`Operation ${item.id} could not be moved.`); } };
    return this.run(new ReversibleCommand(`Move ${moved.length} operations`, moved.map((item) => item.id), 'processFlow', ({ operations }) => apply('after', operations), ({ operations }) => apply('before', operations)));
  }

  public insertResources(snapshots: readonly PlacedResource[], description = 'Paste resources'): boolean {
    if (!snapshots.length) return false; const copies = snapshots.map(cloneResource); const refs: SelectionItem[] = copies.map((item) => ({ kind: 'resource', id: item.id }));
    return this.run(new ReversibleCommand(description, copies.map((item) => item.id), 'factoryLayout',
      ({ resources, selection }) => { for (const item of copies) if (!resources.restoreResource(item)) throw new Error(`Resource ${item.id} could not be inserted.`); selection.set(refs, refs.at(-1)); },
      ({ resources, selection }) => { for (const item of [...copies].reverse()) if (resources.deleteResource(item.id) !== 'deleted') throw new Error(`Resource ${item.id} could not be removed.`); selection.clear(); }));
  }

  public insertProcess(snapshots: { readonly operations: readonly OperationInstance[]; readonly connections: readonly ProcessConnection[] }, description = 'Paste process selection'): boolean {
    if (!snapshots.operations.length && !snapshots.connections.length) return false; const operations = snapshots.operations.map(cloneOperation); const connections = snapshots.connections.map(cloneConnection); const refs: SelectionItem[] = [...operations.map((item) => ({ kind: 'operation' as const, id: item.id })), ...connections.map((item) => ({ kind: 'connection' as const, id: item.id }))];
    return this.run(new ReversibleCommand(description, refs.map((item) => item.id), 'processFlow',
      (context) => { for (const item of operations) if (!context.operations.restoreOperation(item)) throw new Error(`Operation ${item.id} could not be inserted.`); for (const item of connections) if (!context.connections.restoreConnection(item)) throw new Error(`Connection ${item.id} could not be inserted.`); context.selection.set(refs, refs.at(-1)); context.connections.recalculateAll(); },
      (context) => { for (const item of [...connections].reverse()) if (context.connections.deleteConnection(item.id) !== 'deleted') throw new Error(`Connection ${item.id} could not be removed.`); for (const item of [...operations].reverse()) if (context.operations.deleteOperation(item.id) !== 'deleted') throw new Error(`Operation ${item.id} could not be removed.`); context.selection.clear(); }));
  }

  public deleteResources(resourceIds: readonly string[], description = 'Delete resources'): DeleteResult {
    const snapshots = resourceIds.map((id) => this.context.resources.getResource(id)).filter((item): item is PlacedResource => Boolean(item && !item.locked)).map(cloneResource); if (!snapshots.length) return 'locked';
    const assignments = this.context.operations.getOperations().filter((operation) => snapshots.some((resource) => resource.id === operation.assignedResourceId)).map((operation) => ({ id: operation.id, resourceId: operation.assignedResourceId! }));
    const command = new ReversibleCommand(description, [...snapshots.map((item) => item.id), ...assignments.map((item) => item.id)], 'factoryLayout',
      ({ resources, operations }) => { for (const item of snapshots) { if (resources.deleteResource(item.id) !== 'deleted') throw new Error(`Resource ${item.id} could not be deleted.`); operations.unassignResource(item.id); } },
      ({ resources, operations, selection }) => { for (const item of snapshots) if (!resources.restoreResource(item)) throw new Error(`Resource ${item.id} could not be restored.`); for (const item of assignments) if (!operations.updateOperation(item.id, { assignedResourceId: item.resourceId })) throw new Error(`Assignment ${item.id} could not be restored.`); const refs: SelectionItem[] = snapshots.map((item) => ({ kind: 'resource', id: item.id })); selection.set(refs, refs.at(-1)); });
    return this.run(command) ? 'deleted' : 'none';
  }

  public deleteProcess(operationIds: readonly string[], connectionIds: readonly string[], description = 'Delete process selection'): OperationDeleteResult {
    const operations = operationIds.map((id) => this.context.operations.getOperation(id)).filter((item): item is OperationInstance => Boolean(item && !item.locked)).map(cloneOperation);
    const operationSet = new Set(operations.map((item) => item.id)); const requested = new Set(connectionIds); const connections = this.context.connections.getConnections().filter((item) => operationSet.has(item.sourceOperationId) || operationSet.has(item.targetOperationId) || (!item.locked && requested.has(item.id))).map(cloneConnection);
    if (!operations.length && !connections.length) return 'locked';
    const command = new ReversibleCommand(description, [...operations.map((item) => item.id), ...connections.map((item) => item.id)], 'processFlow',
      (context) => { for (const item of connections.filter((connection) => !operationSet.has(connection.sourceOperationId) && !operationSet.has(connection.targetOperationId))) if (context.connections.getConnection(item.id) && context.connections.deleteConnection(item.id) !== 'deleted') throw new Error(`Connection ${item.id} could not be deleted.`); for (const item of operations) { if (context.operations.deleteOperation(item.id) !== 'deleted') throw new Error(`Operation ${item.id} could not be deleted.`); context.connections.deleteForOperation(item.id); } context.selection.clear(); },
      (context) => { for (const item of operations) if (!context.operations.restoreOperation(item)) throw new Error(`Operation ${item.id} could not be restored.`); for (const item of connections) if (!context.connections.restoreConnection(item)) throw new Error(`Connection ${item.id} could not be restored.`); const refs: SelectionItem[] = [...operations.map((item) => ({ kind: 'operation' as const, id: item.id })), ...connections.map((item) => ({ kind: 'connection' as const, id: item.id }))]; context.selection.set(refs, refs.at(-1)); context.connections.recalculateAll(); });
    return this.run(command) ? 'deleted' : 'none';
  }

  public normalizeOperationSequences(): boolean {
    const ordered = this.context.operations.sortedOperations(); const before = ordered.map((operation) => ({ id: operation.id, sequence: operation.sequence })); const after = ordered.map((operation, index) => ({ id: operation.id, sequence: (index + 1) * 10 }));
    if (before.every((item, index) => item.sequence === after[index].sequence)) return false;
    return this.run(new ReversibleCommand('Normalize operation sequence', before.map((item) => item.id), 'processFlow',
      ({ operations }) => { for (const item of after) if (!operations.updateOperation(item.id, { sequence: item.sequence })) throw new Error('Operation sequence could not be normalized.'); },
      ({ operations }) => { for (const item of before) if (!operations.updateOperation(item.id, { sequence: item.sequence })) throw new Error('Operation sequence normalization could not be undone.'); }));
  }

  public createConnection(sourceId: string, targetId: string, sourceAnchor: OperationAnchor, targetAnchor: OperationAnchor, type: ConnectionType = 'Standard'): { readonly result: ConnectionMutationResult; readonly connection?: ProcessConnection } {
    let snapshot: ProcessConnection | null = null; let result: ConnectionMutationResult = 'none';
    const command = new ReversibleCommand(() => `Create connection ${snapshot?.id ?? `${sourceId} to ${targetId}`}`, () => snapshot ? [snapshot.id, sourceId, targetId] : [sourceId, targetId], 'processFlow',
      ({ connections }) => { if (!snapshot) { const created = connections.createConnection(sourceId, targetId, sourceAnchor, targetAnchor, type); result = created.result; if (!created.connection) throw new Error(`Connection creation failed: ${created.result}.`); snapshot = cloneConnection(created.connection); } else { if (!connections.restoreConnection(snapshot)) throw new Error('Connection could not be restored.'); connections.selectConnection(snapshot.id); } },
      ({ connections }) => { if (!snapshot || connections.deleteConnection(snapshot.id) !== 'deleted') throw new Error('Connection creation could not be undone.'); });
    return this.run(command) && snapshot ? { result: 'created', connection: snapshot } : { result };
  }

  public deleteConnection(connectionId: string): ConnectionMutationResult {
    const connection = this.context.connections.getConnection(connectionId); if (!connection) return 'none'; if (connection.locked) return 'locked'; const snapshot = cloneConnection(connection);
    const command = new ReversibleCommand(`Delete connection ${connectionId}`, [connectionId, connection.sourceOperationId, connection.targetOperationId], 'processFlow',
      ({ connections }) => { if (connections.deleteConnection(connectionId) !== 'deleted') throw new Error('Connection could not be deleted.'); },
      ({ connections }) => { if (!connections.restoreConnection(snapshot)) throw new Error('Connection could not be restored.'); connections.selectConnection(connectionId); });
    return this.run(command) ? 'deleted' : 'none';
  }

  public reverseConnection(connectionId: string): ConnectionMutationResult {
    const connection = this.context.connections.getConnection(connectionId); if (!connection) return 'none'; if (connection.locked) return 'locked';
    const command = new ReversibleCommand(`Reverse connection ${connectionId}`, [connectionId, connection.sourceOperationId, connection.targetOperationId], 'processFlow',
      ({ connections }) => { const result = connections.reverseConnection(connectionId); if (result !== 'updated') throw new Error(`Connection reversal failed: ${result}.`); },
      ({ connections }) => { const result = connections.reverseConnection(connectionId); if (result !== 'updated') throw new Error(`Connection reversal could not be undone: ${result}.`); });
    return this.run(command) ? 'updated' : 'duplicate';
  }

  public updateConnection(connectionId: string, patch: ProcessConnectionPatch, description?: string): boolean {
    const connection = this.context.connections.getConnection(connectionId); if (!connection) return false; const after = changedPatch(connection, patch) as ProcessConnectionPatch; if (!Object.keys(after).length) return false; const before = beforePatch(connection, after) as ProcessConnectionPatch;
    return this.run(new ReversibleCommand(description ?? this.connectionDescription(connectionId, after), [connectionId], 'processFlow',
      ({ connections }) => { if (!connections.updateConnection(connectionId, after)) throw new Error('Connection update was rejected.'); },
      ({ connections }) => { if (!connections.updateConnection(connectionId, before)) throw new Error('Connection update could not be undone.'); }));
  }

  public updateProjectMetadata(patch: MetadataPatch): boolean {
    const metadata = this.context.project.getMetadata(); const after = changedPatch(metadata, patch) as MetadataPatch; if (!Object.keys(after).length) return false; const before = beforePatch(metadata, after) as MetadataPatch; const field = Object.keys(after)[0] ?? 'metadata';
    return this.run(new ReversibleCommand(field === 'name' ? 'Rename project' : `Edit project ${field}`, [metadata.id], undefined,
      ({ project }) => { if (!project.applyMetadata(after)) throw new Error('Project metadata update was rejected.'); },
      ({ project }) => { if (!project.applyMetadata(before)) throw new Error('Project metadata update could not be undone.'); }));
  }

  public updateProjectSettings(patch: Partial<ProjectSettings>): boolean {
    const settings = this.context.project.getSettings(); const after = changedPatch(settings, patch); if (!Object.keys(after).length) return false; const before = beforePatch(settings, after); const field = Object.keys(after)[0] ?? 'settings';
    const descriptions: Readonly<Record<string, string>> = { gridBaseInterval: 'Change project grid interval', routingClearance: 'Change project routing clearance', displayPrecision: 'Change project display precision', unitSystem: 'Change project unit system' };
    return this.run(new ReversibleCommand(descriptions[field] ?? 'Change project settings', [this.context.project.getMetadata().id], undefined,
      ({ project }) => { if (!project.applySettings(after)) throw new Error('Project settings update was rejected.'); },
      ({ project }) => { if (!project.applySettings(before)) throw new Error('Project settings update could not be undone.'); }));
  }

  private run(command: ReversibleCommand): boolean { try { return this.history.execute(command); } catch { return false; } }
  private resourceDescription(id: string, patch: PlacedResourcePatch): string {
    if (patch.name !== undefined) return `Rename resource ${id}`; if (patch.worldX !== undefined || patch.worldY !== undefined) return `Move resource ${id}`; if (patch.width !== undefined || patch.height !== undefined) return `Resize resource ${id}`; if (patch.capacity !== undefined) return `Change capacity for ${id}`; if (patch.rotationDegrees !== undefined) return `Rotate resource ${id}`; if (patch.active !== undefined) return `${patch.active ? 'Activate' : 'Deactivate'} resource ${id}`; if (patch.visible !== undefined) return `${patch.visible ? 'Show' : 'Hide'} resource ${id}`; if (patch.locked !== undefined) return `${patch.locked ? 'Lock' : 'Unlock'} resource ${id}`; return `Edit resource ${id}`;
  }
  private operationDescription(operation: OperationInstance, patch: OperationInstancePatch): string {
    const label = `OP-${String(operation.sequence).padStart(4, '0')}`; if (patch.name !== undefined) return `Rename operation ${label}`; if (patch.worldX !== undefined || patch.worldY !== undefined) return `Move operation ${label}`; if (patch.width !== undefined || patch.height !== undefined) return `Resize operation ${label}`; if (patch.assignedResourceId !== undefined) return patch.assignedResourceId ? `Assign ${label} to ${patch.assignedResourceId}` : `Unassign ${label}`; if (patch.cycleTimeSeconds !== undefined) return `Change cycle time for ${label}`; if (patch.sequence !== undefined) return `Change sequence for ${label}`; if (patch.operationType !== undefined) return `Change operation type for ${label}`; if (patch.timingCategory !== undefined) return `Change timing category for ${label}`; if (patch.notes !== undefined) return `Edit notes for ${label}`; if (patch.locked !== undefined) return `${patch.locked ? 'Lock' : 'Unlock'} operation ${label}`; if (patch.visible !== undefined) return `${patch.visible ? 'Show' : 'Hide'} operation ${label}`; return `Edit operation ${label}`;
  }
  private connectionDescription(id: string, patch: ProcessConnectionPatch): string { if (patch.label !== undefined) return `Change label for ${id}`; if (patch.connectionType !== undefined) return `Change type for ${id}`; if (patch.visible !== undefined) return `${patch.visible ? 'Show' : 'Hide'} connection ${id}`; if (patch.locked !== undefined) return `${patch.locked ? 'Lock' : 'Unlock'} connection ${id}`; return `Edit connection ${id}`; }
}
