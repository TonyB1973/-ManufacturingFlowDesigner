import type { ProcessConnection } from '../../models/connections/ProcessConnection';
import type { OperationInstance } from '../../models/operations/OperationInstance';
import type { PlacedResource } from '../../models/resources/PlacedResource';
import type { SelectionController, SelectionItem } from '../../models/selection/Selection';
import type { WorkspaceId } from '../../models/workspace/Workspace';
import type { ConnectionStore } from '../ConnectionStore';
import type { OperationStore } from '../OperationStore';
import type { ProjectSessionService } from '../project/ProjectSessionService';
import type { ResourceStore } from '../ResourceStore';
import type { WorkspaceStore } from '../WorkspaceStore';
import type { CommandFactory } from '../history/CommandFactory';
import type { ConnectionIdProvider } from '../../utilities/ConnectionIdGenerator';
import type { OperationIdProvider } from '../../utilities/OperationIdGenerator';
import type { ResourceIdProvider } from '../../utilities/ResourceIdGenerator';

export const CLIPBOARD_LIMITS = { resources: 5_000, operations: 10_000, connections: 20_000 } as const;
const PASTE_OFFSET = 20;

interface ClipboardResource { readonly sourceId: string; readonly value: PlacedResource; }
interface ClipboardOperation { readonly sourceId: string; readonly value: OperationInstance; }
interface ClipboardConnection { readonly sourceId: string; readonly value: ProcessConnection; }
export interface ApplicationClipboard {
  readonly sourceWorkspace: WorkspaceId;
  readonly resources: readonly ClipboardResource[];
  readonly operations: readonly ClipboardOperation[];
  readonly connections: readonly ClipboardConnection[];
  readonly bounds: { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number };
  readonly copiedAt: number;
  readonly pasteCount: number;
}

export interface EditingResult { readonly ok: boolean; readonly message: string; readonly count: number; }

