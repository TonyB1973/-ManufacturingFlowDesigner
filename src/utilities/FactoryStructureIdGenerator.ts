export interface FactoryStructureIdProvider {
  next(): string;
  ensureAfter(ids: readonly string[]): void;
  reset?(ids?: readonly string[]): void;
}

export class FactoryStructureIdGenerator implements FactoryStructureIdProvider {
  private sequence = 0;

  public constructor(private readonly prefix: 'BND' | 'WALL' | 'AREA' | 'AISLE') {}

  public next(): string { return `${this.prefix}-${String(++this.sequence).padStart(4, '0')}`; }

  public ensureAfter(ids: readonly string[]): void {
    const pattern = new RegExp(`^${this.prefix}-(\\d+)$`);
    for (const id of ids) {
      const match = pattern.exec(id);
      if (match) this.sequence = Math.max(this.sequence, Number(match[1]));
    }
  }
  public reset(ids: readonly string[] = []): void { this.sequence = 0; this.ensureAfter(ids); }
}
