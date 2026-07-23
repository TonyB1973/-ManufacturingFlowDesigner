export interface OperationIdProvider { next(): string; }

export class OperationIdGenerator implements OperationIdProvider {
  private sequence = 0;

  public next(): string {
    this.sequence += 1;
    return `operation-${String(this.sequence).padStart(4, '0')}`;
  }

  public ensureAfter(ids: readonly string[]): void {
    const maximum = ids.reduce((current, id) => {
      const match = /^operation-(\d+)$/.exec(id);
      return match ? Math.max(current, Number(match[1])) : current;
    }, 0);
    this.sequence = Math.max(this.sequence, maximum);
  }
  public reset(ids: readonly string[] = []): void { this.sequence = 0; this.ensureAfter(ids); }
}
