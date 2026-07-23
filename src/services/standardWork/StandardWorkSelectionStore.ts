export type StandardWorkSelectionKind = 'standardWorkStudy' | 'standardWorkPlanning' | 'standardWorkOperator' | 'standardWorkEntry' | 'standardWorkHandover';
export type StandardWorkSelection = { readonly kind: 'none'; readonly id?: undefined } | { readonly kind: StandardWorkSelectionKind; readonly id: string };

export class StandardWorkSelectionStore {
  private selection: StandardWorkSelection = { kind: 'none' };
  private readonly listeners = new Set<(selection: StandardWorkSelection) => void>();
  public get(): StandardWorkSelection { return { ...this.selection }; }
  public select(selection: Exclude<StandardWorkSelection, { kind: 'none' }>): void { if (this.selection.kind === selection.kind && this.selection.id === selection.id) return; this.selection = { ...selection }; this.notify(); }
  public clear(): void { if (this.selection.kind === 'none') return; this.selection = { kind: 'none' }; this.notify(); }
  public subscribe(listener: (selection: StandardWorkSelection) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private notify(): void { for (const listener of this.listeners) listener(this.get()); }
}
