export class DirtyStateService {
  private dirty = false;
  private readonly listeners = new Set<(dirty: boolean) => void>();
  public isDirty(): boolean { return this.dirty; }
  public markDirty(): void { this.set(true); }
  public markClean(): void { this.set(false); }
  public subscribe(listener: (dirty: boolean) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private set(value: boolean): void { if (this.dirty === value) return; this.dirty = value; for (const listener of this.listeners) listener(value); }
}
