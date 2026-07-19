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
}
