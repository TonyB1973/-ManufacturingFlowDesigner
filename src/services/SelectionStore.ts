import type { ObjectSelection, SelectionController, SelectionItem, SelectionState } from '../models/selection/Selection';
import type { WorkspaceId } from '../models/workspace/Workspace';

const key = (item: SelectionItem): string => `${item.kind}:${item.id}`;
const workspaceFor = (item: SelectionItem): WorkspaceId => ['resource', 'boundary', 'wall', 'area', 'aisle', 'factoryRoute', 'factoryAnnotation'].includes(item.kind) ? 'factoryLayout' : 'processFlow';

export class SelectionStore implements SelectionController {
  private workspace: WorkspaceId;
  private items: SelectionItem[] = [];
  private primary: SelectionItem | null = null;
  private projectId: string | null = null;
  private validator: (item: SelectionItem) => boolean = () => true;

  public constructor(workspace: WorkspaceId = 'processFlow') { this.workspace = workspace; }
  private readonly listeners = new Set<(selection: ObjectSelection) => void>();

  public getSelection(): ObjectSelection { return this.projectId ? { kind: 'project', id: this.projectId } : this.primary ?? { kind: 'none' }; }
  public getState(): SelectionState { return { workspace: this.workspace, items: [...this.items], primary: this.primary ? { ...this.primary } : null, projectId: this.projectId }; }
  public setValidator(validator: (item: SelectionItem) => boolean): void { this.validator = validator; this.prune(); }

  public select(selection: Exclude<ObjectSelection, { readonly kind: 'none' }>): void {
    if (selection.kind === 'project') { this.items = []; this.primary = null; this.projectId = selection.id; this.notify(); return; }
    this.set([selection], selection);
  }

  public set(items: readonly SelectionItem[], primary: SelectionItem | null = null): void {
    const unique = new Map<string, SelectionItem>();
    for (const item of items) if (workspaceFor(item) === this.workspace && this.validator(item)) unique.set(key(item), { ...item });
    this.items = [...unique.values()]; this.projectId = null;
    this.primary = primary && unique.has(key(primary)) ? unique.get(key(primary))! : this.items.at(-1) ?? null;
    this.notify();
  }

  public add(item: SelectionItem): void { if (workspaceFor(item) !== this.workspace || !this.validator(item)) return; const existing = this.items.find((candidate) => key(candidate) === key(item)); if (!existing) this.items.push({ ...item }); this.primary = existing ?? this.items.at(-1)!; this.projectId = null; this.notify(); }
  public toggle(item: SelectionItem): void { if (this.contains(item)) this.remove(item); else this.add(item); }
  public remove(item: SelectionItem): void { const before = this.items.length; this.items = this.items.filter((candidate) => key(candidate) !== key(item)); if (before === this.items.length) return; if (this.primary && key(this.primary) === key(item)) this.primary = this.items.at(-1) ?? null; this.notify(); }
  public contains(item: SelectionItem): boolean { return this.items.some((candidate) => key(candidate) === key(item)); }
  public setWorkspace(workspace: WorkspaceId): void { if (workspace === this.workspace) return; this.workspace = workspace; this.items = []; this.primary = null; this.projectId = null; this.notify(); }

  public clear(): void {
    if (!this.items.length && !this.projectId) return;
    this.items = []; this.primary = null; this.projectId = null;
    this.notify();
  }

  public subscribe(listener: (selection: ObjectSelection) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const selection = this.getSelection(); for (const listener of this.listeners) listener(selection);
  }

  private prune(): void { const valid = this.items.filter((item) => this.validator(item)); if (valid.length === this.items.length) return; this.items = valid; if (this.primary && !valid.some((item) => key(item) === key(this.primary!))) this.primary = valid.at(-1) ?? null; this.notify(); }
}
