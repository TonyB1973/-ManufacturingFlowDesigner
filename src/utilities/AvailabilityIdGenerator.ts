class PrefixedAvailabilityIdGenerator {
  private nextValue = 1;
  public constructor(private readonly prefix: 'SHF' | 'SHB' | 'CAL' | 'CEX') {}
  public next(): string { return `${this.prefix}-${String(this.nextValue++).padStart(4, '0')}`; }
  public ensureAfter(ids: readonly string[]): void {
    const maximum = ids.reduce((value, id) => {
      const match = new RegExp(`^${this.prefix}-(\\d+)$`).exec(id);
      return match ? Math.max(value, Number(match[1])) : value;
    }, 0);
    this.nextValue = Math.max(this.nextValue, maximum + 1);
  }
}

export class ShiftIdGenerator extends PrefixedAvailabilityIdGenerator { public constructor() { super('SHF'); } }
export class ShiftBreakIdGenerator extends PrefixedAvailabilityIdGenerator { public constructor() { super('SHB'); } }
export class AvailabilityCalendarIdGenerator extends PrefixedAvailabilityIdGenerator { public constructor() { super('CAL'); } }
export class CalendarExceptionIdGenerator extends PrefixedAvailabilityIdGenerator { public constructor() { super('CEX'); } }
