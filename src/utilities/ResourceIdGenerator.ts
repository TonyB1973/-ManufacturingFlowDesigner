export interface ResourceIdProvider {
  next(): string;
}
export class ResourceIdGenerator implements ResourceIdProvider {
  private sequence: number;

  public constructor(startAt = 1) {
    this.sequence = Math.max(1, Math.trunc(startAt));
  }

  public next(): string {
    const id = `RES-${String(this.sequence).padStart(4, '0')}`;
    this.sequence += 1;
    return id;
  }

  public ensureAfter(ids: readonly string[]): void {
    const maximum = ids.reduce((current, id) => {
      const match = /^RES-(\d+)$/.exec(id);
      return match ? Math.max(current, Number(match[1])) : current;
    }, 0);
    this.sequence = Math.max(this.sequence, maximum + 1);
  }
  public reset(ids: readonly string[] = []): void { this.sequence = 1; this.ensureAfter(ids); }
}
