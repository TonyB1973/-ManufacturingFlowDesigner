export class ProjectIdGenerator {
  private sequence = 1;

  public next(): string {
    const id = `PRJ-${String(this.sequence).padStart(4, '0')}`;
    this.sequence += 1;
    return id;
  }

  public ensureAfter(ids: readonly string[]): void {
    const maximum = ids.reduce((current, id) => {
      const match = /^PRJ-(\d+)$/.exec(id);
      return match ? Math.max(current, Number(match[1])) : current;
    }, 0);
    this.sequence = Math.max(this.sequence, maximum + 1);
  }
}
