export class ScenarioSelectionStore {
  private selectedId: string | null = null;
  private readonly listeners = new Set<(id: string | null) => void>();
  public get(): string | null { return this.selectedId; }
  public select(id: string | null): void { if (id === this.selectedId) return; this.selectedId = id; for (const listener of this.listeners) listener(id); }
  public subscribe(listener: (id: string | null) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
}
