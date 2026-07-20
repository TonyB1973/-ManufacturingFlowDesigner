export interface ConnectionIdProvider { next(): string; }

export class ConnectionIdGenerator implements ConnectionIdProvider {
  private sequence = 0;
  public next(): string { this.sequence += 1; return `CON-${String(this.sequence).padStart(4, '0')}`; }
}
