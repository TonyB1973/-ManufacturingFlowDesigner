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
import type { FactoryLayoutBoundary, FactoryLayoutBoundaryPatch } from '../../models/factory/FactoryLayoutBoundary';
import type { FactoryWall, FactoryWallPatch } from '../../models/factory/FactoryWall';
import type { FactoryArea, FactoryAreaPatch } from '../../models/factory/FactoryArea';
import type { FactoryAisle, FactoryAislePatch } from '../../models/factory/FactoryAisle';
import type { GeometryPoint } from '../geometry/FactoryFootprintGeometry';
import { cloneFactoryRoute, type FactoryRoute } from '../../models/factory/FactoryRoute';
import { cloneFactoryAnnotation, type FactoryAnnotation } from '../../models/factory/FactoryAnnotation';
import { cloneStandardWorkEntry } from '../../models/standardWork/StandardWork';
import { cloneStandardWorkHandover } from '../../models/standardWork/StandardWorkHandover';
import { cloneStandardWorkOperator } from '../../models/standardWork/StandardWorkOperator';

type MetadataPatch = Partial<Pick<ProjectMetadata, 'name' | 'description' | 'author' | 'company'>>;
export interface PositionChange { readonly id: string; readonly before: { readonly x: number; readonly y: number }; readonly after: { readonly x: number; readonly y: number }; }

const cloneResource = (resource: PlacedResource): PlacedResource => ({ ...resource, clearance: { ...resource.clearance }, selected: false });
const cloneOperation = (operation: OperationInstance): OperationInstance => ({ ...operation, selected: false });
const cloneConnection = (connection: ProcessConnection): ProcessConnection => ({ ...connection, sourceAnchor: { ...connection.sourceAnchor }, targetAnchor: { ...connection.targetAnchor }, routePoints: connection.routePoints.map((point) => ({ ...point })), selected: false });
const cloneBoundary = (value: FactoryLayoutBoundary): FactoryLayoutBoundary => ({ ...value, points: value.points.map((point) => ({ ...point })) });
const cloneWall = (value: FactoryWall): FactoryWall => ({ ...value, start: { ...value.start }, end: { ...value.end } });
const cloneArea = (value: FactoryArea): FactoryArea => ({ ...value });
const cloneAisle = (value: FactoryAisle): FactoryAisle => ({ ...value, points: value.points.map((point) => ({ ...point })) });
const uniqueAnnotations = (values: readonly FactoryAnnotation[]): FactoryAnnotation[] => values.filter((value, index, all) => all.findIndex((candidate) => candidate.id === value.id) === index).map(cloneFactoryAnnotation);
const same = (left: unknown, right: unknown): boolean => Object.is(left, right) || (typeof left === 'object' && left !== null && typeof right === 'object' && right !== null && JSON.stringify(left) === JSON.stringify(right));
const changedPatch = <T extends object>(source: T, patch: Partial<T>): Partial<T> => Object.fromEntries(Object.entries(patch).filter(([key, value]) => !same(source[key as keyof T], value))) as Partial<T>;
const beforePatch = <T extends object>(source: T, patch: Partial<T>): Partial<T> => Object.fromEntries(Object.keys(patch).map((key) => { const value = source[key as keyof T]; return [key, typeof value === 'object' && value !== null ? { ...value } : value]; })) as Partial<T>;

export class CommandFactory {
  public constructor(private readonly history: CommandHistoryService, private readonly context: CommandExecutionContext) {}

  public createBoundary(points: readonly GeometryPoint[], replaceExisting = false): FactoryLayoutBoundary | null {
    let snapshot: FactoryLayoutBoundary | null = null; const existing = this.context.structure.getActiveBoundary(); if (existing && !replaceExisting) return null; if (existing?.locked) return null; const previous = existing ? cloneBoundary(existing) : null;
    const command = new ReversibleCommand(() => `${previous ? 'Replace' : 'Create'} factory boundary`, () => [previous?.id, snapshot?.id].filter((id): id is string => Boolean(id)), 'factoryLayout',
      ({ structure, selection }) => { if (previous && structure.getBoundary(previous.id) && !structure.delete('boundary', previous.id)) throw new Error('Existing boundary could not be replaced.'); if (!snapshot) { const created = structure.createBoundary([...points]); if (!created) throw new Error('Boundary could not be created.'); snapshot = cloneBoundary(created); } else if (!structure.restoreBoundary(snapshot)) throw new Error('Boundary could not be restored.'); selection.select({ kind: 'boundary', id: snapshot.id }); },
      ({ structure, selection }) => { if (!snapshot || !structure.delete('boundary', snapshot.id)) throw new Error('Boundary creation could not be undone.'); if (previous && !structure.restoreBoundary(previous)) throw new Error('Previous boundary could not be restored.'); previous ? selection.select({ kind: 'boundary', id: previous.id }) : selection.clear(); });
    return this.run(command) ? snapshot : null;
  }

