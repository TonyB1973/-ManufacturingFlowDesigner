export interface StableIdProvider { next(): string; ensureAfter(ids: readonly string[]): void; }

class PrefixIdGenerator implements StableIdProvider {
  private nextValue = 1;
  public constructor(private readonly prefix: 'SW' | 'SWE' | 'SWO' | 'SWH') {}
  public next(): string { return `${this.prefix}-${String(this.nextValue++).padStart(4, '0')}`; }
  public ensureAfter(ids: readonly string[]): void { const expression = new RegExp(`^${this.prefix}-(\\d+)$`); for (const id of ids) { const match = expression.exec(id); if (match) this.nextValue = Math.max(this.nextValue, Number(match[1]) + 1); } }
}

export class StandardWorkStudyIdGenerator extends PrefixIdGenerator { public constructor() { super('SW'); } }
export class StandardWorkEntryIdGenerator extends PrefixIdGenerator { public constructor() { super('SWE'); } }
export class StandardWorkOperatorIdGenerator extends PrefixIdGenerator { public constructor() { super('SWO'); } }
export class StandardWorkHandoverIdGenerator extends PrefixIdGenerator { public constructor() { super('SWH'); } }
