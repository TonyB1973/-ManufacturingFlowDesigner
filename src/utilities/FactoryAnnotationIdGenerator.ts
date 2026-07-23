export interface FactoryAnnotationIdProvider { next(): string; ensureAfter(ids: readonly string[]): void; reset?(ids?: readonly string[]): void; }

export class FactoryAnnotationIdGenerator implements FactoryAnnotationIdProvider {
  private nextValue = 1;
  public next(): string { return `ANN-${String(this.nextValue++).padStart(4, '0')}`; }
  public ensureAfter(ids: readonly string[]): void {
    for (const id of ids) { const match = /^ANN-(\d+)$/.exec(id); if (match) this.nextValue = Math.max(this.nextValue, Number(match[1]) + 1); }
  }
  public reset(ids: readonly string[] = []): void { this.nextValue = 1; this.ensureAfter(ids); }
}