  public createWall(start: GeometryPoint, end: GeometryPoint, thickness = 100): FactoryWall | null { let snapshot: FactoryWall | null = null; const command = new ReversibleCommand(() => `Create wall ${snapshot?.id ?? ''}`.trim(), () => snapshot ? [snapshot.id] : [], 'factoryLayout', ({ structure, selection }) => { if (!snapshot) { const created = structure.createWall(start, end, thickness); if (!created) throw new Error('Wall could not be created.'); snapshot = cloneWall(created); } else if (!structure.restoreWall(snapshot)) throw new Error('Wall could not be restored.'); selection.select({ kind: 'wall', id: snapshot.id }); }, ({ structure }) => { if (!snapshot || !structure.delete('wall', snapshot.id)) throw new Error('Wall creation could not be undone.'); }); return this.run(command) ? snapshot : null; }
  public createArea(worldX: number, worldY: number, width: number, depth: number): FactoryArea | null { let snapshot: FactoryArea | null = null; const command = new ReversibleCommand(() => `Create area ${snapshot?.id ?? ''}`.trim(), () => snapshot ? [snapshot.id] : [], 'factoryLayout', ({ structure, selection }) => { if (!snapshot) { const created = structure.createArea(worldX, worldY, width, depth); if (!created) throw new Error('Area could not be created.'); snapshot = cloneArea(created); } else if (!structure.restoreArea(snapshot)) throw new Error('Area could not be restored.'); selection.select({ kind: 'area', id: snapshot.id }); }, ({ structure }) => { if (!snapshot || !structure.delete('area', snapshot.id)) throw new Error('Area creation could not be undone.'); }); return this.run(command) ? snapshot : null; }
  public createAisle(points: readonly GeometryPoint[], width = 1000): FactoryAisle | null { let snapshot: FactoryAisle | null = null; const command = new ReversibleCommand(() => `Create aisle ${snapshot?.id ?? ''}`.trim(), () => snapshot ? [snapshot.id] : [], 'factoryLayout', ({ structure, selection }) => { if (!snapshot) { const created = structure.createAisle([...points], width); if (!created) throw new Error('Aisle could not be created.'); snapshot = cloneAisle(created); } else if (!structure.restoreAisle(snapshot)) throw new Error('Aisle could not be restored.'); selection.select({ kind: 'aisle', id: snapshot.id }); }, ({ structure }) => { if (!snapshot || !structure.delete('aisle', snapshot.id)) throw new Error('Aisle creation could not be undone.'); }); return this.run(command) ? snapshot : null; }

  public updateBoundary(id: string, patch: FactoryLayoutBoundaryPatch, description = `Edit boundary ${id}`): boolean { const item = this.context.structure.getBoundary(id); if (!item) return false; const after = changedPatch(item, patch) as FactoryLayoutBoundaryPatch; if (!Object.keys(after).length) return false; const before = { ...beforePatch(item, after), ...(after.points ? { points: item.points.map((point) => ({ ...point })) } : {}) } as FactoryLayoutBoundaryPatch; return this.run(new ReversibleCommand(description, [id], 'factoryLayout', ({ structure }) => { if (!structure.updateBoundary(id, after)) throw new Error('Boundary update rejected.'); }, ({ structure }) => { if (!structure.updateBoundary(id, before)) throw new Error('Boundary update could not be undone.'); })); }
  public updateWall(id: string, patch: FactoryWallPatch, description = `Edit wall ${id}`): boolean { const item = this.context.structure.getWall(id); if (!item) return false; const after = changedPatch(item, patch) as FactoryWallPatch; if (!Object.keys(after).length) return false; const before = beforePatch(item, after) as FactoryWallPatch; return this.run(new ReversibleCommand(description, [id], 'factoryLayout', ({ structure }) => { if (!structure.updateWall(id, after)) throw new Error('Wall update rejected.'); }, ({ structure }) => { if (!structure.updateWall(id, before)) throw new Error('Wall update could not be undone.'); })); }
  public updateArea(id: string, patch: FactoryAreaPatch, description = `Edit area ${id}`): boolean { const item = this.context.structure.getArea(id); if (!item) return false; const after = changedPatch(item, patch) as FactoryAreaPatch; if (!Object.keys(after).length) return false; const before = beforePatch(item, after) as FactoryAreaPatch; return this.run(new ReversibleCommand(description, [id], 'factoryLayout', ({ structure }) => { if (!structure.updateArea(id, after)) throw new Error('Area update rejected.'); }, ({ structure }) => { if (!structure.updateArea(id, before)) throw new Error('Area update could not be undone.'); })); }
  public updateAisle(id: string, patch: FactoryAislePatch, description = `Edit aisle ${id}`): boolean { const item = this.context.structure.getAisle(id); if (!item) return false; const after = changedPatch(item, patch) as FactoryAislePatch; if (!Object.keys(after).length) return false; const before = { ...beforePatch(item, after), ...(after.points ? { points: item.points.map((point) => ({ ...point })) } : {}) } as FactoryAislePatch; return this.run(new ReversibleCommand(description, [id], 'factoryLayout', ({ structure }) => { if (!structure.updateAisle(id, after)) throw new Error('Aisle update rejected.'); }, ({ structure }) => { if (!structure.updateAisle(id, before)) throw new Error('Aisle update could not be undone.'); })); }

