import type { ProcessConnection } from '../../models/connections/ProcessConnection';
import type { OperationInstance } from '../../models/operations/OperationInstance';
import type { PlacedResource } from '../../models/resources/PlacedResource';
import type { SelectionController, SelectionItem } from '../../models/selection/Selection';
import type { CanvasWorkspaceId } from '../../models/workspace/Workspace';
import type { ConnectionStore } from '../ConnectionStore';
import type { OperationStore } from '../OperationStore';
import type { ProjectSessionService } from '../project/ProjectSessionService';
import type { ResourceStore } from '../ResourceStore';
import type { WorkspaceStore } from '../WorkspaceStore';
import type { CommandFactory } from '../history/CommandFactory';
import type { ConnectionIdProvider } from '../../utilities/ConnectionIdGenerator';
import type { OperationIdProvider } from '../../utilities/OperationIdGenerator';
import type { ResourceIdProvider } from '../../utilities/ResourceIdGenerator';
import type { FactoryStructureStore } from '../FactoryStructureStore';
import type { FactoryStructureIdProvider } from '../../utilities/FactoryStructureIdGenerator';
import type { FactoryWall } from '../../models/factory/FactoryWall';
import type { FactoryArea } from '../../models/factory/FactoryArea';
import type { FactoryAisle } from '../../models/factory/FactoryAisle';
import { aisleCorridorRectangles, combineFactoryExtents, wallRectangle } from '../geometry/FactoryStructureGeometry';
import { rectangleCorners } from '../geometry/FactoryFootprintGeometry';
import { cloneFactoryRoute, type FactoryRoute, type FactoryRouteEndpoint } from '../../models/factory/FactoryRoute';
import type { FactoryRouteStore } from '../FactoryRouteStore';
import type { FactoryRouteIdProvider } from '../../utilities/FactoryRouteIdGenerator';
import type { FactoryRouteCommandFactory } from '../history/FactoryRouteCommandFactory';
import { resolveFactoryRoutePolyline } from '../geometry/FactoryRouteGeometry';
import { cloneAnnotationAnchor, cloneFactoryAnnotation, type AnnotationAnchor, type FactoryAnnotation } from '../../models/factory/FactoryAnnotation';
import type { FactoryAnnotationStore } from '../FactoryAnnotationStore';
import type { FactoryAnnotationIdProvider } from '../../utilities/FactoryAnnotationIdGenerator';

export const CLIPBOARD_LIMITS = { resources: 5_000, operations: 10_000, connections: 20_000, structures: 20_000, routes: 20_000, annotations: 20_000 } as const;
const PASTE_OFFSET = 20;

interface ClipboardResource { readonly sourceId: string; readonly value: PlacedResource; }
interface ClipboardOperation { readonly sourceId: string; readonly value: OperationInstance; }
interface ClipboardConnection { readonly sourceId: string; readonly value: ProcessConnection; }
interface ClipboardWall { readonly sourceId: string; readonly value: FactoryWall; }
interface ClipboardArea { readonly sourceId: string; readonly value: FactoryArea; }
interface ClipboardAisle { readonly sourceId: string; readonly value: FactoryAisle; }
interface ClipboardFactoryRoute { readonly sourceId: string; readonly value: FactoryRoute; }
interface ClipboardFactoryAnnotation { readonly sourceId: string; readonly value: FactoryAnnotation; }
export interface ApplicationClipboard {
  readonly sourceWorkspace: CanvasWorkspaceId;
  readonly resources: readonly ClipboardResource[];
  readonly operations: readonly ClipboardOperation[];
  readonly connections: readonly ClipboardConnection[];
  readonly walls: readonly ClipboardWall[];
  readonly areas: readonly ClipboardArea[];
  readonly aisles: readonly ClipboardAisle[];
  readonly routes: readonly ClipboardFactoryRoute[];
  readonly annotations: readonly ClipboardFactoryAnnotation[];
  readonly bounds: { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number };
  readonly copiedAt: number;
  readonly pasteCount: number;
}

export interface EditingResult { readonly ok: boolean; readonly message: string; readonly count: number; }