const cloneResource = (value: PlacedResource): PlacedResource => ({ ...value, selected: false });
const cloneOperation = (value: OperationInstance): OperationInstance => ({ ...value, selected: false });
const cloneConnection = (value: ProcessConnection): ProcessConnection => ({ ...value, sourceAnchor: { ...value.sourceAnchor }, targetAnchor: { ...value.targetAnchor }, routePoints: value.routePoints.map((point) => ({ ...point })), selected: false });

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
  ) {}

  public getClipboard(): ApplicationClipboard | null { return this.clipboard; }
  public canPaste(): boolean { return Boolean(this.clipboard && this.clipboard.sourceWorkspace === this.workspaces.getActive()); }

  public copy(): EditingResult {
    const candidate = this.capture(); if ('message' in candidate) return { ok: false, message: candidate.message, count: 0 };
    this.clipboard = candidate; const count = candidate.resources.length + candidate.operations.length + candidate.connections.length;
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
    const items = this.selection.getState().items; if (this.workspaces.getActive() === 'factoryLayout') { const ids = items.filter((item) => item.kind === 'resource' && !this.resources.getResource(item.id)?.locked).map((item) => item.id); if (!ids.length) return { ok: false, message: 'No unlocked resources selected', count: 0 }; const assignments = ids.reduce((sum, id) => sum + this.operations.getAssignmentCount(id), 0); if (!confirmResources(`Delete ${ids.length} resource${ids.length === 1 ? '' : 's'}? ${assignments} operation assignment${assignments === 1 ? '' : 's'} will be cleared.`)) return { ok: false, message: 'Delete cancelled', count: 0 }; const result = this.commands.deleteResources(ids, 'Delete selection'); return { ok: result === 'deleted', message: result === 'deleted' ? `Deleted ${ids.length} resources` : 'Resources could not be deleted', count: result === 'deleted' ? ids.length : 0 }; }
    const operationIds = items.filter((item) => item.kind === 'operation' && !this.operations.getOperation(item.id)?.locked).map((item) => item.id); const connectionIds = items.filter((item) => item.kind === 'connection' && !this.connections.getConnection(item.id)?.locked).map((item) => item.id); if (!operationIds.length && !connectionIds.length) return { ok: false, message: 'No unlocked process items selected', count: 0 }; const result = this.commands.deleteProcess(operationIds, connectionIds, 'Delete selection'); const count = operationIds.length + connectionIds.length; return { ok: result === 'deleted', message: result === 'deleted' ? `Deleted ${count} items` : 'Selection could not be deleted', count: result === 'deleted' ? count : 0 };
  }

  public selectAll(): EditingResult {
    const workspace = this.workspaces.getActive(); const items: SelectionItem[] = workspace === 'factoryLayout'
      ? this.resources.getPlacedResources().filter((item) => item.visible).map((item) => ({ kind: 'resource', id: item.id }))
      : [...this.operations.getOperations().filter((item) => item.visible).map((item) => ({ kind: 'operation' as const, id: item.id })), ...this.connections.getConnections().filter((item) => item.visible).map((item) => ({ kind: 'connection' as const, id: item.id }))];
    this.selection.set(items, items.at(-1)); return { ok: true, message: `Selected ${items.length} ${items.length === 1 ? 'item' : 'items'}`, count: items.length };
  }

  private capture(skipLocked = false): ApplicationClipboard | { readonly message: string } {
    const workspace = this.workspaces.getActive(); const items = this.selection.getState().items;
    const resources = workspace === 'factoryLayout' ? items.filter((item) => item.kind === 'resource').map((item) => this.resources.getResource(item.id)).filter((item): item is PlacedResource => Boolean(item && (!skipLocked || !item.locked))) : [];
    const operations = workspace === 'processFlow' ? items.filter((item) => item.kind === 'operation').map((item) => this.operations.getOperation(item.id)).filter((item): item is OperationInstance => Boolean(item && (!skipLocked || !item.locked))) : [];
    const operationIds = new Set(operations.map((item) => item.id)); const explicitlySelected = new Set(items.filter((item) => item.kind === 'connection').map((item) => item.id));
    const connections = workspace === 'processFlow' ? this.connections.getConnections().filter((item) => (!skipLocked || !item.locked) && operationIds.has(item.sourceOperationId) && operationIds.has(item.targetOperationId) && (explicitlySelected.has(item.id) || operationIds.size > 0)) : [];
    if (!resources.length && !operations.length && !connections.length) return { message: skipLocked ? 'No unlocked items selected' : 'Nothing selected to copy' };
    if (resources.length > CLIPBOARD_LIMITS.resources || operations.length > CLIPBOARD_LIMITS.operations || connections.length > CLIPBOARD_LIMITS.connections) return { message: 'Selection exceeds the application clipboard safety limit' };
    const boxes = [...resources, ...operations].map((item) => ({ minX: item.worldX - item.width / 2, minY: item.worldY - item.height / 2, maxX: item.worldX + item.width / 2, maxY: item.worldY + item.height / 2 }));
    const bounds = boxes.length ? { minX: Math.min(...boxes.map((box) => box.minX)), minY: Math.min(...boxes.map((box) => box.minY)), maxX: Math.max(...boxes.map((box) => box.maxX)), maxY: Math.max(...boxes.map((box) => box.maxY)) } : { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    return { sourceWorkspace: workspace, resources: resources.map((value) => ({ sourceId: value.id, value: cloneResource(value) })), operations: operations.map((value) => ({ sourceId: value.id, value: cloneOperation(value) })), connections: connections.map((value) => ({ sourceId: value.id, value: { ...cloneConnection(value), routePoints: [], routeStatus: 'clear' } })), bounds, copiedAt: Date.now(), pasteCount: 0 };
  }

  private pasteClipboard(source: ApplicationClipboard, updateClipboard: boolean, description: string): EditingResult {
    const pasteCount = source.pasteCount + 1; const delta = PASTE_OFFSET * pasteCount; const snap = this.workspaces.getViewport(source.sourceWorkspace).snapEnabled; const interval = this.project.getSettings().gridBaseInterval; const offset = (value: number): number => { const moved = value + delta; return snap ? Math.round(moved / interval) * interval : moved; };
    if (source.sourceWorkspace === 'factoryLayout') {
      const existingNames = new Set(this.resources.getPlacedResources().map((item) => item.name)); const snapshots = source.resources.map(({ value }) => { const base = value.name.replace(/\s+copy(?: \d+)?$/i, ''); let index = 1; let name = `${base} copy`; while (existingNames.has(name)) { index += 1; name = `${base} copy ${index}`; } existingNames.add(name); return { ...cloneResource(value), id: this.resourceIds.next(), name, worldX: offset(value.worldX), worldY: offset(value.worldY), locked: false }; });
      if (!this.commands.insertResources(snapshots, description)) return { ok: false, message: 'Resources could not be pasted', count: 0 }; if (updateClipboard) this.clipboard = { ...source, pasteCount }; return { ok: true, message: `${description.replace(' selection', '')}d ${snapshots.length} resources`, count: snapshots.length };
    }
    const maxSequence = Math.max(0, ...this.operations.getOperations().map((item) => item.sequence)); const idMap = new Map<string, string>(); const snapshots = source.operations.map(({ sourceId, value }, index) => { const id = this.operationIds.next(); idMap.set(sourceId, id); return { ...cloneOperation(value), id, sequence: maxSequence + (index + 1) * 10, assignedResourceId: value.assignedResourceId && this.resources.getResource(value.assignedResourceId) ? value.assignedResourceId : null, worldX: offset(value.worldX), worldY: offset(value.worldY), locked: false }; });
    const connectionSnapshots = source.connections.map(({ value }) => ({ ...cloneConnection(value), id: this.connectionIds.next(), sourceOperationId: idMap.get(value.sourceOperationId)!, targetOperationId: idMap.get(value.targetOperationId)!, routePoints: [], locked: false })).filter((item) => item.sourceOperationId && item.targetOperationId);
    if (!this.commands.insertProcess({ operations: snapshots, connections: connectionSnapshots }, description)) return { ok: false, message: 'Process selection could not be pasted', count: 0 }; if (updateClipboard) this.clipboard = { ...source, pasteCount }; const count = snapshots.length + connectionSnapshots.length; return { ok: true, message: `${description.replace(' selection', '')}d ${count} items`, count };
  }

  private deleteCaptured(candidate: ApplicationClipboard, description: string): EditingResult {
    if (candidate.sourceWorkspace === 'factoryLayout') { const result = this.commands.deleteResources(candidate.resources.map((item) => item.sourceId), description); return { ok: result === 'deleted', message: result === 'deleted' ? `Deleted ${candidate.resources.length} resources` : 'Resources could not be deleted', count: result === 'deleted' ? candidate.resources.length : 0 }; }
    const operationIds = candidate.operations.map((item) => item.sourceId); const connectionIds = this.selection.getState().items.filter((item) => item.kind === 'connection').map((item) => item.id); const result = this.commands.deleteProcess(operationIds, connectionIds, description); const count = operationIds.length + candidate.connections.length; return { ok: result === 'deleted', message: result === 'deleted' ? `Deleted ${count} items` : 'Selection could not be deleted', count: result === 'deleted' ? count : 0 };
  }
}