  public deleteFactoryStructure(kind: 'boundary' | 'wall' | 'area' | 'aisle', id: string): boolean {
    const value = kind === 'boundary' ? this.context.structure.getBoundary(id) : kind === 'wall' ? this.context.structure.getWall(id) : kind === 'area' ? this.context.structure.getArea(id) : this.context.structure.getAisle(id); if (!value || value.locked) return false;
    const snapshot = kind === 'boundary' ? cloneBoundary(value as FactoryLayoutBoundary) : kind === 'wall' ? cloneWall(value as FactoryWall) : kind === 'area' ? cloneArea(value as FactoryArea) : cloneAisle(value as FactoryAisle);
    const attachedRoutes = kind === 'area' ? this.context.routes.getRoutesForArea(id).map(cloneFactoryRoute) : [];
    const attachedAnnotations = uniqueAnnotations([...this.context.annotations.getAttached(kind, id), ...attachedRoutes.flatMap((route) => this.context.annotations.getAttached('factoryRoute', route.id))]);
    return this.run(new ReversibleCommand(`Delete ${kind} ${id}`, [id, ...attachedRoutes.map((route) => route.id), ...attachedAnnotations.map((annotation) => annotation.id)], 'factoryLayout',
      ({ structure, routes, annotations, selection }) => { for (const annotation of attachedAnnotations) annotations.deleteAnnotation(annotation.id, true); if (attachedRoutes.length) routes.deleteAttachedToArea(id); if (!structure.delete(kind, id)) throw new Error(`${kind} could not be deleted.`); selection.remove({ kind, id }); },
      ({ structure, routes, annotations, selection }) => { const restored = kind === 'boundary' ? structure.restoreBoundary(snapshot as FactoryLayoutBoundary) : kind === 'wall' ? structure.restoreWall(snapshot as FactoryWall) : kind === 'area' ? structure.restoreArea(snapshot as FactoryArea) : structure.restoreAisle(snapshot as FactoryAisle); if (!restored) throw new Error(`${kind} could not be restored.`); for (const route of attachedRoutes) if (!routes.restoreRoute(route)) throw new Error(`FactoryRoute ${route.id} could not be restored.`); for (const annotation of attachedAnnotations) if (!annotations.restoreAnnotation(annotation)) throw new Error(`Annotation ${annotation.id} could not be restored.`); selection.select({ kind, id }); }));
  }

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
    const snapshot = cloneResource(resource); const assignments = this.context.operations.getOperations().filter((operation) => operation.assignedResourceId === resourceId).map((operation) => operation.id); const linkedOperators = this.context.standardWorkOperators.getLinkedToResource(resourceId).map(cloneStandardWorkOperator); const attachedRoutes = this.context.routes.getRoutesForResource(resourceId).map(cloneFactoryRoute); const attachedAnnotations = uniqueAnnotations([...this.context.annotations.getAttached('resource', resourceId), ...attachedRoutes.flatMap((route) => this.context.annotations.getAttached('factoryRoute', route.id))]);
    const command = new ReversibleCommand(`Delete resource ${resourceId}`, [resourceId, ...assignments, ...linkedOperators.map((item) => item.id), ...attachedRoutes.map((route) => route.id), ...attachedAnnotations.map((annotation) => annotation.id)], 'factoryLayout',
      ({ resources, operations, routes, annotations, standardWorkOperators }) => { for (const annotation of attachedAnnotations) annotations.deleteAnnotation(annotation.id, true); routes.deleteAttachedToResource(resourceId); standardWorkOperators.clearResourceLink(resourceId); if (resources.deleteResource(resourceId) !== 'deleted') throw new Error('Resource could not be deleted.'); operations.unassignResource(resourceId); },
      ({ resources, operations, routes, annotations, standardWorkOperators }) => { if (!resources.restoreResource(snapshot)) throw new Error('Resource could not be restored.'); for (const operationId of assignments) if (!operations.updateOperation(operationId, { assignedResourceId: resourceId })) throw new Error(`Assignment for ${operationId} could not be restored.`); for (const operator of linkedOperators) if (!standardWorkOperators.replaceOperator(operator)) throw new Error(`Operator link ${operator.id} could not be restored.`); for (const route of attachedRoutes) if (!routes.restoreRoute(route)) throw new Error(`FactoryRoute ${route.id} could not be restored.`); for (const annotation of attachedAnnotations) if (!annotations.restoreAnnotation(annotation)) throw new Error(`Annotation ${annotation.id} could not be restored.`); resources.selectResource(resourceId); });
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