const cloneResource = (value: PlacedResource): PlacedResource => ({ ...value, clearance: { ...value.clearance }, selected: false });
const cloneOperation = (value: OperationInstance): OperationInstance => ({ ...value, selected: false });
const cloneConnection = (value: ProcessConnection): ProcessConnection => ({ ...value, sourceAnchor: { ...value.sourceAnchor }, targetAnchor: { ...value.targetAnchor }, routePoints: value.routePoints.map((point) => ({ ...point })), selected: false });
const cloneWall = (value: FactoryWall): FactoryWall => ({ ...value, start: { ...value.start }, end: { ...value.end } });
const cloneArea = (value: FactoryArea): FactoryArea => ({ ...value });
const cloneAisle = (value: FactoryAisle): FactoryAisle => ({ ...value, points: value.points.map((point) => ({ ...point })) });

export class ApplicationClipboardService {
  private clipboard: ApplicationClipboard | null = null;
  public constructor(
    private readonly selection: SelectionController,
    private readonly resources: ResourceStore,
    private readonly operations: OperationStore,
    private readonly connections: ConnectionStore,
    private readonly workspaces: WorkspaceStore,
    private readonly project: ProjectSessionService,
    private readonly commands: CommandFactory,
    private readonly resourceIds: ResourceIdProvider,
    private readonly operationIds: OperationIdProvider,
    private readonly connectionIds: ConnectionIdProvider,
    private readonly structure: FactoryStructureStore,
    private readonly wallIds: FactoryStructureIdProvider,
    private readonly areaIds: FactoryStructureIdProvider,
    private readonly aisleIds: FactoryStructureIdProvider,
    private readonly routes: FactoryRouteStore,
    private readonly routeIds: FactoryRouteIdProvider,
    private readonly routeCommands: FactoryRouteCommandFactory,
    private readonly annotations: FactoryAnnotationStore,
    private readonly annotationIds: FactoryAnnotationIdProvider,
  ) {}

  public getClipboard(): ApplicationClipboard | null { return this.clipboard; }
  public canPaste(): boolean { return Boolean(this.clipboard && this.clipboard.sourceWorkspace === this.workspaces.getActive()); }

  public copy(): EditingResult {
    const candidate = this.capture(); if ('message' in candidate) return { ok: false, message: candidate.message, count: 0 };
    this.clipboard = candidate; const count = candidate.resources.length + candidate.operations.length + candidate.connections.length + candidate.walls.length + candidate.areas.length + candidate.aisles.length + candidate.routes.length + candidate.annotations.length;
    return { ok: true, message: `Copied ${count} ${count === 1 ? 'item' : 'items'}`, count };
  }

  public cut(confirmResources: (message: string) => boolean): EditingResult {
    const candidate = this.capture(true); if ('message' in candidate) return { ok: false, message: candidate.message, count: 0 };
    if (candidate.resources.length) {
      const assignments = candidate.resources.reduce((sum, item) => sum + this.operations.getAssignmentCount(item.sourceId), 0);
      if (!confirmResources(`Delete ${candidate.resources.length} resource${candidate.resources.length === 1 ? '' : 's'}? ${assignments} operation assignment${assignments === 1 ? '' : 's'} will be cleared.`)) return { ok: false, message: 'Cut cancelled', count: 0 };
    }
    const prior = this.clipboard; this.clipboard = candidate; const result = this.deleteCaptured(candidate, 'Cut selection');
    if (!result.ok) this.clipboard = prior;
    return result.ok ? { ...result, message: `Cut ${result.count} ${result.count === 1 ? 'item' : 'items'}` } : result;
  }

  public paste(): EditingResult { if (!this.clipboard) return { ok: false, message: 'Clipboard is empty', count: 0 }; if (!this.canPaste()) return { ok: false, message: `Paste is available only in ${this.clipboard.sourceWorkspace === 'processFlow' ? 'Process Flow' : 'Factory Layout'}`, count: 0 }; return this.pasteClipboard(this.clipboard, true, 'Paste selection'); }

  public duplicate(): EditingResult {
    const candidate = this.capture(); if ('message' in candidate) return { ok: false, message: candidate.message, count: 0 };
    return this.pasteClipboard(candidate, false, 'Duplicate selection');
  }

