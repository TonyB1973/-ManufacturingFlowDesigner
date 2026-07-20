import type { WorkspaceId, WorkspaceViewportState } from '../models/workspace/Workspace';

export type WorkspaceListener = (workspace: WorkspaceId) => void;
const initialViewport = (): WorkspaceViewportState => ({ panX: 0, panY: 0, zoom: 1, gridVisible: true, originVisible: true, snapEnabled: true });

export class WorkspaceStore {
  private active: WorkspaceId = 'processFlow';
  private readonly viewports: Record<WorkspaceId, WorkspaceViewportState> = { processFlow: initialViewport(), factoryLayout: initialViewport() };
  private readonly listeners = new Set<WorkspaceListener>();
  public getActive(): WorkspaceId { return this.active; }
  public activate(workspace: WorkspaceId): void { if (workspace === this.active) return; this.active = workspace; for (const listener of this.listeners) listener(workspace); }
  public getViewport(workspace: WorkspaceId): WorkspaceViewportState { return { ...this.viewports[workspace] }; }
  public updateViewport(workspace: WorkspaceId, patch: Partial<WorkspaceViewportState>): void { Object.assign(this.viewports[workspace], patch); }
  public subscribe(listener: WorkspaceListener): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
}
