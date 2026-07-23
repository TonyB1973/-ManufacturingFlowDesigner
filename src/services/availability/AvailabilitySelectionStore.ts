export type AvailabilitySelection =
  | { readonly kind: 'none'; readonly id: '' }
  | { readonly kind: 'shift' | 'shiftBreak' | 'availabilityCalendar' | 'calendarException'; readonly id: string };

export class AvailabilitySelectionStore {
  private value: AvailabilitySelection = { kind: 'none', id: '' };
  private readonly listeners = new Set<(value: AvailabilitySelection) => void>();
  public get(): AvailabilitySelection { return { ...this.value }; }
  public select(value: Exclude<AvailabilitySelection, { kind: 'none' }>): void { this.value = { ...value }; this.notify(); }
  public clear(): void { if (this.value.kind === 'none') return; this.value = { kind: 'none', id: '' }; this.notify(); }
  public subscribe(listener: (value: AvailabilitySelection) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private notify(): void { for (const listener of this.listeners) listener(this.get()); }
}
