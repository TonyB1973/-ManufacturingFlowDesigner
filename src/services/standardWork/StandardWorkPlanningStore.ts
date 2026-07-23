import { cloneStandardWorkPlanning, isValidStandardWorkPlanning, type StandardWorkPlanningParameters, type StandardWorkPlanningPatch } from '../../models/standardWork/StandardWorkPlanning';

export type StandardWorkPlanningChange = { readonly kind: 'planning' | 'reset'; readonly studyId?: string };

export class StandardWorkPlanningStore {
  private readonly values = new Map<string, StandardWorkPlanningParameters>();
  private readonly listeners = new Set<(change: StandardWorkPlanningChange) => void>();
  public constructor(private readonly hasStudy: (id: string) => boolean) {}
  public get(studyId: string): StandardWorkPlanningParameters | undefined { return this.values.get(studyId); }
  public getAll(): readonly StandardWorkPlanningParameters[] { return [...this.values.values()].sort((a, b) => a.studyId.localeCompare(b.studyId)); }
  public restore(value: StandardWorkPlanningParameters): boolean { const item = cloneStandardWorkPlanning(value); if (this.values.has(item.studyId) || !this.hasStudy(item.studyId) || !isValidStandardWorkPlanning(item)) return false; this.values.set(item.studyId, item); this.notify({ kind: 'planning', studyId: item.studyId }); return true; }
  public replace(value: StandardWorkPlanningParameters): boolean { const item = cloneStandardWorkPlanning(value); if (!this.values.has(item.studyId) || !this.hasStudy(item.studyId) || !isValidStandardWorkPlanning(item)) return false; this.values.set(item.studyId, item); this.notify({ kind: 'planning', studyId: item.studyId }); return true; }
  public update(studyId: string, patch: StandardWorkPlanningPatch): boolean { const current = this.values.get(studyId); return Boolean(current && this.replace({ ...current!, ...patch })); }
  public delete(studyId: string): boolean { if (!this.values.delete(studyId)) return false; this.notify({ kind: 'planning', studyId }); return true; }
  public replaceAll(values: readonly StandardWorkPlanningParameters[], notify = true): void { this.values.clear(); values.forEach((item) => this.values.set(item.studyId, cloneStandardWorkPlanning(item))); if (notify) this.publishReset(); }
  public publishReset(): void { this.notify({ kind: 'reset' }); }
  public subscribe(listener: (change: StandardWorkPlanningChange) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private notify(change: StandardWorkPlanningChange): void { for (const listener of this.listeners) listener(change); }
}
