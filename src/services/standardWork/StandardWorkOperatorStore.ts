import { STANDARD_WORK_OPERATOR_LIMITS, cloneStandardWorkOperator, isValidStandardWorkOperator, type StandardWorkOperator, type StandardWorkOperatorPatch } from '../../models/standardWork/StandardWorkOperator';
import type { StableIdProvider } from '../../utilities/StandardWorkIdGenerator';

export type StandardWorkOperatorChange = { readonly kind: 'operator' | 'reset'; readonly studyId?: string; readonly operatorId?: string };

export class StandardWorkOperatorStore {
  private readonly values = new Map<string, StandardWorkOperator>(); private readonly listeners = new Set<(change: StandardWorkOperatorChange) => void>();
  public constructor(private readonly ids: StableIdProvider, private readonly hasStudy: (id: string) => boolean, private readonly hasResource: (id: string) => boolean) {}
  public nextId(): string { return this.ids.next(); }
  public getOperator(id: string): StandardWorkOperator | undefined { return this.values.get(id); }
  public getOperators(studyId?: string): readonly StandardWorkOperator[] { return [...this.values.values()].filter((item) => studyId === undefined || item.studyId === studyId).sort((a, b) => a.displayOrder - b.displayOrder || a.id.localeCompare(b.id)); }
  public getPrimary(studyId: string): StandardWorkOperator | undefined { return this.getOperators(studyId).filter((item) => item.active)[0]; }
  public getCount(studyId?: string): number { return studyId === undefined ? this.values.size : this.getOperators(studyId).length; }
  public getLinkedToResource(resourceId: string): readonly StandardWorkOperator[] { return this.getOperators().filter((item) => item.linkedResourceId === resourceId); }
  public restoreOperator(value: StandardWorkOperator): boolean { const item = cloneStandardWorkOperator(value); if (this.values.has(item.id) || this.values.size >= STANDARD_WORK_OPERATOR_LIMITS.total || this.getCount(item.studyId) >= STANDARD_WORK_OPERATOR_LIMITS.perStudy || !this.hasStudy(item.studyId) || item.linkedResourceId && !this.hasResource(item.linkedResourceId) || !isValidStandardWorkOperator(item)) return false; this.values.set(item.id, item); this.notify({ kind: 'operator', studyId: item.studyId, operatorId: item.id }); return true; }
  public replaceOperator(value: StandardWorkOperator): boolean { const item = cloneStandardWorkOperator(value); if (!this.values.has(item.id) || !this.hasStudy(item.studyId) || item.linkedResourceId && !this.hasResource(item.linkedResourceId) || !isValidStandardWorkOperator(item)) return false; this.values.set(item.id, item); this.notify({ kind: 'operator', studyId: item.studyId, operatorId: item.id }); return true; }
  public updateOperator(id: string, patch: StandardWorkOperatorPatch): boolean { const item = this.values.get(id); return Boolean(item && this.replaceOperator({ ...item!, ...patch })); }
  public deleteOperator(id: string): boolean { const item = this.values.get(id); if (!item || this.getCount(item.studyId) <= 1) return false; this.values.delete(id); this.notify({ kind: 'operator', studyId: item.studyId, operatorId: id }); return true; }
  public deleteStudy(studyId: string): void { for (const item of this.getOperators(studyId)) this.values.delete(item.id); this.notify({ kind: 'operator', studyId }); }
  public clearResourceLink(resourceId: string): readonly StandardWorkOperator[] { const affected = this.getLinkedToResource(resourceId).map(cloneStandardWorkOperator); for (const item of affected) this.values.set(item.id, { ...item, linkedResourceId: null }); if (affected.length) this.notify({ kind: 'operator' }); return affected; }
  public replaceAll(values: readonly StandardWorkOperator[], notify = true): void { this.values.clear(); values.forEach((item) => this.values.set(item.id, cloneStandardWorkOperator(item))); this.ids.ensureAfter(values.map((item) => item.id)); if (notify) this.publishReset(); }
  public publishReset(): void { this.notify({ kind: 'reset' }); }
  public subscribe(listener: (change: StandardWorkOperatorChange) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private notify(change: StandardWorkOperatorChange): void { for (const listener of this.listeners) listener(change); }
}
