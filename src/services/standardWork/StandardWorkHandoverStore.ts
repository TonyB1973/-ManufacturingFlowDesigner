import { STANDARD_WORK_HANDOVER_LIMITS, cloneStandardWorkHandover, isValidStandardWorkHandover, type StandardWorkHandover, type StandardWorkHandoverPatch } from '../../models/standardWork/StandardWorkHandover';
import type { StandardWorkEntry } from '../../models/standardWork/StandardWork';
import type { StableIdProvider } from '../../utilities/StandardWorkIdGenerator';
import { validateHandoverGraph } from './StandardWorkDependencyGraph';

export type StandardWorkHandoverChange = { readonly kind: 'handover' | 'reset'; readonly studyId?: string; readonly handoverId?: string };

export class StandardWorkHandoverStore {
  private readonly values = new Map<string, StandardWorkHandover>(); private readonly listeners = new Set<(change: StandardWorkHandoverChange) => void>();
  public constructor(private readonly ids: StableIdProvider, private readonly getEntry: (id: string) => StandardWorkEntry | undefined, private readonly getEntries: (studyId: string) => readonly StandardWorkEntry[]) {}
  public nextId(): string { return this.ids.next(); }
  public getHandover(id: string): StandardWorkHandover | undefined { return this.values.get(id); }
  public getHandovers(studyId?: string): readonly StandardWorkHandover[] { return [...this.values.values()].filter((item) => studyId === undefined || item.studyId === studyId).sort((a, b) => a.id.localeCompare(b.id)); }
  public getAttached(entryId: string): readonly StandardWorkHandover[] { return this.getHandovers().filter((item) => item.fromEntryId === entryId || item.toEntryId === entryId); }
  public getCount(studyId?: string): number { return studyId === undefined ? this.values.size : this.getHandovers(studyId).length; }
  public restoreHandover(value: StandardWorkHandover): boolean { const item = cloneStandardWorkHandover(value); const source = this.getEntry(item.fromEntryId); const target = this.getEntry(item.toEntryId); const candidate = [...this.getHandovers(item.studyId), item]; if (this.values.has(item.id) || this.values.size >= STANDARD_WORK_HANDOVER_LIMITS.total || this.getCount(item.studyId) >= STANDARD_WORK_HANDOVER_LIMITS.perStudy || !source || !target || source.studyId !== item.studyId || target.studyId !== item.studyId || !isValidStandardWorkHandover(item) || validateHandoverGraph(this.getEntries(item.studyId), candidate).length) return false; this.values.set(item.id, item); this.notify({ kind: 'handover', studyId: item.studyId, handoverId: item.id }); return true; }
  public replaceHandover(value: StandardWorkHandover): boolean { const item = cloneStandardWorkHandover(value); const source = this.getEntry(item.fromEntryId); const target = this.getEntry(item.toEntryId); const candidate = this.getHandovers(item.studyId).filter((handover) => handover.id !== item.id).concat(item); if (!this.values.has(item.id) || !source || !target || source.studyId !== item.studyId || target.studyId !== item.studyId || !isValidStandardWorkHandover(item) || validateHandoverGraph(this.getEntries(item.studyId), candidate).length) return false; this.values.set(item.id, item); this.notify({ kind: 'handover', studyId: item.studyId, handoverId: item.id }); return true; }
  public updateHandover(id: string, patch: StandardWorkHandoverPatch): boolean { const item = this.values.get(id); return Boolean(item && this.replaceHandover({ ...item!, ...patch })); }
  public deleteHandover(id: string): boolean { const item = this.values.get(id); if (!item) return false; this.values.delete(id); this.notify({ kind: 'handover', studyId: item.studyId, handoverId: id }); return true; }
  public deleteAttached(entryId: string): void { for (const item of this.getAttached(entryId)) this.values.delete(item.id); this.notify({ kind: 'handover' }); }
  public deleteStudy(studyId: string): void { for (const item of this.getHandovers(studyId)) this.values.delete(item.id); this.notify({ kind: 'handover', studyId }); }
  public replaceAll(values: readonly StandardWorkHandover[], notify = true): void { this.values.clear(); values.forEach((item) => this.values.set(item.id, cloneStandardWorkHandover(item))); const ids = values.map((item) => item.id); if (this.ids.reset) this.ids.reset(ids); else this.ids.ensureAfter(ids); if (notify) this.publishReset(); }
  public publishReset(): void { this.notify({ kind: 'reset' }); }
  public subscribe(listener: (change: StandardWorkHandoverChange) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private notify(change: StandardWorkHandoverChange): void { for (const listener of this.listeners) listener(change); }
}
