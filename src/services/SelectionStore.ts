import type { ObjectSelection, SelectionController } from '../models/selection/Selection';

export class SelectionStore implements SelectionController {
  private selection: ObjectSelection = { kind: 'none' };
  private readonly listeners = new Set<(selection: ObjectSelection) => void>();

  public getSelection(): ObjectSelection {
    return this.selection;
  }

  public select(selection: Exclude<ObjectSelection, { readonly kind: 'none' }>): void {
    if (this.selection.kind === selection.kind && this.selection.id === selection.id) return;
    this.selection = selection;
    this.notify();
  }

  public clear(): void {
    if (this.selection.kind === 'none') return;
    this.selection = { kind: 'none' };
    this.notify();
  }

  public subscribe(listener: (selection: ObjectSelection) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener(this.selection);
  }
}