  public commitResourceRotation(resourceId: string, before: number, after: number): boolean {
    if (same(before, after)) return false;
    return this.run(new ReversibleCommand(`Rotate resource ${resourceId}`, [resourceId], 'factoryLayout',
      ({ resources }) => { if (!resources.updateResource(resourceId, { rotationDegrees: after })) throw new Error('Resource rotation was rejected.'); },
      ({ resources }) => { if (!resources.updateResource(resourceId, { rotationDegrees: before })) throw new Error('Resource rotation could not be undone.'); }));
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
    const snapshot = cloneOperation(operation); const attached = this.context.connections.getConnectionsForOperation(operationId).map(cloneConnection); const standardWorkEntries = this.context.standardWork.getEntriesForOperation(operationId).map(cloneStandardWorkEntry); const entryIds = new Set(standardWorkEntries.map((item) => item.id)); const handovers = this.context.standardWorkHandovers.getHandovers().filter((item) => entryIds.has(item.fromEntryId) || entryIds.has(item.toEntryId)).map(cloneStandardWorkHandover);
    const command = new ReversibleCommand(`Delete operation OP-${String(operation.sequence).padStart(4, '0')}`, [operationId, ...attached.map((item) => item.id), ...standardWorkEntries.map((item) => item.id), ...handovers.map((item) => item.id)], 'processFlow',
      ({ operations, connections, standardWork, standardWorkHandovers, standardWorkSelection }) => { for (const handover of handovers) standardWorkHandovers.deleteHandover(handover.id); for (const entry of standardWorkEntries) if (!standardWork.deleteEntry(entry.id)) throw new Error(`Standard Work entry ${entry.id} could not be deleted.`); standardWorkSelection.clear(); if (operations.deleteOperation(operationId) !== 'deleted') throw new Error('Operation could not be deleted.'); connections.deleteForOperation(operationId); },
      ({ operations, connections, standardWork, standardWorkHandovers }) => { if (!operations.restoreOperation(snapshot)) throw new Error('Operation could not be restored.'); for (const connection of attached) if (!connections.restoreConnection(connection)) throw new Error(`Connection ${connection.id} could not be restored.`); for (const entry of standardWorkEntries) if (!standardWork.restoreEntry(entry)) throw new Error(`Standard Work entry ${entry.id} could not be restored.`); for (const handover of handovers) if (!standardWorkHandovers.restoreHandover(handover)) throw new Error(`Standard Work handover ${handover.id} could not be restored.`); operations.selectOperation(operationId); connections.recalculateAll(); });
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

  public insertFactoryStructure(snapshots: { readonly walls: readonly FactoryWall[]; readonly areas: readonly FactoryArea[]; readonly aisles: readonly FactoryAisle[] }, description = 'Paste factory structure'): boolean {
    const walls = snapshots.walls.map(cloneWall); const areas = snapshots.areas.map(cloneArea); const aisles = snapshots.aisles.map(cloneAisle);
    const refs: SelectionItem[] = [...walls.map((item) => ({ kind: 'wall' as const, id: item.id })), ...areas.map((item) => ({ kind: 'area' as const, id: item.id })), ...aisles.map((item) => ({ kind: 'aisle' as const, id: item.id }))];
    if (!refs.length) return false;
    return this.run(new ReversibleCommand(description, refs.map((item) => item.id), 'factoryLayout',
      ({ structure, selection }) => { for (const item of walls) if (!structure.restoreWall(item)) throw new Error(`Wall ${item.id} could not be inserted.`); for (const item of areas) if (!structure.restoreArea(item)) throw new Error(`Area ${item.id} could not be inserted.`); for (const item of aisles) if (!structure.restoreAisle(item)) throw new Error(`Aisle ${item.id} could not be inserted.`); selection.set(refs, refs.at(-1)); },
      ({ structure, selection }) => { for (const item of [...aisles].reverse()) if (!structure.delete('aisle', item.id)) throw new Error(`Aisle ${item.id} could not be removed.`); for (const item of [...areas].reverse()) if (!structure.delete('area', item.id)) throw new Error(`Area ${item.id} could not be removed.`); for (const item of [...walls].reverse()) if (!structure.delete('wall', item.id)) throw new Error(`Wall ${item.id} could not be removed.`); selection.clear(); }));
  }

  public insertFactorySelection(snapshots: { readonly resources: readonly PlacedResource[]; readonly walls: readonly FactoryWall[]; readonly areas: readonly FactoryArea[]; readonly aisles: readonly FactoryAisle[]; readonly routes: readonly FactoryRoute[]; readonly annotations?: readonly FactoryAnnotation[] }, description = 'Paste factory selection'): boolean {
    const resources = snapshots.resources.map(cloneResource); const walls = snapshots.walls.map(cloneWall); const areas = snapshots.areas.map(cloneArea); const aisles = snapshots.aisles.map(cloneAisle); const routes = snapshots.routes.map(cloneFactoryRoute); const annotations = (snapshots.annotations ?? []).map(cloneFactoryAnnotation);
    const refs: SelectionItem[] = [...resources.map((item) => ({ kind: 'resource' as const, id: item.id })), ...walls.map((item) => ({ kind: 'wall' as const, id: item.id })), ...areas.map((item) => ({ kind: 'area' as const, id: item.id })), ...aisles.map((item) => ({ kind: 'aisle' as const, id: item.id })), ...routes.map((item) => ({ kind: 'factoryRoute' as const, id: item.id })), ...annotations.map((item) => ({ kind: 'factoryAnnotation' as const, id: item.id }))];
    if (!refs.length) return false;
    return this.run(new ReversibleCommand(description, refs.map((item) => item.id), 'factoryLayout',
      (context) => { for (const item of resources) if (!context.resources.restoreResource(item)) throw new Error(`Resource ${item.id} could not be inserted.`); for (const item of walls) if (!context.structure.restoreWall(item)) throw new Error(`Wall ${item.id} could not be inserted.`); for (const item of areas) if (!context.structure.restoreArea(item)) throw new Error(`Area ${item.id} could not be inserted.`); for (const item of aisles) if (!context.structure.restoreAisle(item)) throw new Error(`Aisle ${item.id} could not be inserted.`); for (const item of routes) if (!context.routes.restoreRoute(item)) throw new Error(`FactoryRoute ${item.id} could not be inserted.`); for (const item of annotations) if (!context.annotations.restoreAnnotation(item)) throw new Error(`Annotation ${item.id} could not be inserted.`); context.selection.set(refs, refs.at(-1)); },
      (context) => { for (const item of [...annotations].reverse()) if (!context.annotations.deleteAnnotation(item.id, true)) throw new Error(`Annotation ${item.id} could not be removed.`); for (const item of [...routes].reverse()) if (!context.routes.deleteRoute(item.id)) throw new Error(`FactoryRoute ${item.id} could not be removed.`); for (const item of [...aisles].reverse()) if (!context.structure.delete('aisle', item.id)) throw new Error(`Aisle ${item.id} could not be removed.`); for (const item of [...areas].reverse()) if (!context.structure.delete('area', item.id)) throw new Error(`Area ${item.id} could not be removed.`); for (const item of [...walls].reverse()) if (!context.structure.delete('wall', item.id)) throw new Error(`Wall ${item.id} could not be removed.`); for (const item of [...resources].reverse()) if (context.resources.deleteResource(item.id) !== 'deleted') throw new Error(`Resource ${item.id} could not be removed.`); context.selection.clear(); }));
  }

  public deleteFactoryStructures(items: readonly Extract<SelectionItem, { readonly kind: 'wall' | 'area' | 'aisle' }>[], description = 'Delete factory structure'): boolean {
    const walls = items.filter((item) => item.kind === 'wall').map((item) => this.context.structure.getWall(item.id)).filter((item): item is FactoryWall => Boolean(item && !item.locked)).map(cloneWall);
    const areas = items.filter((item) => item.kind === 'area').map((item) => this.context.structure.getArea(item.id)).filter((item): item is FactoryArea => Boolean(item && !item.locked)).map(cloneArea);
    const aisles = items.filter((item) => item.kind === 'aisle').map((item) => this.context.structure.getAisle(item.id)).filter((item): item is FactoryAisle => Boolean(item && !item.locked)).map(cloneAisle);
    const refs: SelectionItem[] = [...walls.map((item) => ({ kind: 'wall' as const, id: item.id })), ...areas.map((item) => ({ kind: 'area' as const, id: item.id })), ...aisles.map((item) => ({ kind: 'aisle' as const, id: item.id }))];
    if (!refs.length) return false;
    const attachedRoutes = areas.flatMap((area) => this.context.routes.getRoutesForArea(area.id)).filter((route, index, all) => all.findIndex((candidate) => candidate.id === route.id) === index).map(cloneFactoryRoute);
    const attachedAnnotations = uniqueAnnotations([...walls.flatMap((item) => this.context.annotations.getAttached('wall', item.id)), ...areas.flatMap((item) => this.context.annotations.getAttached('area', item.id)), ...aisles.flatMap((item) => this.context.annotations.getAttached('aisle', item.id)), ...attachedRoutes.flatMap((route) => this.context.annotations.getAttached('factoryRoute', route.id))]);
    return this.run(new ReversibleCommand(description, [...refs.map((item) => item.id), ...attachedRoutes.map((route) => route.id), ...attachedAnnotations.map((annotation) => annotation.id)], 'factoryLayout',
      ({ structure, routes, annotations, selection }) => { for (const annotation of attachedAnnotations) annotations.deleteAnnotation(annotation.id, true); for (const area of areas) routes.deleteAttachedToArea(area.id); for (const item of walls) if (!structure.delete('wall', item.id)) throw new Error(`Wall ${item.id} could not be deleted.`); for (const item of areas) if (!structure.delete('area', item.id)) throw new Error(`Area ${item.id} could not be deleted.`); for (const item of aisles) if (!structure.delete('aisle', item.id)) throw new Error(`Aisle ${item.id} could not be deleted.`); selection.clear(); },
      ({ structure, routes, annotations, selection }) => { for (const item of walls) if (!structure.restoreWall(item)) throw new Error(`Wall ${item.id} could not be restored.`); for (const item of areas) if (!structure.restoreArea(item)) throw new Error(`Area ${item.id} could not be restored.`); for (const item of aisles) if (!structure.restoreAisle(item)) throw new Error(`Aisle ${item.id} could not be restored.`); for (const route of attachedRoutes) if (!routes.restoreRoute(route)) throw new Error(`FactoryRoute ${route.id} could not be restored.`); for (const annotation of attachedAnnotations) if (!annotations.restoreAnnotation(annotation)) throw new Error(`Annotation ${annotation.id} could not be restored.`); selection.set(refs, refs.at(-1)); }));
  }

  public deleteFactoryAnnotations(ids: readonly string[], description = 'Delete factory annotations'): boolean {
    const snapshots = ids.map((id) => this.context.annotations.getAnnotation(id)).filter((item): item is FactoryAnnotation => Boolean(item && !item.locked)).map(cloneFactoryAnnotation);
    if (!snapshots.length) return false;
    return this.run(new ReversibleCommand(description, snapshots.map((item) => item.id), 'factoryLayout',
      ({ annotations, selection }) => { for (const item of snapshots) if (!annotations.deleteAnnotation(item.id)) throw new Error(`Annotation ${item.id} could not be deleted.`); selection.clear(); },
      ({ annotations, selection }) => { for (const item of snapshots) if (!annotations.restoreAnnotation(item)) throw new Error(`Annotation ${item.id} could not be restored.`); const refs = snapshots.map((item) => ({ kind: 'factoryAnnotation' as const, id: item.id })); selection.set(refs, refs.at(-1)); }));
  }

  public insertProcess(snapshots: { readonly operations: readonly OperationInstance[]; readonly connections: readonly ProcessConnection[] }, description = 'Paste process selection'): boolean {
    if (!snapshots.operations.length && !snapshots.connections.length) return false; const operations = snapshots.operations.map(cloneOperation); const connections = snapshots.connections.map(cloneConnection); const refs: SelectionItem[] = [...operations.map((item) => ({ kind: 'operation' as const, id: item.id })), ...connections.map((item) => ({ kind: 'connection' as const, id: item.id }))];
    return this.run(new ReversibleCommand(description, refs.map((item) => item.id), 'processFlow',
      (context) => { for (const item of operations) if (!context.operations.restoreOperation(item)) throw new Error(`Operation ${item.id} could not be inserted.`); for (const item of connections) if (!context.connections.restoreConnection(item)) throw new Error(`Connection ${item.id} could not be inserted.`); context.selection.set(refs, refs.at(-1)); context.connections.recalculateAll(); },
      (context) => { for (const item of [...connections].reverse()) if (context.connections.deleteConnection(item.id) !== 'deleted') throw new Error(`Connection ${item.id} could not be removed.`); for (const item of [...operations].reverse()) if (context.operations.deleteOperation(item.id) !== 'deleted') throw new Error(`Operation ${item.id} could not be removed.`); context.selection.clear(); }));
  }

  public deleteResources(resourceIds: readonly string[], description = 'Delete resources'): DeleteResult {
    const snapshots = resourceIds.map((id) => this.context.resources.getResource(id)).filter((item): item is PlacedResource => Boolean(item && !item.locked)).map(cloneResource); if (!snapshots.length) return 'locked';
    const assignments = this.context.operations.getOperations().filter((operation) => snapshots.some((resource) => resource.id === operation.assignedResourceId)).map((operation) => ({ id: operation.id, resourceId: operation.assignedResourceId! })); const linkedOperators = snapshots.flatMap((resource) => this.context.standardWorkOperators.getLinkedToResource(resource.id)).filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index).map(cloneStandardWorkOperator); const attachedRoutes = snapshots.flatMap((resource) => this.context.routes.getRoutesForResource(resource.id)).filter((route, index, all) => all.findIndex((candidate) => candidate.id === route.id) === index).map(cloneFactoryRoute); const attachedAnnotations = uniqueAnnotations([...snapshots.flatMap((resource) => this.context.annotations.getAttached('resource', resource.id)), ...attachedRoutes.flatMap((route) => this.context.annotations.getAttached('factoryRoute', route.id))]);
    const command = new ReversibleCommand(description, [...snapshots.map((item) => item.id), ...assignments.map((item) => item.id), ...attachedRoutes.map((route) => route.id), ...attachedAnnotations.map((annotation) => annotation.id)], 'factoryLayout',
      ({ resources, operations, routes, annotations, standardWorkOperators }) => { for (const annotation of attachedAnnotations) annotations.deleteAnnotation(annotation.id, true); for (const item of snapshots) { routes.deleteAttachedToResource(item.id); standardWorkOperators.clearResourceLink(item.id); if (resources.deleteResource(item.id) !== 'deleted') throw new Error(`Resource ${item.id} could not be deleted.`); operations.unassignResource(item.id); } },
      ({ resources, operations, routes, annotations, standardWorkOperators, selection }) => { for (const item of snapshots) if (!resources.restoreResource(item)) throw new Error(`Resource ${item.id} could not be restored.`); for (const item of assignments) if (!operations.updateOperation(item.id, { assignedResourceId: item.resourceId })) throw new Error(`Assignment ${item.id} could not be restored.`); for (const operator of linkedOperators) if (!standardWorkOperators.replaceOperator(operator)) throw new Error(`Operator link ${operator.id} could not be restored.`); for (const route of attachedRoutes) if (!routes.restoreRoute(route)) throw new Error(`FactoryRoute ${route.id} could not be restored.`); for (const annotation of attachedAnnotations) if (!annotations.restoreAnnotation(annotation)) throw new Error(`Annotation ${annotation.id} could not be restored.`); const refs: SelectionItem[] = snapshots.map((item) => ({ kind: 'resource', id: item.id })); selection.set(refs, refs.at(-1)); });
    return this.run(command) ? 'deleted' : 'none';
  }

