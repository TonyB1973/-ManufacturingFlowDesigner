export type ObjectSelection =
  | { readonly kind: 'none' }
  | { readonly kind: 'project'; readonly id: string }
  | { readonly kind: 'resource'; readonly id: string }
  | { readonly kind: 'operation'; readonly id: string }
  | { readonly kind: 'connection'; readonly id: string };

export interface SelectionController {
  getSelection(): ObjectSelection;
  select(selection: Exclude<ObjectSelection, { readonly kind: 'none' }>): void;
  clear(): void;
  subscribe(listener: (selection: ObjectSelection) => void): () => void;
}
