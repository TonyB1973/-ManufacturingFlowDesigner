import type { WorkspaceId } from '../workspace/Workspace';

export type SelectionItem =
  | { readonly kind: 'resource'; readonly id: string }
  | { readonly kind: 'boundary'; readonly id: string }
  | { readonly kind: 'wall'; readonly id: string }
  | { readonly kind: 'area'; readonly id: string }
  | { readonly kind: 'aisle'; readonly id: string }
  | { readonly kind: 'factoryRoute'; readonly id: string }
  | { readonly kind: 'factoryAnnotation'; readonly id: string }
  | { readonly kind: 'operation'; readonly id: string }
  | { readonly kind: 'connection'; readonly id: string };

export type ObjectSelection =
  | { readonly kind: 'none' }
  | { readonly kind: 'project'; readonly id: string }
  | SelectionItem;

export interface SelectionState {
  readonly workspace: WorkspaceId;
  readonly items: readonly SelectionItem[];
  readonly primary: SelectionItem | null;
  readonly projectId: string | null;
}

export interface SelectionController {
  getSelection(): ObjectSelection;
  getState(): SelectionState;
  select(selection: Exclude<ObjectSelection, { readonly kind: 'none' }>): void;
  set(items: readonly SelectionItem[], primary?: SelectionItem | null): void;
  add(item: SelectionItem): void;
  toggle(item: SelectionItem): void;
  remove(item: SelectionItem): void;
  contains(item: SelectionItem): boolean;
  setWorkspace(workspace: WorkspaceId): void;
  clear(): void;
  subscribe(listener: (selection: ObjectSelection) => void): () => void;
}
