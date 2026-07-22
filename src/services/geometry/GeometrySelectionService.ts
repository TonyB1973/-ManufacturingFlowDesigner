import type { SelectionController } from '../../models/selection/Selection';
import type { WorkspaceId } from '../../models/workspace/Workspace';
import type { OperationStore } from '../OperationStore';
import type { ResourceStore } from '../ResourceStore';
import type { WorkspaceStore } from '../WorkspaceStore';
import type { GeometrySnapshot } from './GeometryBounds';

export interface GeometrySelection { readonly workspace: WorkspaceId; readonly nodes: readonly GeometrySnapshot[]; readonly unlocked: readonly GeometrySnapshot[]; readonly primary: GeometrySnapshot | null; readonly lockedCount: number; readonly ignoredCount: number; }

export class GeometrySelectionService {
  public constructor(private readonly selection: SelectionController, private readonly workspaces: WorkspaceStore, private readonly operations: OperationStore, private readonly resources: ResourceStore) {}
  public getSelection(): GeometrySelection {
    const workspace = this.workspaces.getActive(); const state = this.selection.getState(); const nodes: GeometrySnapshot[] = [];
    for (const item of state.items) { if (workspace === 'processFlow' && item.kind === 'operation') { const node = this.operations.getOperation(item.id); if (node?.visible) nodes.push({ id: node.id, kind: 'operation', ref: item, x: node.worldX, y: node.worldY, width: node.width, height: node.height, locked: node.locked, visible: node.visible }); } else if (workspace === 'factoryLayout' && item.kind === 'resource') { const node = this.resources.getResource(item.id); if (node?.visible) nodes.push({ id: node.id, kind: 'resource', ref: item, x: node.worldX, y: node.worldY, width: node.width, height: node.depth, locked: node.locked, visible: node.visible }); } }
    const primary = state.primary ? nodes.find((node) => node.ref.kind === state.primary!.kind && node.id === state.primary!.id) ?? nodes.at(-1) ?? null : nodes.at(-1) ?? null; return { workspace, nodes, unlocked: nodes.filter((node) => !node.locked), primary, lockedCount: nodes.filter((node) => node.locked).length, ignoredCount: state.items.length - nodes.length };
  }
}