  public deleteSelection(confirmResources: (message: string) => boolean): EditingResult {
    if (this.workspaces.getActive() === 'factoryLayout') { const annotationItems = this.selection.getState().items.filter((item) => item.kind === 'factoryAnnotation'); const otherItems = this.selection.getState().items.filter((item) => item.kind !== 'factoryAnnotation'); if (annotationItems.length && !otherItems.length) { const ids = annotationItems.filter((item) => !this.annotations.getAnnotation(item.id)?.locked).map((item) => item.id); const ok = this.commands.deleteFactoryAnnotations(ids, 'Delete annotation selection'); return { ok, message: ok ? `Deleted ${ids.length} annotations` : 'No unlocked annotations selected', count: ok ? ids.length : 0 }; } }
    if (this.workspaces.getActive() === 'factoryLayout') { const routeItems = this.selection.getState().items.filter((item) => item.kind === 'factoryRoute'); const otherItems = this.selection.getState().items.filter((item) => item.kind !== 'factoryRoute'); const routeIds = routeItems.filter((item) => !this.routes.getRoute(item.id)?.locked).map((item) => item.id); if (routeItems.length && !otherItems.length) { const ok = this.routeCommands.deleteRoutes(routeIds, 'Delete route selection'); return { ok, message: ok ? `Deleted ${routeIds.length} routes` : 'No unlocked routes selected', count: ok ? routeIds.length : 0 }; } }
    const items = this.selection.getState().items; if (this.workspaces.getActive() === 'factoryLayout') { const ids = items.filter((item) => item.kind === 'resource' && !this.resources.getResource(item.id)?.locked).map((item) => item.id); const structures = items.filter((item): item is Extract<SelectionItem, { readonly kind: 'wall' | 'area' | 'aisle' }> => item.kind === 'wall' || item.kind === 'area' || item.kind === 'aisle'); const boundarySelected = items.some((item) => item.kind === 'boundary'); if (ids.length && structures.length) return { ok: false, message: 'Delete resources and factory structure separately to preserve one atomic history action', count: 0 }; if (structures.length) { const ok = this.commands.deleteFactoryStructures(structures, 'Delete structure selection'); return { ok, message: ok ? `Deleted ${structures.length} structure items` : 'No unlocked structure selected', count: ok ? structures.length : 0 }; } if (!ids.length) return { ok: false, message: boundarySelected ? 'Delete the factory boundary separately after confirming its scope' : 'No unlocked Factory Layout items selected', count: 0 }; const assignments = ids.reduce((sum, id) => sum + this.operations.getAssignmentCount(id), 0); if (!confirmResources(`Delete ${ids.length} resource${ids.length === 1 ? '' : 's'}? ${assignments} operation assignment${assignments === 1 ? '' : 's'} will be cleared.`)) return { ok: false, message: 'Delete cancelled', count: 0 }; const result = this.commands.deleteResources(ids, 'Delete selection'); return { ok: result === 'deleted', message: result === 'deleted' ? `Deleted ${ids.length} resources` : 'Resources could not be deleted', count: result === 'deleted' ? ids.length : 0 }; }
    const operationIds = items.filter((item) => item.kind === 'operation' && !this.operations.getOperation(item.id)?.locked).map((item) => item.id); const connectionIds = items.filter((item) => item.kind === 'connection' && !this.connections.getConnection(item.id)?.locked).map((item) => item.id); if (!operationIds.length && !connectionIds.length) return { ok: false, message: 'No unlocked process items selected', count: 0 };
    if (operationIds.length) { const attachedConnections = new Set(operationIds.flatMap((id) => this.connections.getConnectionsForOperation(id).map((connection) => connection.id))); const affectedEntries = operationIds.reduce((count, id) => count + this.project.standardWork.getEntriesForOperation(id).length, 0); if (!confirmResources(`Delete ${operationIds.length} operation${operationIds.length === 1 ? '' : 's'}? ${attachedConnections.size} attached ProcessConnection${attachedConnections.size === 1 ? '' : 's'} and ${affectedEntries} Standard Work entr${affectedEntries === 1 ? 'y' : 'ies'} will also be deleted.`)) return { ok: false, message: 'Delete cancelled', count: 0 }; }
    const result = this.commands.deleteProcess(operationIds, connectionIds, 'Delete selection'); const count = operationIds.length + connectionIds.length; return { ok: result === 'deleted', message: result === 'deleted' ? `Deleted ${count} items` : 'Selection could not be deleted', count: result === 'deleted' ? count : 0 };
  }

