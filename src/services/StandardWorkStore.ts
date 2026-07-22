import {
  STANDARD_WORK_LIMITS, cloneStandardWorkEntry, cloneStandardWorkStudy, isValidStandardWorkEntry, isValidStandardWorkStudy,
  type StandardWorkEntry, type StandardWorkEntryPatch, type StandardWorkStudy, type StandardWorkStudyPatch,
} from '../models/standardWork/StandardWork';
import type { StableIdProvider } from '../utilities/StandardWorkIdGenerator';

export type StandardWorkChange = { readonly kind: 'study' | 'entry' | 'reset'; readonly studyId?: string; readonly entryId?: string; readonly operationId?: string };
export type StandardWorkListener = (change: StandardWorkChange) => void;

export class StandardWorkStore {
  private readonly studies = new Map<string, StandardWorkStudy>();
  private readonly entries = new Map<string, StandardWorkEntry>();
  private readonly listeners = new Set<StandardWorkListener>();
  public constructor(private readonly studyIds: StableIdProvider, private readonly entryIds: StableIdProvider, private readonly hasOperation: (id: string) => boolean) {}

  public nextStudyId(): string { return this.studyIds.next(); }
  public nextEntryId(): string { return this.entryIds.next(); }
  public getStudies(): readonly StandardWorkStudy[] { return [...this.studies.values()]; }
  public getStudy(id: string): StandardWorkStudy | undefined { return this.studies.get(id); }
  public getEntry(id: string): StandardWorkEntry | undefined { return this.entries.get(id); }
  public getEntries(studyId?: string): readonly StandardWorkEntry[] { const values = [...this.entries.values()].filter((entry) => studyId === undefined || entry.studyId === studyId); return values.sort((left, right) => left.order - right.order || left.id.localeCompare(right.id)); }
  public getEntriesForOperation(operationId: string): readonly StandardWorkEntry[] { return this.getEntries().filter((entry) => entry.operationId === operationId); }
  public findEntry(studyId: string, operationId: string): StandardWorkEntry | undefined { return this.getEntries(studyId).find((entry) => entry.operationId === operationId); }
  public getStudyCount(): number { return this.studies.size; }
  public getEntryCount(): number { return this.entries.size; }

  public restoreStudy(value: StandardWorkStudy): boolean { const study = cloneStandardWorkStudy(value); if (this.studies.has(study.id) || this.studies.size >= STANDARD_WORK_LIMITS.studies || !isValidStandardWorkStudy(study)) return false; this.studies.set(study.id, study); this.notify({ kind: 'study', studyId: study.id }); return true; }
  public replaceStudy(value: StandardWorkStudy): boolean { const study = cloneStandardWorkStudy(value); if (!this.studies.has(study.id) || !isValidStandardWorkStudy(study)) return false; this.studies.set(study.id, study); this.notify({ kind: 'study', studyId: study.id }); return true; }
  public updateStudy(id: string, patch: StandardWorkStudyPatch): boolean { const current = this.studies.get(id); if (!current) return false; return this.replaceStudy({ ...current, ...patch }); }
  public deleteStudy(id: string): boolean { if (!this.studies.delete(id)) return false; for (const entry of this.getEntries(id)) this.entries.delete(entry.id); this.notify({ kind: 'study', studyId: id }); return true; }

  public restoreEntry(value: StandardWorkEntry): boolean { const entry = cloneStandardWorkEntry(value); if (this.entries.has(entry.id) || this.entries.size >= STANDARD_WORK_LIMITS.totalEntries || !this.studies.has(entry.studyId) || !this.hasOperation(entry.operationId) || !isValidStandardWorkEntry(entry) || this.findEntry(entry.studyId, entry.operationId) || this.getEntries(entry.studyId).length >= STANDARD_WORK_LIMITS.entriesPerStudy) return false; this.entries.set(entry.id, entry); this.notify({ kind: 'entry', studyId: entry.studyId, entryId: entry.id, operationId: entry.operationId }); return true; }
  public replaceEntry(value: StandardWorkEntry): boolean { const entry = cloneStandardWorkEntry(value); const current = this.entries.get(entry.id); const duplicate = this.getEntries(entry.studyId).find((candidate) => candidate.operationId === entry.operationId && candidate.id !== entry.id); if (!current || !this.studies.has(entry.studyId) || !this.hasOperation(entry.operationId) || duplicate || !isValidStandardWorkEntry(entry)) return false; this.entries.set(entry.id, entry); this.notify({ kind: 'entry', studyId: entry.studyId, entryId: entry.id, operationId: entry.operationId }); return true; }
  public updateEntry(id: string, patch: StandardWorkEntryPatch): boolean { const current = this.entries.get(id); return Boolean(current && this.replaceEntry({ ...current!, ...patch })); }
  public deleteEntry(id: string): boolean { const entry = this.entries.get(id); if (!entry) return false; this.entries.delete(id); this.notify({ kind: 'entry', studyId: entry.studyId, entryId: id, operationId: entry.operationId }); return true; }

  public replaceAll(studies: readonly StandardWorkStudy[], entries: readonly StandardWorkEntry[], notify = true): void { this.studies.clear(); this.entries.clear(); studies.forEach((study) => this.studies.set(study.id, cloneStandardWorkStudy(study))); entries.forEach((entry) => this.entries.set(entry.id, cloneStandardWorkEntry(entry))); this.studyIds.ensureAfter(studies.map((item) => item.id)); this.entryIds.ensureAfter(entries.map((item) => item.id)); if (notify) this.publishReset(); }
  public publishReset(): void { this.notify({ kind: 'reset' }); }
  public subscribe(listener: StandardWorkListener): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private notify(change: StandardWorkChange): void { for (const listener of this.listeners) listener(change); }
}

export const standardWorkSnapshot = (store: StandardWorkStore): { studies: readonly StandardWorkStudy[]; entries: readonly StandardWorkEntry[] } => ({ studies: store.getStudies().map(cloneStandardWorkStudy), entries: store.getEntries().map(cloneStandardWorkEntry) });
