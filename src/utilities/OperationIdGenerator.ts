export interface OperationIdProvider { next(): string; }

export class OperationIdGenerator implements OperationIdProvider {
  private sequence = 0;

  public next(): string {
    this.sequence += 1;
    return `operation-${String(this.sequence).padStart(4, '0')}`;
  }
}