  public selectAll(): EditingResult {
    const workspace = this.workspaces.getActive(); const items: SelectionItem[] = workspace === 'factoryLayout'
      ? [...this.resources.getPlacedResources().filter((item) => item.visible).map((item) => ({ kind: 'resource' as const, id: item.id })), ...this.structure.getWalls().filter((item) => item.visible).map((item) => ({ kind: 'wall' as const, id: item.id })), ...this.structure.getAreas().filter((item) => item.visible).map((item) => ({ kind: 'area' as const, id: item.id })), ...this.structure.getAisles().filter((item) => item.visible).map((item) => ({ kind: 'aisle' as const, id: item.id })), ...this.routes.getRoutes().filter((item) => item.visible).map((item) => ({ kind: 'factoryRoute' as const, id: item.id })), ...this.annotations.getAnnotations().filter((item) => item.visible).map((item) => ({ kind: 'factoryAnnotation' as const, id: item.id }))]
      : [...this.operations.getOperations().filter((item) => item.visible).map((item) => ({ kind: 'operation' as const, id: item.id })), ...this.connections.getConnections().filter((item) => item.visible).map((item) => ({ kind: 'connection' as const, id: item.id }))];
    this.selection.set(items, items.at(-1)); return { ok: true, message: `Selected ${items.length} ${items.length === 1 ? 'item' : 'items'}`, count: items.length };
  }

