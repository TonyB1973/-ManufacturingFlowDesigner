export class ScenarioIdGenerator {
  private nextValue = 1;
  public next(): string { return `SCN-${String(this.nextValue++).padStart(4, '0')}`; }
  public ensureAfter(ids: Iterable<string>): void {
    for (const id of ids) {
      const match = /^SCN-(\d+)$/.exec(id);
      if (match) this.nextValue = Math.max(this.nextValue, Number(match[1]) + 1);
    }
  }
  public reset(ids: Iterable<string> = []): void { this.nextValue = 1; this.ensureAfter(ids); }
}
