export interface FactoryRouteIdProvider {
  next(): string;
  ensureAfter(ids: readonly string[]): void;
  reset?(ids?: readonly string[]): void;
}

export class FactoryRouteIdGenerator implements FactoryRouteIdProvider {
  private nextValue = 1;

  public next(): string { return `FRT-${String(this.nextValue++).padStart(4, '0')}`; }

  public ensureAfter(ids: readonly string[]): void {
    let maximum = 0;
    for (const id of ids) {
      const match = /^FRT-(\d+)$/.exec(id);
      if (match) maximum = Math.max(maximum, Number(match[1]));
    }
    this.nextValue = Math.max(this.nextValue, maximum + 1);
  }
  public reset(ids: readonly string[] = []): void { this.nextValue = 1; this.ensureAfter(ids); }
}