  private capture(skipLocked = false): ApplicationClipboard | { readonly message: string } {
    const workspace = this.workspaces.getActive(); const items = this.selection.getState().items;
    if (workspace === 'standardWork') return { message: 'Use Standard Work commands to edit study entries' };
    const resources = workspace === 'factoryLayout' ? items.filter((item) => item.kind === 'resource').map((item) => this.resources.getResource(item.id)).filter((item): item is PlacedResource => Boolean(item && (!skipLocked || !item.locked))) : [];
    const operations = workspace === 'processFlow' ? items.filter((item) => item.kind === 'operation').map((item) => this.operations.getOperation(item.id)).filter((item): item is OperationInstance => Boolean(item && (!skipLocked || !item.locked))) : [];
    const operationIds = new Set(operations.map((item) => item.id)); const explicitlySelected = new Set(items.filter((item) => item.kind === 'connection').map((item) => item.id));
    const connections = workspace === 'processFlow' ? this.connections.getConnections().filter((item) => (!skipLocked || !item.locked) && operationIds.has(item.sourceOperationId) && operationIds.has(item.targetOperationId) && (explicitlySelected.has(item.id) || operationIds.size > 0)) : [];
    const walls = workspace === 'factoryLayout' ? items.filter((item) => item.kind === 'wall').map((item) => this.structure.getWall(item.id)).filter((item): item is FactoryWall => Boolean(item && (!skipLocked || !item.locked))) : [];
    const areas = workspace === 'factoryLayout' ? items.filter((item) => item.kind === 'area').map((item) => this.structure.getArea(item.id)).filter((item): item is FactoryArea => Boolean(item && (!skipLocked || !item.locked))) : [];
    const aisles = workspace === 'factoryLayout' ? items.filter((item) => item.kind === 'aisle').map((item) => this.structure.getAisle(item.id)).filter((item): item is FactoryAisle => Boolean(item && (!skipLocked || !item.locked))) : [];
    const routes = workspace === 'factoryLayout' ? items.filter((item) => item.kind === 'factoryRoute').map((item) => this.routes.getRoute(item.id)).filter((item): item is FactoryRoute => Boolean(item && (!skipLocked || !item.locked))) : [];
    const annotations = workspace === 'factoryLayout' ? items.filter((item) => item.kind === 'factoryAnnotation').map((item) => this.annotations.getAnnotation(item.id)).filter((item): item is FactoryAnnotation => Boolean(item && (!skipLocked || !item.locked))) : [];
    if (!resources.length && !operations.length && !connections.length && !walls.length && !areas.length && !aisles.length && !routes.length && !annotations.length) return { message: items.some((item) => item.kind === 'boundary') ? 'Factory boundary cannot be copied' : skipLocked ? 'No unlocked items selected' : 'Nothing selected to copy' };
    if (resources.length > CLIPBOARD_LIMITS.resources || operations.length > CLIPBOARD_LIMITS.operations || connections.length > CLIPBOARD_LIMITS.connections || walls.length + areas.length + aisles.length > CLIPBOARD_LIMITS.structures || routes.length > CLIPBOARD_LIMITS.routes || annotations.length > CLIPBOARD_LIMITS.annotations) return { message: 'Selection exceeds the application clipboard safety limit' };
    const boxes = [
      ...resources.map((item) => ({ minX: item.worldX - item.width / 2, minY: item.worldY - item.depth / 2, maxX: item.worldX + item.width / 2, maxY: item.worldY + item.depth / 2 })),
      ...operations.map((item) => ({ minX: item.worldX - item.width / 2, minY: item.worldY - item.height / 2, maxX: item.worldX + item.width / 2, maxY: item.worldY + item.height / 2 })),
      ...[...walls.map(wallRectangle), ...areas.map((item) => rectangleCorners({ x: item.worldX, y: item.worldY }, item.width, item.depth, item.rotationDegrees)), ...aisles.flatMap(aisleCorridorRectangles)].map((polygon) => combineFactoryExtents([polygon])).filter((item): item is NonNullable<ReturnType<typeof combineFactoryExtents>> => Boolean(item)).map((item) => ({ minX: item.minX, minY: item.minY, maxX: item.maxX, maxY: item.maxY })),
      ...routes.map((item) => resolveFactoryRoutePolyline(item, { getResource: (id) => this.resources.getResource(id), getArea: (id) => this.structure.getArea(id) })).filter((points) => points.length).map((points) => ({ minX: Math.min(...points.map((point) => point.x)), minY: Math.min(...points.map((point) => point.y)), maxX: Math.max(...points.map((point) => point.x)), maxY: Math.max(...points.map((point) => point.y)) })),
    ];
    const bounds = boxes.length ? { minX: Math.min(...boxes.map((box) => box.minX)), minY: Math.min(...boxes.map((box) => box.minY)), maxX: Math.max(...boxes.map((box) => box.maxX)), maxY: Math.max(...boxes.map((box) => box.maxY)) } : { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    return { sourceWorkspace: workspace, resources: resources.map((value) => ({ sourceId: value.id, value: cloneResource(value) })), operations: operations.map((value) => ({ sourceId: value.id, value: cloneOperation(value) })), connections: connections.map((value) => ({ sourceId: value.id, value: { ...cloneConnection(value), routePoints: [], routeStatus: 'clear' } })), walls: walls.map((value) => ({ sourceId: value.id, value: cloneWall(value) })), areas: areas.map((value) => ({ sourceId: value.id, value: cloneArea(value) })), aisles: aisles.map((value) => ({ sourceId: value.id, value: cloneAisle(value) })), routes: routes.map((value) => ({ sourceId: value.id, value: cloneFactoryRoute(value) })), annotations: annotations.map((value) => ({ sourceId: value.id, value: cloneFactoryAnnotation(value) })), bounds, copiedAt: Date.now(), pasteCount: 0 };
  }

  private pasteClipboard(source: ApplicationClipboard, updateClipboard: boolean, description: string): EditingResult {
    const pasteCount = source.pasteCount + 1; const delta = PASTE_OFFSET * pasteCount; const snap = this.workspaces.getViewport(source.sourceWorkspace).snapEnabled; const interval = this.project.getSettings().gridBaseInterval; const offset = (value: number): number => { const moved = value + delta; return snap ? Math.round(moved / interval) * interval : moved; };
    if (source.sourceWorkspace === 'factoryLayout') {
      const resourceMap = new Map<string, string>(); const wallMap = new Map<string, string>(); const areaMap = new Map<string, string>(); const aisleMap = new Map<string, string>(); const routeMap = new Map<string, string>(); const existingNames = new Set(this.resources.getPlacedResources().map((item) => item.name));
      const resourceSnapshots = source.resources.map(({ sourceId, value }) => { const id = this.resourceIds.next(); resourceMap.set(sourceId, id); const base = value.name.replace(/\s+copy(?: \d+)?$/i, ''); let index = 1; let name = `${base} copy`; while (existingNames.has(name)) { index += 1; name = `${base} copy ${index}`; } existingNames.add(name); return { ...cloneResource(value), id, name, worldX: offset(value.worldX), worldY: offset(value.worldY), locked: false }; });
      const walls = source.walls.map(({ sourceId, value }) => { const id = this.wallIds.next(); wallMap.set(sourceId, id); return { ...cloneWall(value), id, name: `${value.name} copy`, start: { x: offset(value.start.x), y: offset(value.start.y) }, end: { x: offset(value.end.x), y: offset(value.end.y) }, locked: false }; });
      const areas = source.areas.map(({ sourceId, value }) => { const id = this.areaIds.next(); areaMap.set(sourceId, id); return { ...cloneArea(value), id, name: `${value.name} copy`, worldX: offset(value.worldX), worldY: offset(value.worldY), locked: false }; });
      const aisles = source.aisles.map(({ sourceId, value }) => { const id = this.aisleIds.next(); aisleMap.set(sourceId, id); return { ...cloneAisle(value), id, name: `${value.name} copy`, points: value.points.map((point) => ({ x: offset(point.x), y: offset(point.y) })), locked: false }; });
      const remapEndpoint = (endpoint: FactoryRouteEndpoint): FactoryRouteEndpoint => { if (endpoint.kind === 'free') return { kind: 'free', point: { x: offset(endpoint.point.x), y: offset(endpoint.point.y) } }; if (endpoint.kind === 'resource') return { kind: 'resource', resourceId: resourceMap.get(endpoint.resourceId) ?? endpoint.resourceId, anchorSide: endpoint.anchorSide, anchorOffset: endpoint.anchorOffset }; return { kind: 'area', areaId: areaMap.get(endpoint.areaId) ?? endpoint.areaId, anchorSide: endpoint.anchorSide, anchorOffset: endpoint.anchorOffset }; };
      const routeSnapshots = source.routes.map(({ sourceId, value }) => { const id = this.routeIds.next(); routeMap.set(sourceId, id); return { ...cloneFactoryRoute(value), id, name: `${value.name} copy`, source: remapEndpoint(value.source), target: remapEndpoint(value.target), waypoints: value.waypoints.map((point) => ({ x: offset(point.x), y: offset(point.y) })), locked: false }; });
      const remapAnchor = (anchor: AnnotationAnchor): AnnotationAnchor => {
        if (anchor.kind === 'free') return { kind: 'free', point: { x: offset(anchor.point.x), y: offset(anchor.point.y) } };
        if (anchor.kind === 'resource') return { ...anchor, resourceId: resourceMap.get(anchor.resourceId) ?? anchor.resourceId };
        if (anchor.kind === 'wall') return { ...anchor, wallId: wallMap.get(anchor.wallId) ?? anchor.wallId };
        if (anchor.kind === 'area') return { ...anchor, areaId: areaMap.get(anchor.areaId) ?? anchor.areaId };
        if (anchor.kind === 'aisle') return { ...anchor, aisleId: aisleMap.get(anchor.aisleId) ?? anchor.aisleId };
        if (anchor.kind === 'factoryRoute') return { ...anchor, factoryRouteId: routeMap.get(anchor.factoryRouteId) ?? anchor.factoryRouteId };
        return cloneAnnotationAnchor(anchor);
      };
      const annotationSnapshots = source.annotations.map(({ value }) => { const base = { ...cloneFactoryAnnotation(value), id: this.annotationIds.next(), locked: false }; if (base.annotationType === 'linearDimension') return { ...base, startAnchor: remapAnchor(base.startAnchor), endAnchor: remapAnchor(base.endAnchor) }; if (base.annotationType === 'coordinate') return { ...base, anchor: remapAnchor(base.anchor) }; if (base.annotationType === 'text') return { ...base, worldPosition: { x: offset(base.worldPosition.x), y: offset(base.worldPosition.y) } }; return { ...base, anchor: remapAnchor(base.anchor), elbowPoints: base.elbowPoints.map((point) => ({ x: offset(point.x), y: offset(point.y) })), textPosition: { x: offset(base.textPosition.x), y: offset(base.textPosition.y) } }; });
      const count = resourceSnapshots.length + walls.length + areas.length + aisles.length + routeSnapshots.length + annotationSnapshots.length; if (!count) return { ok: false, message: 'Factory selection is empty', count: 0 };
      if (!this.commands.insertFactorySelection({ resources: resourceSnapshots, walls, areas, aisles, routes: routeSnapshots, annotations: annotationSnapshots }, description)) return { ok: false, message: 'Factory selection could not be pasted', count: 0 }; if (updateClipboard) this.clipboard = { ...source, pasteCount }; return { ok: true, message: `${description.replace(' selection', '')}d ${count} items`, count };
    }
    const maxSequence = Math.max(0, ...this.operations.getOperations().map((item) => item.sequence)); const idMap = new Map<string, string>(); const snapshots = source.operations.map(({ sourceId, value }, index) => { const id = this.operationIds.next(); idMap.set(sourceId, id); return { ...cloneOperation(value), id, sequence: maxSequence + (index + 1) * 10, assignedResourceId: value.assignedResourceId && this.resources.getResource(value.assignedResourceId) ? value.assignedResourceId : null, worldX: offset(value.worldX), worldY: offset(value.worldY), locked: false }; });
    const connectionSnapshots = source.connections.map(({ value }) => ({ ...cloneConnection(value), id: this.connectionIds.next(), sourceOperationId: idMap.get(value.sourceOperationId)!, targetOperationId: idMap.get(value.targetOperationId)!, routePoints: [], locked: false })).filter((item) => item.sourceOperationId && item.targetOperationId);
    if (!this.commands.insertProcess({ operations: snapshots, connections: connectionSnapshots }, description)) return { ok: false, message: 'Process selection could not be pasted', count: 0 }; if (updateClipboard) this.clipboard = { ...source, pasteCount }; const count = snapshots.length + connectionSnapshots.length; return { ok: true, message: `${description.replace(' selection', '')}d ${count} items`, count };
  }

  private deleteCaptured(candidate: ApplicationClipboard, description: string): EditingResult {
    if (candidate.sourceWorkspace === 'factoryLayout' && candidate.annotations.length && !candidate.resources.length && !candidate.walls.length && !candidate.areas.length && !candidate.aisles.length && !candidate.routes.length) { const ok = this.commands.deleteFactoryAnnotations(candidate.annotations.map((item) => item.sourceId), description); return { ok, message: ok ? `Deleted ${candidate.annotations.length} annotations` : 'Factory annotations could not be deleted', count: ok ? candidate.annotations.length : 0 }; }
    if (candidate.sourceWorkspace === 'factoryLayout' && candidate.routes.length && !candidate.resources.length && !candidate.walls.length && !candidate.areas.length && !candidate.aisles.length) { const ok = this.routeCommands.deleteRoutes(candidate.routes.map((item) => item.sourceId), description); return { ok, message: ok ? `Deleted ${candidate.routes.length} routes` : 'Factory routes could not be deleted', count: ok ? candidate.routes.length : 0 }; }
    if (candidate.sourceWorkspace === 'factoryLayout') { if (candidate.walls.length || candidate.areas.length || candidate.aisles.length) { if (candidate.resources.length) return { ok: false, message: 'Cut resources and factory structure separately', count: 0 }; const refs = [...candidate.walls.map((item) => ({ kind: 'wall' as const, id: item.sourceId })), ...candidate.areas.map((item) => ({ kind: 'area' as const, id: item.sourceId })), ...candidate.aisles.map((item) => ({ kind: 'aisle' as const, id: item.sourceId }))]; const ok = this.commands.deleteFactoryStructures(refs, description); return { ok, message: ok ? `Deleted ${refs.length} structure items` : 'Factory structure could not be deleted', count: ok ? refs.length : 0 }; } const result = this.commands.deleteResources(candidate.resources.map((item) => item.sourceId), description); return { ok: result === 'deleted', message: result === 'deleted' ? `Deleted ${candidate.resources.length} resources` : 'Resources could not be deleted', count: result === 'deleted' ? candidate.resources.length : 0 }; }
    const operationIds = candidate.operations.map((item) => item.sourceId); const connectionIds = this.selection.getState().items.filter((item) => item.kind === 'connection').map((item) => item.id); const result = this.commands.deleteProcess(operationIds, connectionIds, description); const count = operationIds.length + candidate.connections.length; return { ok: result === 'deleted', message: result === 'deleted' ? `Deleted ${count} items` : 'Selection could not be deleted', count: result === 'deleted' ? count : 0 };
  }
}