  public deleteProcess(operationIds: readonly string[], connectionIds: readonly string[], description = 'Delete process selection'): OperationDeleteResult {
    const operations = operationIds.map((id) => this.context.operations.getOperation(id)).filter((item): item is OperationInstance => Boolean(item && !item.locked)).map(cloneOperation);
    const operationSet = new Set(operations.map((item) => item.id)); const requested = new Set(connectionIds); const connections = this.context.connections.getConnections().filter((item) => operationSet.has(item.sourceOperationId) || operationSet.has(item.targetOperationId) || (!item.locked && requested.has(item.id))).map(cloneConnection);
    if (!operations.length && !connections.length) return 'locked';
    const standardWorkEntries = operations.flatMap((operation) => this.context.standardWork.getEntriesForOperation(operation.id)).filter((entry, index, all) => all.findIndex((candidate) => candidate.id === entry.id) === index).map(cloneStandardWorkEntry); const entryIds = new Set(standardWorkEntries.map((item) => item.id)); const handovers = this.context.standardWorkHandovers.getHandovers().filter((item) => entryIds.has(item.fromEntryId) || entryIds.has(item.toEntryId)).map(cloneStandardWorkHandover);
    const command = new ReversibleCommand(description, [...operations.map((item) => item.id), ...connections.map((item) => item.id), ...standardWorkEntries.map((item) => item.id), ...handovers.map((item) => item.id)], 'processFlow',
      (context) => { for (const handover of handovers) context.standardWorkHandovers.deleteHandover(handover.id); for (const entry of standardWorkEntries) if (!context.standardWork.deleteEntry(entry.id)) throw new Error(`Standard Work entry ${entry.id} could not be deleted.`); context.standardWorkSelection.clear(); for (const item of connections.filter((connection) => !operationSet.has(connection.sourceOperationId) && !operationSet.has(connection.targetOperationId))) if (context.connections.getConnection(item.id) && context.connections.deleteConnection(item.id) !== 'deleted') throw new Error(`Connection ${item.id} could not be deleted.`); for (const item of operations) { if (context.operations.deleteOperation(item.id) !== 'deleted') throw new Error(`Operation ${item.id} could not be deleted.`); context.connections.deleteForOperation(item.id); } context.selection.clear(); },
      (context) => { for (const item of operations) if (!context.operations.restoreOperation(item)) throw new Error(`Operation ${item.id} could not be restored.`); for (const item of connections) if (!context.connections.restoreConnection(item)) throw new Error(`Connection ${item.id} could not be restored.`); for (const entry of standardWorkEntries) if (!context.standardWork.restoreEntry(entry)) throw new Error(`Standard Work entry ${entry.id} could not be restored.`); for (const handover of handovers) if (!context.standardWorkHandovers.restoreHandover(handover)) throw new Error(`Standard Work handover ${handover.id} could not be restored.`); const refs: SelectionItem[] = [...operations.map((item) => ({ kind: 'operation' as const, id: item.id })), ...connections.map((item) => ({ kind: 'connection' as const, id: item.id }))]; context.selection.set(refs, refs.at(-1)); context.connections.recalculateAll(); });
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
    if (patch.name !== undefined) return `Rename resource ${id}`; if (patch.worldX !== undefined || patch.worldY !== undefined) return `Move resource ${id}`; if (patch.width !== undefined || patch.depth !== undefined) return `Resize resource ${id}`; if (patch.clearance !== undefined) return `Edit clearance for ${id}`; if (patch.capacity !== undefined) return `Change capacity for ${id}`; if (patch.rotationDegrees !== undefined) return `Rotate resource ${id}`; if (patch.active !== undefined) return `${patch.active ? 'Activate' : 'Deactivate'} resource ${id}`; if (patch.visible !== undefined) return `${patch.visible ? 'Show' : 'Hide'} resource ${id}`; if (patch.locked !== undefined) return `${patch.locked ? 'Lock' : 'Unlock'} resource ${id}`; return `Edit resource ${id}`;
  }
  private operationDescription(operation: OperationInstance, patch: OperationInstancePatch): string {
    const label = `OP-${String(operation.sequence).padStart(4, '0')}`; if (patch.name !== undefined) return `Rename operation ${label}`; if (patch.worldX !== undefined || patch.worldY !== undefined) return `Move operation ${label}`; if (patch.width !== undefined || patch.height !== undefined) return `Resize operation ${label}`; if (patch.assignedResourceId !== undefined) return patch.assignedResourceId ? `Assign ${label} to ${patch.assignedResourceId}` : `Unassign ${label}`; if (patch.cycleTimeSeconds !== undefined) return `Change cycle time for ${label}`; if (patch.sequence !== undefined) return `Change sequence for ${label}`; if (patch.operationType !== undefined) return `Change operation type for ${label}`; if (patch.timingCategory !== undefined) return `Change timing category for ${label}`; if (patch.notes !== undefined) return `Edit notes for ${label}`; if (patch.locked !== undefined) return `${patch.locked ? 'Lock' : 'Unlock'} operation ${label}`; if (patch.visible !== undefined) return `${patch.visible ? 'Show' : 'Hide'} operation ${label}`; return `Edit operation ${label}`;
  }
  private connectionDescription(id: string, patch: ProcessConnectionPatch): string { if (patch.label !== undefined) return `Change label for ${id}`; if (patch.connectionType !== undefined) return `Change type for ${id}`; if (patch.visible !== undefined) return `${patch.visible ? 'Show' : 'Hide'} connection ${id}`; if (patch.locked !== undefined) return `${patch.locked ? 'Lock' : 'Unlock'} connection ${id}`; return `Edit connection ${id}`; }
}
